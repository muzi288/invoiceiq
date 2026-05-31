from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
import uuid


class ExtractedDataResponse(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    vendor_name: str | None
    invoice_number: str | None
    invoice_date: date | None
    due_date: date | None
    subtotal: Decimal | None
    tax_amount: Decimal | None
    total_amount: Decimal | None
    currency: str
    is_multi_currency: bool
    payment_terms: str | None
    notes: str | None
    confidence_score: float | None
    edited_by: uuid.UUID | None
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExtractedDataUpdate(BaseModel):
    vendor_name: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    due_date: date | None = None
    subtotal: Decimal | None = None
    tax_amount: Decimal | None = None
    total_amount: Decimal | None = None
    currency: str | None = None
    payment_terms: str | None = None
    notes: str | None = None


class InvoiceWithDataResponse(BaseModel):
    invoice: InvoiceResponse
    extracted_data: ExtractedDataResponse | None
    line_items: list[dict]
    signed_url: str | None

    model_config = {"from_attributes": True}


# Import here to avoid circular import
from app.schemas.invoice import InvoiceResponse
