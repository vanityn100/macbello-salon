# Permanent GST Rate Fix (Global)

## Goal
Implement a centralized, fail-proof GST rate engine that derives tax rates exclusively from item categories and normalizes all historical data to strict `5` or `18` integers. Completely eliminate all ad-hoc multiplication, division, and incorrect formatting (`500%`, `0.05`) across the UI, APIs, PDFs, and Excel exports.

## User Review Required
> [!IMPORTANT]
> The prompt mandates: "Determine GST only from the product type" and "Store GST internally only as 5 or 18". 
> To calculate financial totals in the engine (e.g. `taxAmount = base * (rate / 100)`), division by 100 is mathematically required if the stored value is an integer `5` or `18`. 
> I will ensure the *UI and formatting* layer never performs raw math on these values, relying on a centralized `formatGst()` string renderer, but the calculation engine must still divide the integer by 100 internally to produce the correct financial totals. Let me know if this is approved.

## Proposed Changes

### `src/lib/gst.ts`
Create a centralized GST normalization and formatting engine:
#### [NEW] `src/lib/gst.ts`
- `normalizeGst(rate: any, category?: string): number` - Sanitizes any incoming tax rate to exactly `5` or `18`.
- `formatGst(rate: any, category?: string): string` - Renders the normalized value cleanly as `"5%"` or `"18%"`.
- `getDecimalGst(rate: any, category?: string): number` - Returns the sanitized rate as a decimal (0.05 or 0.18) strictly for internal financial calculations (so that `base * decimal` is fail-proof).

---
### `src/lib/invoiceUtils.ts`
Refactor the internal calculation engine to enforce the new centralized normalization logic.
#### [MODIFY] `src/lib/invoiceUtils.ts`
- Replace the legacy `parseTaxRate` with `getDecimalGst` imported from `src/lib/gst.ts`.
- Ensure all incoming `tax_rate` fields are forcefully sanitized before being used to calculate base amounts and GST totals.

---
### UI and Exports
Refactor all display layers to eliminate inline multiplication (e.g., `tax_rate * 100 + "%"`) and point them to the central formatter.

#### [MODIFY] `src/staff/billing/page.tsx`
- Replace `{(item.tax_rate * 100)}%` with `formatGst(item.tax_rate, item.category)`.
- Replace `{(item.tax_rate * 50).toFixed(1)}% CGST` with deterministic logic based on the normalized `5` or `18` integer.

#### [MODIFY] `src/app/admin/inventory/route.ts` & `src/app/api/billing/admin/route.ts`
- Remove dynamic label generation (`(rawRate > 1 ? rawRate : rawRate * 100).toFixed(0) + "%"`).
- Standardize all API JSON payloads to include the raw normalized integer (`5` or `18`) and the display label (`"5%"` or `"18%"`).
- Intercept any invoice creation `POST` requests and forcefully coerce `tax_rate` to the normalized integer (`5` or `18`) before saving to the database.

#### [MODIFY] `src/lib/pdf.ts`
- Replace inline text rendering `${(item.tax_rate * 100).toFixed(0)}%` with `formatGst(item.tax_rate)`.

#### [MODIFY] `src/components/catalogue/CatalogueManager.tsx`
- Refactor item rendering to use `formatGst()` instead of `(item.tax_rate * 100)`.

## Verification Plan
### Automated Tests
- Run `npm test` to verify `src/__tests__/invoiceUtils.test.ts` still perfectly balances GST-inclusive invoices using the new normalization engine.

### Manual Verification
- Render the `AdminInventoryPage` and Excel Export to verify no `500%` or `1800%` anomalies exist.
- Perform a simulated checkout via POS to verify `5` or `18` is exactly what saves to the database.
