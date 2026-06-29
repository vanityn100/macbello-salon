# Macbello GST-Inclusive Billing Engine Implementation Plan

The official Macbello billing rule states that all catalogue prices are **GST-Inclusive**, and manual discounts/loyalty points are deducted from the **Taxable Base Amount**, not the gross amount.

## OFFICIAL MACBELLO BILLING RULE
This rule is mandatory throughout the entire application.

### Pricing
* All catalogue prices are GST Inclusive.
* Services use 5% GST.
* Retail products use 18% GST.

### Manual Discount
When staff enters a discount:
Example: Catalogue Price (GST Included): ₹600
Step 1: Extract the taxable (base) amount. ₹600 ÷ 1.05 = ₹571.43
Step 2: Apply the staff discount to the base amount. ₹571.43 − ₹60 = ₹511.43
Step 3: Recalculate GST. GST (5%) = ₹25.57
Step 4: Final Invoice Amount ₹511.43 + ₹25.57 = ₹537.00

### Loyalty Points
Loyalty redemption follows the **exact same process** as a manual discount.
If both manual discount and loyalty redemption exist:
New Base = Original Base − Manual Discount − Loyalty Redemption
Then calculate GST on the remaining base.

### Mandatory Rules
This calculation engine must be used everywhere:
Billing, Checkout, Invoice Creation, Invoice Editing, Invoice Preview, PDF, Excel Export, GST Reports, GSTR-1, Dashboard, Sales Reports, APIs, Future Features.
No module may implement its own calculation.

### Future Proof
If any future feature is added (coupon, wallet, membership, cashback, promotional discount, etc.), it must follow this exact calculation flow.
No duplicate financial formulas are allowed anywhere in the project.

### Safety
* Do not break existing functionality.
* Do not change the UI.
* Do not change user workflows.
* Do not block legitimate invoices.
* Do not allow inconsistent calculations.
* Use one shared billing engine everywhere.

# Permanent Fail-Proof Inventory Architecture

This implementation must be treated as a core business rule and must never be changed by future updates.

## Inventory Principles
- There is only ONE source of inventory.
- Every product has one Current Stock value.
- Current Stock changes ONLY through inventory movements.
- Invoice history is permanent and must never be modified by inventory operations.

## How Stock Changes
Current Stock may change ONLY through these operations:
1. Owner receives new stock.
2. Owner manually adjusts stock.
3. Warehouse transfers stock to a branch.
4. Billing (sale to customer).
5. Invoice cancellation/return.
6. Stock correction approved by the owner.
No other feature may modify Current Stock.

## Billing & Operations
- **Receiving Stock:** Only Owner/Admin can receive stock. (Movement Type = STOCK_IN)
- **Billing:** When a retail product is successfully billed, Current Stock decreases by Sold Quantity automatically. Staff must never adjust inventory manually for sales.
- **Invoice Edit:** Reduce/increase stock by only the difference.
- **Invoice Cancellation:** Restore the sold quantity back into stock.
- **Services:** Salon services must NEVER affect inventory. Only retail products reduce stock.

## Sold Quantity & Revenue
- Sold must NEVER be stored permanently.
- Sold is always calculated dynamically: `Sold = SUM(invoice_items.quantity)` for the selected date range.
- Revenue is always calculated from invoice history. Never calculate Revenue from inventory.
- Invoice history is the only source of truth.

## Inventory Reset
- Reset Inventory affects ONLY Current Stock.
- Reset Inventory must NEVER delete invoices, modify Sold, modify Revenue, or modify invoice history.

## Safety & Integrity
- **Negative Stock Protection:** If Requested Quantity > Current Stock, reject the invoice. Never allow negative stock.
- **Atomic Transactions:** Billing must execute inside one database transaction (Create Invoice -> Create Invoice Items -> Reduce Stock). If any step fails, rollback everything.
- **Audit Log:** Every stock movement must be recorded (Date, Product, Quantity, Branch, User, Movement Type). Movement Types: STOCK_IN, SALE, RETURN, ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT. Never delete audit records.
- **Multi-Branch Rules:** Each branch owns its own stock. A sale at a branch reduces only that branch's stock. Branches must never modify each other's inventory.

## Future-Proof Rules
Future updates must NEVER:
- Modify Sold manually.
- Modify Revenue manually.
- Modify invoice history.
- Bypass inventory transactions.
- Directly edit stock during billing.
Every new feature must use the existing inventory movement system.

# Inventory Integrity Rules (Permanent)

These rules are mandatory and take precedence over any future feature implementation.

## Single Source of Truth
- There must be only one implementation that updates inventory.
- All billing operations must call the same inventory service/function.
- Future developers must never duplicate stock deduction logic.

## Stock Modification Rules
Current Stock may ONLY change through:
- Receive Stock
- Billing Sale
- Invoice Edit
- Invoice Cancellation/Return
- Manual Stock Adjustment (Owner/Admin only)
- Branch Transfer
No other API, page, migration, or background job may modify Current Stock.

## Billing Rules
- Stock deduction must occur only after a successful invoice transaction.
- If billing fails, stock must remain unchanged.
- If stock update fails, the invoice must not be created.
- Invoice and stock updates must always succeed or fail together.

## Reports
- Sold and Revenue must always be calculated from invoice history.
- Inventory reports, dashboards, exports, analytics, and future reports must all use the same shared calculation function.
- No report may implement its own Sold calculation.

## Development Restrictions
Future code must NOT:
- Manually update Sold.
- Store Sold in the database.
- Store Revenue in the database.
- Directly edit Current Stock from the UI without using the inventory service.
- Create another inventory calculation function.
There must always be a single shared inventory engine.

## Validation
Every pull request or future update must preserve these behaviors:
- [x] Receiving stock increases Current Stock.
- [x] Billing decreases Current Stock.
- [x] Invoice cancellation restores Current Stock.
- [x] Sold always equals the sum of invoice quantities.
- [x] Revenue always equals the sum of invoice totals.
- [x] Stock never becomes negative.
- [x] Inventory page, reports, and exports always display identical values.

If any of these validations fail, the change must be rejected.
