from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
import uuid


class VendorProfileResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    vendor_name: str
    total_invoices: int
    total_spend: Decimal
    average_invoice: Decimal | None
    last_invoice_date: date | None
    is_recurring_vendor: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorListResponse(BaseModel):
    total: int
    items: list[VendorProfileResponse]


class VendorInvoiceSummary(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    total_amount: Decimal | None
    currency: str | None
    status: str
    upload_date: datetime


class VendorDetailResponse(BaseModel):
    vendor: VendorProfileResponse
    recent_invoices: list[VendorInvoiceSummary]
