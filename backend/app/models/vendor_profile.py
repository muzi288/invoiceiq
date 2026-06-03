import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Integer, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class VendorProfile(Base):
    __tablename__ = "vendor_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False
    )
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    total_invoices: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_spend: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, default=0
    )
    average_invoice: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    last_invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_recurring_vendor: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
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
    tenant = relationship("Tenant", back_populates="vendor_profiles")

    # One vendor profile per vendor name per tenant
    __table_args__ = (
        __import__('sqlalchemy').UniqueConstraint(
            'tenant_id', 'vendor_name',
            name='uq_vendor_per_tenant'
        ),
    )
