import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from app.models.tenant import Tenant
from app.models.tenant_settings import TenantSettings
from app.models.user import User
from app.core.security import hash_password, verify_password, create_access_token
from app.schemas.auth import RegisterRequest, LoginRequest, TokenResponse

# Prevents timing attacks — see architecture.md Authentication section
DUMMY_HASH = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewohkyMkPmPJLEWy"


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

    tenant = Tenant(
        id=uuid.uuid4(),
        name=data.company_name,
        email=data.email,
        plan="free",
    )
    db.add(tenant)
    await db.flush()  # makes tenant.id available without committing

    settings = TenantSettings(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
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
    )
    db.add(user)

    return {
        "message": "Registration successful. Please verify your email.",
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

    # Always run bcrypt — timing attack prevention
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

    token = create_access_token({
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id),
        "role": user.role,
        "can_approve": user.can_approve,
        "can_export": user.can_export,
    })

    return TokenResponse(access_token=token)
