"""Email notifications — logs to console in dev, sends via SMTP when configured."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM_EMAIL)


def send_email(to: str, subject: str, body_text: str) -> bool:
    if not to:
        return False

    if not _smtp_configured():
        logger.info("[notification] SMTP not configured — email to %s: %s", to, subject)
        print(f"\n--- EMAIL to {to} ---\nSubject: {subject}\n{body_text}\n---\n")
        return True

    msg = MIMEMultipart()
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as exc:
        logger.error("[notification] Failed to send to %s: %s", to, exc)
        return False


def notify_extraction_complete(
    to_email: str, vendor_name: str | None, invoice_id: str, total: str | None,
) -> None:
    label = vendor_name or "Invoice"
    send_email(
        to=to_email,
        subject=f"InvoiceIQ — extraction complete: {label}",
        body_text=(
            f"Extraction finished for {label}.\n"
            f"Total: {total or 'N/A'}\n\n"
            f"Review: {settings.FRONTEND_URL}/invoices/{invoice_id}"
        ),
    )


def notify_extraction_failed(to_email: str, invoice_id: str, error: str | None) -> None:
    send_email(
        to=to_email,
        subject="InvoiceIQ — extraction failed",
        body_text=(
            f"AI extraction failed for an uploaded invoice.\n"
            f"Error: {error or 'Unknown'}\n\n"
            f"View: {settings.FRONTEND_URL}/invoices/{invoice_id}"
        ),
    )


def notify_staff_invite(
    to_email: str, full_name: str, temp_password: str, company_name: str,
) -> None:
    send_email(
        to=to_email,
        subject=f"InvoiceIQ — invited to {company_name}",
        body_text=(
            f"Hi {full_name},\n\n"
            f"You've been invited to {company_name} on InvoiceIQ.\n\n"
            f"Login: {settings.FRONTEND_URL}\n"
            f"Email: {to_email}\n"
            f"Temporary password: {temp_password}\n\n"
            f"Please change your password after first login."
        ),
    )


def notify_email_verification(to_email: str, full_name: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    send_email(
        to=to_email,
        subject="InvoiceIQ — verify your email",
        body_text=(
            f"Hi {full_name},\n\n"
            f"Please verify your email to finish setting up InvoiceIQ.\n\n"
            f"Verify: {link}\n\n"
            f"If you did not create an account, ignore this email."
        ),
    )


def notify_password_reset(to_email: str, full_name: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    send_email(
        to=to_email,
        subject="InvoiceIQ — reset your password",
        body_text=(
            f"Hi {full_name},\n\n"
            f"We received a request to reset your password.\n\n"
            f"Reset: {link}\n\n"
            f"This link expires in 1 hour. If you did not request this, ignore this email."
        ),
    )


def notify_approval_needed(
    to_email: str, vendor_name: str | None, invoice_id: str, total: str | None,
) -> None:
    label = vendor_name or "Invoice"
    send_email(
        to=to_email,
        subject=f"InvoiceIQ — approval needed: {label}",
        body_text=(
            f"An invoice is ready for your review.\n"
            f"Vendor: {label}\n"
            f"Total: {total or 'N/A'}\n\n"
            f"Review: {settings.FRONTEND_URL}/invoices/{invoice_id}"
        ),
    )
