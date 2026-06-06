import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    action: str,
    invoice_id: uuid.UUID | None = None,
    extra_data: dict | None = None,
    ip_address: str | None = None,
) -> None:
    entry = AuditLog(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        invoice_id=invoice_id,
        extra_data=extra_data or {},
        ip_address=ip_address,
    )
    db.add(entry)
    # No commit here — caller's transaction commits it
    # This ensures audit log and the action it records
    # are committed atomically — both succeed or both fail
