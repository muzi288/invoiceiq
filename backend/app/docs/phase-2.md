# InvoiceIQ — Phase 2: Notifications & Staff Auth

Phase 2 wires up email notifications and proper staff onboarding.

---

## What's included

| Feature | Description |
|---------|-------------|
| Email service | SMTP when configured; prints to console in dev |
| Extraction complete email | Sent to tenant email when `notify_on_upload` is on |
| Extraction failed email | Sent when `notify_on_failure` is on |
| Approval needed email | Sent to owners/approvers after successful extraction |
| Staff invite email | Credentials emailed when owner invites a user |
| Change password | `POST /auth/change-password` returns new JWT |
| Forced password change | Invited staff must change temp password before using the app |
| Profile page | `/profile` — change password UI |

---

## Setup

### 1. Run migration

```bash
cd backend
alembic upgrade head
```

Adds `users.must_change_password` (boolean, default `false`).

### 2. Optional SMTP (`.env`)

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-api-key
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_USE_TLS=true
```

Without SMTP, emails print to the backend console — fine for local dev.

---

## API changes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/change-password` | `{ current_password, new_password }` → new JWT |
| POST | `/auth/login` | Response includes `must_change_password` |

JWT payload includes `must_change_password` for route guards.

---

## Notification triggers

| Event | Who gets emailed | Setting / rule |
|-------|------------------|----------------|
| Extraction completed | Tenant email | `notify_on_upload` |
| Extraction failed | Tenant email | `notify_on_failure` |
| Ready for approval | Owners + `can_approve` users | Always (except uploader) |
| Staff invited | Invitee | Always |

Toggle upload/failure notifications in **Settings**.

---

## User flows

1. **Owner invites staff** → invite email (or console log) with temp password
2. **Staff logs in** → redirected to `/profile?setup=1`
3. **Staff sets new password** → new JWT → full app access

---

## Phase 2B — planned next

- Email verification (`verification_token` on User model)
- Forgot password / reset link
- Onboarding wizard after registration
- Stripe billing + plan limits
- Custom tenant categories
- Automated tests + CI

---

## Files changed

**Backend:** `notification_service.py`, `config.py`, `auth_service.py`, `auth.py`, `users.py`, `extraction_service.py`, `user.py`, migration `a1b2c3d4e5f6`

**Frontend:** `Profile.jsx`, `Login.jsx`, `PrivateRoute.jsx`, `App.jsx`, `Layout.jsx`, `Team.jsx`, `api.js`
