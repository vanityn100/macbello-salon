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
