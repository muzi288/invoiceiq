# InvoiceIQ — Currency & FX Reporting

How multi-currency invoices are displayed across the app.

---

## Summary

Each tenant sets a **default currency** in **Settings** (e.g. ZAR). List and summary views convert foreign invoices into that currency. **Invoice detail** always shows the original extracted currency and amounts.

---

## Where amounts are converted

| Screen | Currency shown | Original currency |
|--------|----------------|-------------------|
| Dashboard (invoice list) | Tenant default | Only on invoice detail |
| Vendors list | Tenant default | Only on invoice detail |
| Vendor detail (totals + recent invoices) | Tenant default | Only on invoice detail |
| Invoice detail | **Original** (as on the document) | Always visible here |
| CSV export | Original | Unchanged |

---

## FX rate source

- **API:** [Frankfurter](https://api.frankfurter.dev) (free, no API key)
- **Service:** `backend/app/services/currency_service.py`
- Rates are cached for 6 hours per currency pair and date.

---

## Which date’s exchange rate?

Reporting uses the **invoice issue date** (`invoice_date` from AI extraction).

| Field | Used for |
|-------|----------|
| `invoice_date` | Primary — rate on the day the invoice was issued |
| `upload_date` | Fallback if issue date is missing |
| `payment_date` | **Not used** for display totals today |

### Why issue date, not payment date?

- **Reporting / spend totals:** Accrual accounting — you record the expense when the invoice is issued, at that day’s rate.
- **What you owe:** The legal amount on the invoice (e.g. USD 100) never changes.
- **When you pay:** Your bank may use a different rate. The difference is a separate FX gain/loss at payment time — not a change to the invoice itself.

**Example:** Invoice issued 1 Jan: USD 100 @ 18 = **ZAR 1,800** on reports. Paid 1 Mar @ 19 = bank debits **ZAR 1,900**. Reports still show ZAR 1,800; the extra ZAR 100 is a payment-time FX difference.

Phase 2B may add optional payment-amount tracking at payment date for bank reconciliation.

---

## API fields

### Invoice list (`GET /invoices`)

| Field | Meaning |
|-------|---------|
| `tenant_currency` | Tenant default (top-level on response) |
| `display_amount` | Converted total in tenant currency |
| `display_currency` | Same as tenant currency |
| `amount_converted` | `true` if FX was applied |
| `total_amount` / `currency` | Original extracted values (for detail/export) |

### Vendor list & detail (`GET /vendors`, `GET /vendors/{id}`)

| Field | Meaning |
|-------|---------|
| `tenant_currency` | Tenant default |
| `display_total_spend` | Sum of invoices converted to tenant currency |
| `display_average_invoice` | Average in tenant currency |
| `display_currency` | Tenant default |

Vendor totals are **recomputed from invoices** on each request (not the raw `vendor_profiles.total_spend` column, which mixed currencies incorrectly).

---

## Edge cases

- **Same currency as tenant:** No conversion; `amount_converted` is `false`.
- **FX unavailable** (unsupported currency pair): List views omit the amount; open invoice detail for the original figure.
- **Multi-currency line items:** Header total is converted using the invoice-level currency.

---

## Files

| File | Role |
|------|------|
| `services/currency_service.py` | FX fetch, cache, convert |
| `services/invoice_service.py` | Dashboard list enrichment |
| `services/vendor_service.py` | Vendor spend recomputation |
| `schemas/invoice.py`, `schemas/vendor.py` | Response fields |
| `frontend/.../Dashboard.jsx` | Display tenant amounts |
| `frontend/.../Vendors.jsx`, `VendorDetail.jsx` | Display tenant amounts |
