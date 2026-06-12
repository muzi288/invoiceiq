from pydantic import BaseModel, EmailStr
from datetime import datetime
import uuid


class InviteUserRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "staff"


class UpdatePermissionsRequest(BaseModel):
    can_approve: bool | None = None
    can_export: bool | None = None


class UserListResponse(BaseModel):
    items: list["UserResponse"]


class MeResponse(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    email_verified: bool
    must_change_password: bool
    onboarding_completed: bool

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    can_approve: bool
    can_export: bool
    email_verified: bool
    is_active: bool
    must_change_password: bool
    created_at: datetime

    model_config = {"from_attributes": True}
