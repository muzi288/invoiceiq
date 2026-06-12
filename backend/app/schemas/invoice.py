from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
import uuid


class InvoiceUploadRequest(BaseModel):
    category: str = "uncategorised"
    tags: list[str] = []


class InvoiceResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    uploaded_by: uuid.UUID
    file_path: str
    file_type: str
    file_size_bytes: int
    category: str
    tags: list[str]
    status: str
    extraction_status: str
    extraction_error: str | None
    retry_count: int
    upload_date: datetime
    processed_at: datetime | None
    deleted_at: datetime | None

    model_config = {"from_attributes": True}


class InvoiceListItemResponse(InvoiceResponse):
    vendor_name: str | None = None
    invoice_number: str | None = None
    total_amount: Decimal | None = None
    currency: str | None = None
    uploaded_by_name: str | None = None


class InvoiceListResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[InvoiceListItemResponse]


class InvoiceMetadataUpdate(BaseModel):
    category: str | None = None
    tags: list[str] | None = None
    payment_status: str | None = None
    payment_date: date | None = None
    payment_ref: str | None = None


class ApproveRejectRequest(BaseModel):
    reason: str | None = None
