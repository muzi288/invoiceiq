from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    company_name: str
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    email_verified: bool = True
    onboarding_completed: bool = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class MessageResponse(BaseModel):
    message: str


class TokenPayload(BaseModel):
    user_id: str
    tenant_id: str
    role: str
    can_approve: bool
    can_export: bool
