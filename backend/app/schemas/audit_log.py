from pydantic import BaseModel
from datetime import datetime
import uuid


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    invoice_id: uuid.UUID | None
    action: str
    extra_data: dict
    ip_address: str | None
    created_at: datetime
    user_name: str | None = None
    user_role: str | None = None
    invoice_label: str | None = None

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    total: int
    page: int
    limit: int
    pages: int
    items: list[AuditLogResponse]
