from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid


class TenantResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: EmailStr
    plan: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TenantSettingsUpdate(BaseModel):
    default_currency: str | None = None
    timezone: str | None = None
    logo_url: str | None = None
    notify_on_upload: bool | None = None
    notify_on_failure: bool | None = None


class TenantSettingsResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    default_currency: str
    timezone: str
    logo_url: str | None
    notify_on_upload: bool
    notify_on_failure: bool

    model_config = {"from_attributes": True}
