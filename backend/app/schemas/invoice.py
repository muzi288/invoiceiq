from pydantic import BaseModel
from datetime import datetime
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


class InvoiceListResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[InvoiceResponse]


class ApproveRejectRequest(BaseModel):
    reason: str | None = None
