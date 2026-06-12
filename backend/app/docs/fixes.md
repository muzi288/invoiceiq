# InvoiceIQ — Fixes, Known Issues & Technical Debt

## Table of Contents
1. [Resolved Fixes](#resolved-fixes)
2. [Product Upgrades](#product-upgrades)
3. [Known Issues](#known-issues)
4. [Technical Debt](#technical-debt)

---

## Resolved Fixes

### FIX-001 — Ambiguous Foreign Keys on User.invoices Relationship
**Date:** June 2026
**Error:** `AmbiguousForeignKeysError: Could not determine join condition between users and invoices`
**Cause:** The invoices table has two foreign keys pointing to users — uploaded_by and deleted_by. SQLAlchemy could not determine which one to use for the User.invoices relationship.
**Fix:** Added `foreign_keys="[Invoice.uploaded_by]"` to the relationship definition in user.py to explicitly tell SQLAlchemy which foreign key to use.
**File:** `backend/app/models/user.py`

---

### FIX-002 — bcrypt and passlib Version Incompatibility
**Date:** June 2026
**Error:** `AttributeError: module 'bcrypt' has no attribute '__about__'` and `ValueError: password cannot be longer than 72 bytes`
**Cause:** passlib 1.7.4 is incompatible with bcrypt 4.x. passlib's internal bug detection code calls bcrypt with a string longer than 72 bytes, which bcrypt 4.x rejects strictly.
**Fix:** Pinned bcrypt to 3.2.2 which is compatible with passlib 1.7.4. Also added [:72] truncation in hash_password and verify_password as a defensive measure.
**File:** `backend/requirements.txt`, `backend/app/core/security.py`
**Note:** Long term fix is to replace passlib with direct bcrypt usage or migrate to argon2-cffi.

---

### FIX-003 — Circular Import in extracted_data Schema
**Date:** June 2026
**Error:** `NameError: name 'InvoiceResponse' is not defined`
**Cause:** InvoiceWithDataResponse used InvoiceResponse before it was imported. The import was placed at the bottom of the file as a circular import workaround but Python reads top to bottom — InvoiceResponse didn't exist when the class was being defined.
**Fix:** Moved `from app.schemas.invoice import InvoiceResponse` to the top of extracted_data.py. The circular import concern was unfounded — invoice.py does not import from extracted_data.py.
**File:** `backend/app/schemas/extracted_data.py`

---

### FIX-004 — Missing is_recurring Field in ExtractedDataResponse
**Date:** June 2026
**Error:** Field existed in SQLAlchemy model but was missing from Pydantic response schema.
**Fix:** Added `is_recurring: bool` to ExtractedDataResponse after is_multi_currency.
**File:** `backend/app/schemas/extracted_data.py`

---

## FIX-005 — asyncpg Does Not Support Parameterized SET Statements
**Date:** June 2026
**Error:** `PostgresSyntaxError: syntax error at or near "$1"` on `SET app.tenant_id = $1`
**Cause:** asyncpg does not support parameterized SET statements. SET is a session configuration command, not a data query, and asyncpg refuses parameter substitution for it.
**Fix:** Embedded the tenant_id UUID directly into the SQL string using an f-string: `text(f"SET app.tenant_id = '{tenant_id}'")`
**Safety:** tenant_id is a UUID extracted from a signed JWT token — not raw user input. UUIDs contain only hex characters and hyphens, making SQL injection impossible here.
**File:** `backend/app/core/dependencies.py`

---

### FIX-006 — Invoice Detail Could Not Show Original Document Side-by-Side
**Date:** June 2026
**Symptom:** On the invoice detail page, users could not view the original invoice document alongside extracted data. PDFs showed only a placeholder with an external link; images loaded via Azure SAS URLs often failed to render in the app.
**Cause:** Three related issues:
1. **PDFs were not embedded** — the frontend rendered a static placeholder instead of an inline viewer for `file_type === 'pdf'`.
2. **SAS URLs cannot carry JWT auth** — `<iframe>` and `<img>` tags cannot send the `Authorization` header, so direct Azure blob URLs are unreliable for in-app viewing and may fail due to CORS or expired tokens.
3. **TanStack Query v5 `refetchInterval` bug** — the polling callback received the `query` object, not invoice data, so extraction status polling never stopped correctly.

**Fix:**
- **Backend:** Added `GET /invoices/{invoice_id}/file` to stream the original file through the authenticated API. Added `download_file()` in `storage_service.py`. Wrapped `generate_signed_url()` in try/except so a storage error does not break the entire invoice detail response.
- **Frontend:** Fetches the file via `getInvoiceFile()` with JWT auth, creates a blob URL with `URL.createObjectURL()`, and embeds PDFs in an `<iframe>` and images in an `<img>`. Improved layout with a taller viewer (`min-h-[70vh]`) and a sticky left panel on large screens.
- **Frontend:** Corrected `refetchInterval` to read `query.state.data?.invoice?.extraction_status`.

**Files:** `backend/app/api/routes/invoices.py`, `backend/app/services/invoice_service.py`, `backend/app/services/storage_service.py`, `frontend/src/pages/InvoiceDetail.jsx`, `frontend/src/services/api.js`

**Verification:** Open any completed invoice on the detail page. The original document should appear on the left; extracted data and line items on the right. Check Network tab for `GET /invoices/{id}/file` returning `200` with the correct `Content-Type` (`application/pdf`, `image/jpeg`, or `image/png`).

---

## Product Upgrades

See **[product-upgrades.md](./product-upgrades.md)** for the full SaaS Phase 1 changelog covering:

- Dashboard vendor names, totals, search, and category filters
- Line item editing and re-extraction
- Enriched audit log with user names and invoice links
- Vendor profiles UI
- Team, Settings, and Export pages
- Upload tags support

---

## Known Issues

_(None documented yet — add items here as they are discovered.)_

---

## Technical Debt

_(See product-upgrades.md "Still Out of Scope" for planned Phase 2 work.)_


