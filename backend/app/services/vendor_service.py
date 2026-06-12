import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from fastapi import HTTPException, status

from app.models.vendor_profile import VendorProfile
from app.models.invoice import Invoice
from app.models.extracted_data import ExtractedData


async def get_vendors(
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
    result = await db.execute(
        select(VendorProfile)
        .where(VendorProfile.tenant_id == tenant_id)
        .order_by(VendorProfile.total_spend.desc())
    )
    vendors = result.scalars().all()
    return {"total": len(vendors), "items": vendors}


async def get_vendor_detail(
    vendor_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> dict:
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

    recent_invoices = [
        {
            "id": inv.id,
            "invoice_number": ed.invoice_number,
            "total_amount": ed.total_amount,
            "currency": ed.currency,
            "status": inv.status,
            "upload_date": inv.upload_date,
        }
        for inv, ed in rows
    ]

    return {"vendor": vendor, "recent_invoices": recent_invoices}
