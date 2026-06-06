import json
import uuid
import base64
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.extracted_data import ExtractedData
from app.models.line_item import LineItem
from app.models.vendor_profile import VendorProfile
from app.services.audit_service import log_action

# ── MODEL ROUTING ─────────────────────────────────────────────────
# Switch EXTRACTION_PROVIDER in .env to change provider
# gemini      → Google Gemini 3.5 Flash (free, 30 RPM)
# openrouter  → Llama 4 Maverick free tier (200 req/day fallback)
# anthropic   → Claude Haiku 4.5 (paid, $0.25/M tokens, production)

PROVIDERS = {
    "gemini": {
        "model": "gemini-3.5-flash",
        "cost": "free",
        "vision": True,
        "pdf_native": True,
    },
    "openrouter_llama": {
        "model": "meta-llama/llama-4-maverick:free",
        "cost": "free",
        "vision": True,
        "pdf_native": False,
    },
    "openrouter_qwen": {
        "model": "qwen/qwen2.5-vl-72b-instruct:free",
        "cost": "free",
        "vision": True,
        "pdf_native": False,
    },
    "anthropic": {
        "model": "claude-haiku-4-5",
        "cost": "$0.25/M tokens",
        "vision": True,
        "pdf_native": True,
    },
}

EXTRACTION_SYSTEM_PROMPT = """You are a financial document extraction specialist.
Extract all available fields from this invoice or receipt document.
Return ONLY a valid JSON object. No preamble, no explanation, no markdown.
Raw JSON only.

Use this exact schema:
{
  "vendor_name": "string or null",
  "invoice_number": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "subtotal": number or null,
  "tax_amount": number or null,
  "total_amount": number or null,
  "currency": "3-letter ISO code e.g. USD ZAR ZWL or null",
  "payment_terms": "string or null",
  "notes": "string or null",
  "is_multi_currency": boolean,
  "is_recurring": boolean,
  "confidence_score": number between 0.0 and 1.0,
  "line_items": [
    {
      "description": "string or null",
      "quantity": number or null,
      "unit_price": number or null,
      "total_price": number or null,
      "currency": "string or null"
    }
  ]
}

Rules:
- Missing fields use null
- Dates in YYYY-MM-DD format
- Amounts are numbers not strings
- is_multi_currency true if line items have different currencies
- is_recurring true if this looks like a subscription or recurring charge
- confidence_score reflects overall extraction confidence
- Preserve original line item order"""


async def call_gemini(file_contents: bytes, file_type: str) -> str:
    """Call Google Gemini API for extraction."""
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-3.5-flash")

    mime_map = {
        "pdf":  "application/pdf",
        "jpeg": "image/jpeg",
        "png":  "image/png",
    }
    mime_type = mime_map.get(file_type, "application/pdf")

    response = model.generate_content([
        {"mime_type": mime_type, "data": file_contents},
        EXTRACTION_SYSTEM_PROMPT
    ])

    return response.text


async def call_openrouter(
    file_contents: bytes,
    file_type: str,
    model: str,
) -> str:
    """Call OpenRouter API for extraction (OpenAI-compatible)."""
    import httpx

    file_b64 = base64.standard_b64encode(file_contents).decode("utf-8")

    mime_map = {
        "pdf":  "application/pdf",
        "jpeg": "image/jpeg",
        "png":  "image/png",
    }
    mime_type = mime_map.get(file_type, "image/jpeg")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": EXTRACTION_SYSTEM_PROMPT,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{file_b64}"
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all invoice data and return as JSON."
                    }
                ],
            }
        ],
        "response_format": {"type": "json_object"},
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=60.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def call_anthropic(file_contents: bytes, file_type: str) -> str:
    """Call Anthropic Claude API for extraction."""
    from anthropic import Anthropic

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    mime_map = {
        "pdf":  "application/pdf",
        "jpeg": "image/jpeg",
        "png":  "image/png",
    }
    media_type = mime_map.get(file_type, "application/pdf")
    file_b64 = base64.standard_b64encode(file_contents).decode("utf-8")

    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=2000,
        system=[
            {
                "type": "text",
                "text": EXTRACTION_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document" if media_type == "application/pdf" else "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": file_b64,
                        },
                    },
                    {
                        "type": "text",
                        "text": "Extract all invoice data and return as JSON."
                    }
                ],
            }
        ],
    )
    return response.content[0].text


async def run_extraction(
    file_contents: bytes,
    file_type: str,
    provider: str = None,
) -> dict:
    """
    Route extraction to the configured provider.
    Falls back through providers if one fails.
    Provider order: gemini → openrouter_llama → openrouter_qwen → anthropic
    """
    provider = provider or settings.EXTRACTION_PROVIDER

    fallback_order = [
        "gemini",
        "openrouter_llama",
        "openrouter_qwen",
        "anthropic",
    ]

    # Start from configured provider
    start_index = fallback_order.index(provider) if provider in fallback_order else 0
    providers_to_try = fallback_order[start_index:]

    last_error = None

    for p in providers_to_try:
        try:
            if p == "gemini":
                raw = await call_gemini(file_contents, file_type)
            elif p == "openrouter_llama":
                raw = await call_openrouter(
                    file_contents, file_type,
                    "meta-llama/llama-4-maverick:free"
                )
            elif p == "openrouter_qwen":
                raw = await call_openrouter(
                    file_contents, file_type,
                    "qwen/qwen2.5-vl-72b-instruct:free"
                )
            elif p == "anthropic":
                raw = await call_anthropic(file_contents, file_type)

            # Strip markdown if model wrapped response in code blocks
            clean = raw.strip()
            if clean.startswith("```"):
                clean = clean.split("```")[1]
                if clean.startswith("json"):
                    clean = clean[4:]
            clean = clean.strip()

            extracted = json.loads(clean)
            extracted["_provider_used"] = p
            return extracted

        except Exception as e:
            last_error = e
            continue

    raise Exception(f"All providers failed. Last error: {last_error}")


async def extract_invoice(
    invoice_id: uuid.UUID,
    file_contents: bytes,
    file_type: str,
    db: AsyncSession,
) -> None:
    """
    Main extraction function called by Celery worker.
    Handles the full lifecycle: status updates, saving results, audit log.
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()

    if not invoice:
        return

    invoice.extraction_status = "processing"
    await db.flush()

    try:
        extracted = await run_extraction(file_contents, file_type)

        extracted_data = ExtractedData(
            id=uuid.uuid4(),
            invoice_id=invoice_id,
            vendor_name=extracted.get("vendor_name"),
            invoice_number=extracted.get("invoice_number"),
            invoice_date=extracted.get("invoice_date"),
            due_date=extracted.get("due_date"),
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
