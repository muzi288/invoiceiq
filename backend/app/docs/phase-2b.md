# InvoiceIQ — Phase 2B: Auth & Onboarding

Email verification, password reset, and first-time owner setup.

---

## What's included

| Feature | Description |
|---------|-------------|
| Email verification | Link sent on registration; verify via `/verify-email?token=` |
| Resend verification | `POST /auth/resend-verification` + button on Profile |
| Forgot password | `POST /auth/forgot-password` — always returns generic success |
| Reset password | `POST /auth/reset-password` — 1-hour token expiry |
| Owner onboarding | Currency + timezone wizard after first login |
| Unverified banner | Amber bar in app layout until email verified |

---

## API

| Method | Endpoint | Auth |
|--------|----------|------|
| GET | `/auth/verify-email?token=` | Public |
| POST | `/auth/resend-verification` | Public |
| POST | `/auth/forgot-password` | Public |
| POST | `/auth/reset-password` | Public |
| POST | `/settings/onboarding` | Owner |
| GET | `/users/me` | User |

Login response now includes `email_verified` and `onboarding_completed`.

---

## Setup

```bash
cd backend
alembic upgrade head
```

Migration `b2c3d4e5f6a7` adds `password_reset_token`, `password_reset_expires_at`, `tenant_settings.onboarding_completed`.

Existing tenants get `onboarding_completed=true` automatically. New registrations start with `onboarding_completed=false`.

---

## User flows

1. **Register** → verification email (console if no SMTP) → verify link → login
2. **First owner login** → onboarding (currency + timezone) → dashboard
3. **Forgot password** → email with reset link → new password → login
4. **Invited staff** → skip onboarding; `email_verified=true` (owner invited them)

---

## Frontend routes

| Route | Purpose |
|-------|---------|
| `/verify-email?token=` | Confirm email |
| `/forgot-password` | Request reset |
| `/reset-password?token=` | Set new password |
| `/onboarding` | Owner first-time setup |

---

## Phase 2B — still planned

- Stripe billing + plan limits
- Custom tenant categories
- Payment-date FX on mark-paid
- Automated tests + CI
