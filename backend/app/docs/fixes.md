# InvoiceIQ — Fixes, Known Issues & Technical Debt

## Table of Contents
1. [Resolved Fixes](#resolved-fixes)
2. [Known Issues](#known-issues)
3. [Technical Debt](#technical-debt)

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


