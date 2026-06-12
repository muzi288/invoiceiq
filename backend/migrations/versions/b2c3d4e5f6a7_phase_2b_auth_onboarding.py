"""phase 2b password reset and onboarding

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('password_reset_token', sa.String(length=255), nullable=True),
    )
    op.add_column(
        'users',
        sa.Column('password_reset_expires_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        'tenant_settings',
        sa.Column('onboarding_completed', sa.Boolean(), nullable=False, server_default='true'),
    )


def downgrade() -> None:
    op.drop_column('tenant_settings', 'onboarding_completed')
    op.drop_column('users', 'password_reset_expires_at')
    op.drop_column('users', 'password_reset_token')
