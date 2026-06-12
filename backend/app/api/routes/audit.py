from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import Optional
import uuid
import math

from app.core.database import get_db
from app.core.dependencies import get_current_owner
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.extracted_data import ExtractedData
from app.schemas.audit_log import AuditLogListResponse

router = APIRouter(prefix="/audit", tags=["audit"])


async def _enrich_audit_logs(logs, db: AsyncSession) -> list[dict]:
    if not logs:
        return []

    user_ids = {log.user_id for log in logs}
    invoice_ids = {log.invoice_id for log in logs if log.invoice_id}

    users_map = {}
    if user_ids:
        users_result = await db.execute(
            select(User).where(User.id.in_(user_ids))
        )
        users_map = {u.id: u for u in users_result.scalars().all()}

    invoice_labels = {}
    if invoice_ids:
        ed_result = await db.execute(
            select(ExtractedData).where(ExtractedData.invoice_id.in_(invoice_ids))
        )
        for ed in ed_result.scalars().all():
            label = ed.vendor_name or ed.invoice_number or str(ed.invoice_id)[:8]
            invoice_labels[ed.invoice_id] = label

    enriched = []
    for log in logs:
        user = users_map.get(log.user_id)
        enriched.append({
            "id": log.id,
            "tenant_id": log.tenant_id,
            "user_id": log.user_id,
            "invoice_id": log.invoice_id,
            "action": log.action,
            "extra_data": log.extra_data or {},
            "ip_address": log.ip_address,
            "created_at": log.created_at,
            "user_name": user.full_name if user else None,
            "user_role": user.role if user else None,
            "invoice_label": invoice_labels.get(log.invoice_id) if log.invoice_id else None,
        })
    return enriched


@router.get("", response_model=AuditLogListResponse)
async def get_audit_log(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=200),
    user_id: Optional[uuid.UUID] = Query(default=None),
    invoice_id: Optional[uuid.UUID] = Query(default=None),
    action: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_owner),
):
    query = select(AuditLog).where(
        AuditLog.tenant_id == current_user.tenant_id
    )

    if user_id:
        query = query.where(AuditLog.user_id == user_id)
    if invoice_id:
        query = query.where(AuditLog.invoice_id == invoice_id)
    if action:
        query = query.where(AuditLog.action == action)
    if date_from:
        query = query.where(AuditLog.created_at >= date_from)
    if date_to:
        query = query.where(AuditLog.created_at <= date_to)

    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query)

    offset = (page - 1) * limit
    query = query.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)

    result = await db.execute(query)
    logs = result.scalars().all()
    items = await _enrich_audit_logs(logs, db)

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "pages": math.ceil(total / limit) if total else 0,
        "items": items,
    }
