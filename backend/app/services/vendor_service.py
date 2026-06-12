import uuid
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.vendor_profile import VendorProfile
from app.models.invoice import Invoice
from app.models.extracted_data import ExtractedData
from app.models.tenant_settings import TenantSettings
from app.services.currency_service import display_amount_for_invoice, prefetch_rates


async def _get_tenant_currency(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    settings = result.scalar_one_or_none()
    return settings.default_currency if settings else "USD"


async def _vendor_invoice_rows(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    vendor_name: str | None = None,
) -> list[tuple]:
    query = (
        select(
            ExtractedData.vendor_name,
            ExtractedData.total_amount,
            ExtractedData.currency,
            ExtractedData.invoice_date,
            Invoice.upload_date,
        )
        .join(Invoice, Invoice.id == ExtractedData.invoice_id)
        .where(
            and_(
                Invoice.tenant_id == tenant_id,
                Invoice.deleted_at == None,
                ExtractedData.vendor_name.isnot(None),
            )
        )
    )
    if vendor_name:
        query = query.where(ExtractedData.vendor_name == vendor_name)

    result = await db.execute(query)
    return result.all()


async def _sum_converted_spend(
    rows: list[tuple],
    tenant_currency: str,
) -> tuple[Decimal, Decimal | None, int]:
    """Return (total_spend, average_invoice, invoice_count) in tenant currency."""
    currencies = {row[2] for row in rows if row[2]}
    rate_dates = {row[3] for row in rows if row[3]}
    rate_dates |= {row[4].date() for row in rows if row[4] and not row[3]}
    await prefetch_rates(currencies, tenant_currency, rate_dates)

    converted: list[Decimal] = []
    for _, amount, currency, invoice_date, upload_date in rows:
        if amount is None:
            continue
        fields = await display_amount_for_invoice(
            amount,
            currency,
            tenant_currency,
            invoice_date=invoice_date,
            fallback_date=upload_date,
        )
        if fields["display_amount"] is not None:
            converted.append(fields["display_amount"])

    if not converted:
        return Decimal("0"), None, len(rows)

    total = sum(converted, Decimal("0"))
    average = (total / len(converted)).quantize(Decimal("0.01"))
    return total, average, len(rows)


def _vendor_with_display(
    profile: VendorProfile,
    total_spend: Decimal,
    average_invoice: Decimal | None,
    invoice_count: int,
    tenant_currency: str,
) -> dict:
    data = {c.key: getattr(profile, c.key) for c in profile.__table__.columns}
    data.update({
        "total_invoices": invoice_count or profile.total_invoices,
        "display_total_spend": total_spend,
        "display_average_invoice": average_invoice,
        "display_currency": tenant_currency,
    })
    return data


async def get_vendors(
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    tenant_currency = await _get_tenant_currency(db, tenant_id)

    profiles_result = await db.execute(
        select(VendorProfile)
        .where(VendorProfile.tenant_id == tenant_id)
        .order_by(VendorProfile.total_spend.desc())
    )
    profiles = profiles_result.scalars().all()

    all_rows = await _vendor_invoice_rows(db, tenant_id)
    by_vendor: dict[str, list[tuple]] = {}
    for row in all_rows:
        name = row[0]
        by_vendor.setdefault(name, []).append(row)

    items = []
    for profile in profiles:
        rows = by_vendor.get(profile.vendor_name, [])
        total, average, count = await _sum_converted_spend(rows, tenant_currency)
        items.append(_vendor_with_display(profile, total, average, count, tenant_currency))

    # Sort by converted spend descending
    items.sort(
        key=lambda v: v["display_total_spend"],
        reverse=True,
    )

    return {
        "total": len(items),
        "tenant_currency": tenant_currency,
        "items": items,
    }


async def get_vendor_detail(
    vendor_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    tenant_currency = await _get_tenant_currency(db, tenant_id)

    result = await db.execute(
        select(VendorProfile).where(
            and_(
                VendorProfile.id == vendor_id,
                VendorProfile.tenant_id == tenant_id,
            )
        )
    )
    vendor = result.scalar_one_or_none()

    if not vendor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Vendor not found",
        )

    spend_rows = await _vendor_invoice_rows(db, tenant_id, vendor.vendor_name)
    total, average, count = await _sum_converted_spend(spend_rows, tenant_currency)

    invoices_result = await db.execute(
        select(Invoice, ExtractedData)
        .join(ExtractedData, ExtractedData.invoice_id == Invoice.id)
        .where(
            and_(
                Invoice.tenant_id == tenant_id,
                Invoice.deleted_at == None,
                ExtractedData.vendor_name == vendor.vendor_name,
            )
        )
        .order_by(Invoice.upload_date.desc())
        .limit(20)
    )
    rows = invoices_result.all()

    currencies = {ed.currency for _, ed in rows if ed.currency}
    rate_dates = {ed.invoice_date for _, ed in rows if ed.invoice_date}
    rate_dates |= {
        inv.upload_date.date()
        for inv, ed in rows
        if inv.upload_date and not ed.invoice_date
    }
    await prefetch_rates(currencies, tenant_currency, rate_dates)

    recent_invoices = []
    for inv, ed in rows:
        fields = await display_amount_for_invoice(
            ed.total_amount,
            ed.currency,
            tenant_currency,
            invoice_date=ed.invoice_date,
            fallback_date=inv.upload_date,
        )
        recent_invoices.append({
            "id": inv.id,
            "invoice_number": ed.invoice_number,
            "total_amount": ed.total_amount,
            "currency": ed.currency,
            "status": inv.status,
            "upload_date": inv.upload_date,
            **fields,
        })

    return {
        "tenant_currency": tenant_currency,
        "vendor": _vendor_with_display(vendor, total, average, count, tenant_currency),
        "recent_invoices": recent_invoices,
    }
