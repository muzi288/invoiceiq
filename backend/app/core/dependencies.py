from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from jose import JWTError

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.schemas.auth import TokenPayload

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decode JWT token from Authorization header.
    Return the current authenticated user.
    Raise 401 if token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(credentials.credentials)
        user_id: str = payload.get("user_id")
        tenant_id: str = payload.get("tenant_id")

        if user_id is None or tenant_id is None:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # Set tenant_id as PostgreSQL session variable for RLS
    await db.execute(
    text(f"SET app.tenant_id = '{tenant_id}'")
    )


    # Fetch user from database
    result = await db.execute(
        select(User).where(
            User.id == user_id,
            User.is_active == True
        )
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


async def get_current_owner(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the current user to be an owner.
    Raise 403 if they are staff.
    """
    if current_user.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Owner access required"
        )
    return current_user


async def get_current_approver(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the current user to be an owner
    or a staff member with can_approve permission.
    """
    if current_user.role != "owner" and not current_user.can_approve:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Approval permission required"
        )
    return current_user


async def get_current_exporter(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Require the current user to be an owner
    or a staff member with can_export permission.
    """
    if current_user.role != "owner" and not current_user.can_export:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Export permission required"
        )
    return current_user
