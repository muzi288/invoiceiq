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
| GET | `/audit?invoice_id=` | Filter audit log by invoice |

**Enriched audit response fields:** `user_name`, `user_role`, `invoice_label`

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

## Verification Checklist

1. **Dashboard** — rows show vendor name and total; search finds invoices by vendor
2. **Invoice detail** — edit all extracted fields; edit line items; click Re-extract on failed invoice
3. **Audit** — shows user names; click invoice link opens detail; filter by invoice ID
4. **Vendors** — list appears after extractions; detail shows recent invoices
5. **Team** (owner) — invite staff; toggle can_approve / can_export
6. **Settings** — save currency and timezone
7. **Export** — download CSV; check audit log for `exported` entry
8. **Upload** — add tags; verify they appear on invoice detail header

---

## Still Out of Scope (Phase 2+)

- Email delivery for invites and notifications (`notify_on_*` stored but not sent)
- Stripe/billing and plan enforcement
- Password change / email verification flow
- PostgreSQL RLS policies in migrations
- Payment status UI on invoice detail
- Custom tenant-defined categories
- Automated tests
