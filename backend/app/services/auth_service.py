import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.tenant import Tenant
from app.models.tenant_settings import TenantSettings
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse
from app.services.notification_service import notify_email_verification, notify_password_reset

# Prevents timing attacks — see architecture.md Authentication section
DUMMY_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewohkyMkPmPJLEWy"

RESET_TOKEN_HOURS = 1


async def _tenant_settings(
    db: AsyncSession, tenant_id: uuid.UUID,
) -> TenantSettings | None:
    result = await db.execute(
        select(TenantSettings).where(TenantSettings.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


def _build_token(user: User, settings: TenantSettings | None) -> TokenResponse:
    token = create_access_token({
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role,
        "can_approve": user.can_approve,
        "can_export": user.can_export,
        "must_change_password": user.must_change_password,
        "email_verified": user.email_verified,
        "onboarding_completed": (
            settings.onboarding_completed if settings else True
        ),
    })
    return TokenResponse(
        access_token=token,
        must_change_password=user.must_change_password,
        email_verified=user.email_verified,
        onboarding_completed=settings.onboarding_completed if settings else True,
    )


async def register_tenant(
    data: RegisterRequest,
    db: AsyncSession,
) -> dict:
    existing = await db.execute(
        select(User).where(User.email == data.email)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    verification_token = secrets.token_urlsafe(32)

    tenant = Tenant(
        id=uuid.uuid4(),
        name=data.company_name,
        email=data.email,
        plan="free",
    )
    db.add(tenant)
    await db.flush()

    settings = TenantSettings(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        onboarding_completed=False,
    )
    db.add(settings)

    user = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role="owner",
        can_approve=True,
        can_export=True,
        email_verified=False,
        verification_token=verification_token,
    )
    db.add(user)
    await db.flush()

    notify_email_verification(data.email, data.full_name, verification_token)

    return {
        "message": "Registration successful. Check your email to verify your account.",
        "tenant_id": str(tenant.id),
    }


async def login_user(
    data: LoginRequest,
    db: AsyncSession,
) -> TokenResponse:
    result = await db.execute(
        select(User).where(User.email == data.email)
    )
    user = result.scalar_one_or_none()

    hash_to_check = user.hashed_password if user else DUMMY_HASH
    password_valid = verify_password(data.password, hash_to_check)

    if not user or not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account deactivated. Contact your administrator."
        )

    settings = await _tenant_settings(db, user.tenant_id)
    return _build_token(user, settings)


async def change_password(
    user: User,
    current_password: str,
    new_password: str,
    db: AsyncSession,
) -> TokenResponse:
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )

    user.hashed_password = hash_password(new_password)
    user.must_change_password = False

    settings = await _tenant_settings(db, user.tenant_id)
    return _build_token(user, settings)


async def verify_email(token: str, db: AsyncSession) -> dict:
    result = await db.execute(
        select(User).where(User.verification_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification link",
        )

    user.email_verified = True
    user.verification_token = None

    return {"message": "Email verified successfully. You can sign in now."}


async def resend_verification(email: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and not user.email_verified:
        user.verification_token = secrets.token_urlsafe(32)
        notify_email_verification(user.email, user.full_name, user.verification_token)

    return {
        "message": "If that email is registered and unverified, we sent a new link.",
    }


async def request_password_reset(email: str, db: AsyncSession) -> dict:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        user.password_reset_token = secrets.token_urlsafe(32)
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            hours=RESET_TOKEN_HOURS
        )
        notify_password_reset(user.email, user.full_name, user.password_reset_token)

    return {
        "message": "If that email is registered, we sent password reset instructions.",
    }


async def reset_password(
    token: str, new_password: str, db: AsyncSession,
) -> dict:
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )

    result = await db.execute(
        select(User).where(User.password_reset_token == token)
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_reset_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset link",
        )

    if user.password_reset_expires_at < datetime.now(timezone.utc):
        user.password_reset_token = None
        user.password_reset_expires_at = None
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset link has expired. Request a new one.",
        )

    user.hashed_password = hash_password(new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    user.must_change_password = False

    return {"message": "Password updated. You can sign in now."}
