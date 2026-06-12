# InvoiceIQ — SaaS Product Upgrades (June 2026)

This document records the Phase 1 SaaS upgrades: dashboard UX, editing workflows, team/settings pages, vendor intelligence UI, and audit improvements.

---

## Summary of Changes

| Area | Before | After |
|------|--------|-------|
| Dashboard | Showed category + status only | Vendor name, invoice #, total, uploader, search, category filter |
| Invoice detail | 4 editable fields, read-only line items | All extracted fields editable, line item editor, re-extract button |
| Audit log | Raw UUIDs for user/invoice | User name + role, vendor label, clickable invoice links, filters |
| Vendors | Backend-only aggregates | `/vendors` list + detail pages with spend stats |
| Team | API only (`POST /users/invite`) | Team page: invite, permissions, deactivate |
| Settings | API only | Settings page for currency, timezone, notifications |
| Export | API only | Export page with CSV download + audit logging |
| Upload | Tags always empty | Comma-separated tags input |

---

## New API Endpoints

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices?search=` | Search by vendor name or invoice number |
| PUT | `/invoices/{id}/line-items` | Replace all line items |
| POST | `/invoices/{id}/re-extract` | Clear extraction and re-run AI pipeline |
| PATCH | `/invoices/{id}` | Update category, tags, payment fields |

### Vendors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/vendors` | List vendor profiles by total spend |
| GET | `/vendors/{id}` | Vendor detail + recent invoices |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | List active team members (owner only) |

### Audit
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit?user_id=` | Filter by team member |
| GET | `/audit?invoice_id=` | Pin to a single invoice (used from invoice detail deep link) |
| GET | `/audit?invoice_search=` | Filter by vendor name or invoice number (human-readable search) |
| GET | `/audit?action=` | Filter by action type |
| GET | `/audit?date_from=` / `date_to=` | Filter by date range |

**Enriched audit response fields:** `user_name`, `user_role`, `invoice_label`

**Audit UI filtering (no UUID typing required):**
- User dropdown populated from `GET /users`
- Vendor / invoice number search via `invoice_search`
- Date range pickers
- Click a user name in the table to filter by that user
- Click "Filter this invoice" on a row to pin that invoice
- Deep link from invoice detail: `/audit?invoice_id={id}&invoice_label={vendor}`

---

## New Frontend Pages

| Route | Access | Purpose |
|-------|--------|---------|
| `/vendors` | All users | Vendor spend directory |
| `/vendors/:id` | All users | Vendor detail + invoice history |
| `/team` | Owner | Invite staff, set permissions |
| `/settings` | All (edit: owner) | Company settings |
| `/export` | Owner or `can_export` | Download approved invoices CSV |
| `/audit?invoice_id=` | Owner | Filtered audit from invoice detail |

**Navigation:** Layout updated with Vendors, Export, Team, Audit, Settings links.

---

## Backend Service Changes

### `invoice_service.py`
- `get_invoices()` joins `ExtractedData` and `User` for dashboard display
- `update_line_items()` — replace line items with audit log `line_items_edited`
- `re_extract_invoice()` — deletes extracted data + line items, resets status, queues Celery task
- `update_invoice_metadata()` — category, tags, payment fields

### `vendor_service.py` (new)
- List and detail queries for `VendorProfile`

### `extraction_service.py`
- Sets `is_recurring_vendor = true` when vendor has 3+ invoices

### `exports.py`
- Uses enriched invoice list for CSV rows
- Logs `exported` action to audit trail

### `audit.py`
- Enriches log entries with user names and invoice vendor labels

---

## New Audit Actions

| Action | Trigger |
|--------|---------|
| `line_items_edited` | PUT `/invoices/{id}/line-items` |
| `re_extract_requested` | POST `/invoices/{id}/re-extract` |
| `invoice_metadata_edited` | PATCH `/invoices/{id}` |
| `exported` | GET `/exports/invoices` |

---

## Files Changed

### Backend
- `app/schemas/invoice.py` — `InvoiceListItemResponse`, `InvoiceMetadataUpdate`
- `app/schemas/line_item.py` — new
- `app/schemas/vendor.py` — new
- `app/schemas/audit_log.py` — enriched fields
- `app/schemas/user.py` — `UserListResponse`
- `app/services/invoice_service.py`
- `app/services/vendor_service.py` — new
- `app/services/extraction_service.py`
- `app/api/routes/invoices.py`
- `app/api/routes/vendors.py` — new
- `app/api/routes/audit.py`
- `app/api/routes/users.py`
- `app/api/routes/exports.py`
- `app/main.py`

### Frontend
- `src/services/api.js`
- `src/App.jsx`
- `src/components/Layout.jsx`
- `src/pages/Dashboard.jsx`
- `src/pages/InvoiceDetail.jsx`
- `src/pages/Audit.jsx`
- `src/pages/Upload.jsx`
- `src/pages/Login.jsx`
- `src/pages/Settings.jsx` — new
- `src/pages/Team.jsx` — new
- `src/pages/Vendors.jsx` — new
- `src/pages/VendorDetail.jsx` — new
- `src/pages/Export.jsx` — new

---

## Phase 1 Polish (completed)

| Item | Description |
|------|-------------|
| Dashboard date filters | `date_from` / `date_to` pickers on invoice list |
| Invoice metadata UI | Edit category, tags, payment status/date/ref on detail page |
| Payment fields in API | `payment_status`, `payment_date`, `payment_ref` on `InvoiceResponse` |
| Inline activity history | Owner can toggle per-invoice history panel on detail page |
| Delete invoice | Owner delete button on detail page |
| Line total mismatch warning | Amber alert when line items sum ≠ invoice total |
| Low confidence hint | Flags extraction confidence below 80% |
| Re-extract guard | Warns if invoice was manually edited before re-running AI |
| Audit expandable details | Click "Show details" for formatted `extra_data` JSON |
| Audit human-friendly filters | User dropdown, vendor/invoice search, date range, click-to-filter from rows |

---

## Verification Checklist

1. **Dashboard** — rows show vendor name and total; search finds invoices by vendor; date range filters work
2. **Invoice detail** — edit extracted fields, line items, and metadata (category/tags/payment); re-extract on failure
3. **Audit** — user names, invoice links, expandable details; filter by user, vendor search, date range, or click-to-pin invoice
4. **Vendors** — list appears after extractions; detail shows recent invoices
5. **Team** (owner) — invite staff; toggle can_approve / can_export
6. **Settings** — save currency and timezone
7. **Export** — download CSV; audit log shows `exported` entry
8. **Upload** — add tags; edit tags later on detail page

---

## Phase 2

See **[phase-2.md](./phase-2.md)** — email notifications, staff invite emails, password change, forced first-login password update.

### Tenant currency reporting

See **[currency-reporting.md](./currency-reporting.md)** — dashboard and vendor totals in tenant default currency, FX via invoice issue date, originals on invoice detail only.

---

## Still Out of Scope (Phase 2B+)

- Email verification and forgot-password flows
- Stripe/billing and plan enforcement
- Payment-date FX reconciliation when marking invoices paid
- PostgreSQL RLS policies in migrations
- Custom tenant-defined categories
- Automated tests
