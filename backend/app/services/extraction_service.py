import json
import uuid
import asyncio
from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.extracted_data import ExtractedData
from app.models.line_item import LineItem
from app.models.vendor_profile import VendorProfile
from app.services.audit_service import log_action

EXTRACTION_SYSTEM_PROMPT = """You are a financial document extraction specialist.
Extract all available fields from this invoice or receipt document.
Follow the JSON schema rigidly. Missing fields must use null."""

GEMINI_RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "vendor_name": {"type": "STRING"},
        "invoice_number": {"type": "STRING"},
        "invoice_date": {"type": "STRING", "description": "YYYY-MM-DD"},
        "due_date": {"type": "STRING", "description": "YYYY-MM-DD"},
        "subtotal": {"type": "NUMBER"},
        "tax_amount": {"type": "NUMBER"},
        "total_amount": {"type": "NUMBER"},
        "currency": {"type": "STRING", "description": "3-letter ISO code e.g. USD, ZAR"},
        "payment_terms": {"type": "STRING"},
        "notes": {"type": "STRING"},
        "is_multi_currency": {"type": "BOOLEAN"},
        "is_recurring": {"type": "BOOLEAN"},
        "confidence_score": {"type": "NUMBER", "description": "0.0 to 1.0"},
        "line_items": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "description": {"type": "STRING"},
                    "quantity": {"type": "NUMBER"},
                    "unit_price": {"type": "NUMBER"},
                    "total_price": {"type": "NUMBER"},
                    "currency": {"type": "STRING"}
                }
            }
        }
    },
    "required": ["is_multi_currency", "is_recurring", "confidence_score"]
}

async def call_gemini_async(file_contents: bytes, file_type: str) -> str:
    """Call Google Gemini API asynchronously with Quota Rate Limit Backoff."""
    import base64
    import google.generativeai as genai
    from google.api_core.exceptions import ResourceExhausted

    genai.configure(api_key=settings.GEMINI_API_KEY)
    
    model = genai.GenerativeModel(
        "gemini-2.5-flash-lite",
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": GEMINI_RESPONSE_SCHEMA
        },
        system_instruction=EXTRACTION_SYSTEM_PROMPT
    )

    mime_map = {
        "pdf":  "application/pdf",
        "jpeg": "image/jpeg",
        "png":  "image/png",
    }
    mime_type = mime_map.get(file_type, "application/pdf")
    file_b64 = base64.standard_b64encode(file_contents).decode("utf-8")

    max_retries = 3
    base_delay = 15 

    for attempt in range(max_retries):
        try:
            # We wrap the synchronous network call using asyncio.to_thread
            # This is safe, lightweight, and works seamlessly inside Celery tasks
            response = await asyncio.to_thread(
                model.generate_content,
                [{
                    "inline_data": {
                        "mime_type": mime_type,
                        "data": file_b64,
                    }
                }]
            )
            
            await asyncio.sleep(base_delay)
            return response.text

        except ResourceExhausted as e:
            if attempt == max_retries - 1:
                raise e
            wait_time = base_delay * (2 ** attempt)
            print(f"[extraction] 429 Quota Exceeded. Sleeping for {wait_time}s...")
            await asyncio.sleep(wait_time)


async def extract_invoice(
    invoice_id: uuid.UUID,
    file_contents: bytes,
    file_type: str,
    db: AsyncSession,
) -> None:
    """Core extraction workflow — fully asynchronous."""
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        return

    # Status update was handled cleanly inside the task wrapper, 
    # so we proceed directly to the API execution.
    try:
        print("[extraction] calling gemini pipeline...")
        raw_json_str = await call_gemini_async(file_contents, file_type)
        extracted = json.loads(raw_json_str)
        extracted["_provider_used"] = "gemini"

        from datetime import date

        def _parse_date(val):
            if val and isinstance(val, str):
                try:
                    return date.fromisoformat(val)
                except ValueError:
                    return None
            return val

        # Map details into the DB model
        extracted_data = ExtractedData(
            id=uuid.uuid4(),
            invoice_id=invoice_id,
            vendor_name=extracted.get("vendor_name"),
            invoice_number=extracted.get("invoice_number"),
            invoice_date=_parse_date(extracted.get("invoice_date")),
            due_date=_parse_date(extracted.get("due_date")),
            subtotal=extracted.get("subtotal"),
            tax_amount=extracted.get("tax_amount"),
            total_amount=extracted.get("total_amount"),
            currency=extracted.get("currency") or "USD",
            payment_terms=extracted.get("payment_terms"),
            notes=extracted.get("notes"),
            is_multi_currency=extracted.get("is_multi_currency", False),
            is_recurring=extracted.get("is_recurring", False),
            confidence_score=extracted.get("confidence_score"),
            raw_claude_response=extracted,
        )
        db.add(extracted_data)

        for index, item in enumerate(extracted.get("line_items", [])):
            line_item = LineItem(
                id=uuid.uuid4(),
                invoice_id=invoice_id,
                description=item.get("description"),
                quantity=item.get("quantity"),
                unit_price=item.get("unit_price"),
                total_price=item.get("total_price"),
                currency=item.get("currency") or extracted.get("currency") or "USD",
                sort_order=index,
            )
            db.add(line_item)

        await update_vendor_profile(
            db=db,
            tenant_id=invoice.tenant_id,
            vendor_name=extracted.get("vendor_name"),
            total_amount=extracted.get("total_amount"),
        )

        invoice.extraction_status = "completed"
        invoice.processed_at = datetime.now(timezone.utc)

        await log_action(
            db=db,
            tenant_id=invoice.tenant_id,
            user_id=invoice.uploaded_by,
            action="extraction_completed",
            invoice_id=invoice_id,
            extra_data={
                "vendor_name": extracted.get("vendor_name"),
                "total_amount": str(extracted.get("total_amount")),
                "confidence_score": extracted.get("confidence_score"),
                "provider_used": extracted.get("_provider_used"),
            }
        )

    except Exception as e:
        print(f"[extraction] pipeline failure occurred: {e}")
        invoice.extraction_status = "failed"
        invoice.extraction_error = str(e)
        invoice.retry_count += 1
        await log_action(
            db=db,
            tenant_id=invoice.tenant_id,
            user_id=invoice.uploaded_by,
            action="extraction_failed",
            invoice_id=invoice_id,
            extra_data={"error": str(e)}
        )
        raise e


async def update_vendor_profile(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    vendor_name: str | None,
    total_amount: float | None,
) -> None:
    if not vendor_name or not total_amount:
        return

    result = await db.execute(
        select(VendorProfile).where(
            VendorProfile.tenant_id == tenant_id,
            VendorProfile.vendor_name == vendor_name,
        )
    )
    profile = result.scalar_one_or_none()

    if profile:
        profile.total_invoices += 1
        profile.total_spend += total_amount
        profile.average_invoice = profile.total_spend / profile.total_invoices
        profile.last_invoice_date = datetime.now(timezone.utc).date()
    else:
        profile = VendorProfile(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            vendor_name=vendor_name,
            total_invoices=1,
            total_spend=total_amount,
            average_invoice=total_amount,
            last_invoice_date=datetime.now(timezone.utc).date(),
        )
        db.add(profile)
