# Fix Services Check Constraint Implementation Plan

The error `new row for relation "services" violates check constraint "services_status_check"` happens when an API sends a status value that PostgreSQL rejects. 

To permanently and centrally fix this without altering core logic, I propose the following plan.

## User Review Required
> [!IMPORTANT]
> The database check constraint strictly enforces: `active`, `archived`, `ACTIVE`, `LOW STOCK`, `OUT OF STOCK`, `ARCHIVED`. 
> I will add a centralized validation utility at the application layer to intercept all inserts/updates to the `services` table. 

## Proposed Changes

### 1. `src/lib/validations/serviceStatus.ts`
#### [NEW] [serviceStatus.ts](file:///C:/Users/adoni/Documents/ADONIS/Antigravity/src/lib/validations/serviceStatus.ts)
Create a centralized validator that will:
1. Accept the intended status, current stock, and minimum stock.
2. If `status` is missing, auto-calculate it:
   - `stock <= 0` → `OUT OF STOCK`
   - `stock <= min_stock` → `LOW STOCK`
   - Otherwise → `active`
3. If `status` is provided but invalid, throw a specific `InvalidStatusError` to be caught by the API.

### 2. `src/app/api/inventory/route.ts`
#### [MODIFY] [route.ts](file:///C:/Users/adoni/Documents/ADONIS/Antigravity/src/app/api/inventory/route.ts)
Intercept all `services` table modifications:
- **Line 116 (Create Retail Product):** Calculate the status using the validator before inserting. Log the payload. Catch `InvalidStatusError` and return a user-friendly `400 Bad Request`.
- **Line 230 (Update Status):** Validate `newStatus` using the centralized function before applying the update. Log the payload.
- **Line 265 (Update Total Received):** Since this doesn't change status, we don't strictly need to inject status here, but we will ensure we don't accidentally pass an invalid one.

### 3. `src/app/api/billing/admin/route.ts`
#### [MODIFY] [route.ts](file:///C:/Users/adoni/Documents/ADONIS/Antigravity/src/app/api/billing/admin/route.ts)
- **Line 613 (Create Catalogue Item):** Apply the centralized validator to enforce a valid default status (`active`). Log the payload before insert.
- **Line 686 (Edit Catalogue Item):** If editing involves status or stock changes, pass it through the validator.
- **Line 738 (Archive Catalogue Item):** Apply the validator for `"archived"`.

## Verification Plan
1. Test creating a product without a status to ensure it auto-calculates to `OUT OF STOCK` (since stock is 0).
2. Test sending an explicitly invalid status (e.g., "foo") via the API to verify it returns a 400 error instead of a 500 DB crash.
