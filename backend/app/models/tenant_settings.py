import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class TenantSettings(Base):
    __tablename__ = "tenant_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        unique=True,
        nullable=False
    )
    default_currency: Mapped[str] = mapped_column(
        String(10), nullable=False, default="USD"
    )
    timezone: Mapped[str] = mapped_column(
        String(50), nullable=False, default="Africa/Harare"
    )
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notify_on_upload: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    notify_on_failure: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="settings")
