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
    display_total_spend: Decimal | None = None
    display_average_invoice: Decimal | None = None
    display_currency: str | None = None
    last_invoice_date: date | None
    is_recurring_vendor: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VendorListResponse(BaseModel):
    total: int
    tenant_currency: str
    items: list[VendorProfileResponse]


class VendorInvoiceSummary(BaseModel):
    id: uuid.UUID
    invoice_number: str | None
    total_amount: Decimal | None
    currency: str | None
    display_amount: Decimal | None = None
    display_currency: str | None = None
    amount_converted: bool = False
    status: str
    upload_date: datetime


class VendorDetailResponse(BaseModel):
    tenant_currency: str
    vendor: VendorProfileResponse
    recent_invoices: list[VendorInvoiceSummary]
