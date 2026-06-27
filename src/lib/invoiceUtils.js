"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recalculateInvoiceTotals = recalculateInvoiceTotals;
/**
 * Single source of truth for all invoice calculations.
 * @param items Array of line items
 * @param manualDiscount Manual discount amount (in INR)
 * @param pointsRedeemed Loyalty points redeemed (in INR)
 * @returns Object with mathematically sound totals
 */
function recalculateInvoiceTotals(items, manualDiscount, pointsRedeemed) {
    if (manualDiscount === void 0) { manualDiscount = 0; }
    if (pointsRedeemed === void 0) { pointsRedeemed = 0; }
    // Defensive Input Validation
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error("Validation Error: Invoice must contain at least one line item.");
    }
    var validateNumeric = function (val, fieldName, allowNegative) {
        if (allowNegative === void 0) { allowNegative = false; }
        var num = Number(val);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
            throw new Error("Validation Error: Invalid numeric value for ".concat(fieldName, " (").concat(val, ")."));
        }
        if (!allowNegative && num < 0) {
            throw new Error("Validation Error: ".concat(fieldName, " cannot be negative (").concat(val, ")."));
        }
        return num;
    };
    var cleanManualDiscount = validateNumeric(manualDiscount, "manualDiscount");
    var cleanPointsRedeemed = validateNumeric(pointsRedeemed, "pointsRedeemed");
    var subtotal = 0;
    var serviceTax = 0;
    var retailTax = 0;
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var item = items_1[_i];
        var qty = validateNumeric(item.quantity, "quantity");
        var price = validateNumeric(item.unit_price, "unit_price");
        // Enforce integers for quantities if needed, but at minimum > 0
        if (qty === 0) {
            throw new Error("Validation Error: Item quantity must be greater than zero.");
        }
        var lineTotal = qty * price;
        // Parse tax_rate carefully
        var taxRate = 0;
        if (typeof item.tax_rate === 'string' && item.tax_rate.trim() !== '') {
            taxRate = validateNumeric(parseFloat(item.tax_rate), "tax_rate");
        }
        else if (typeof item.tax_rate === 'number') {
            taxRate = validateNumeric(item.tax_rate, "tax_rate");
        }
        var tax = lineTotal * taxRate;
        subtotal += lineTotal;
        if (item.category === "Service") {
            serviceTax += tax;
        }
        else {
            retailTax += tax;
        }
    }
    var totalTax = serviceTax + retailTax;
    var preDiscountTotal = subtotal + totalTax;
    var totalDiscount = cleanManualDiscount + cleanPointsRedeemed;
    var grandTotal = preDiscountTotal - totalDiscount;
    if (grandTotal < 0) {
        // User request: No guessing, but business rule says loyalty points shouldn't exceed total.
        // If they do, they are likely just capping the total. 
        // For strict compliance: "Never silently ignore errors or automatically guess financial values."
        // If discount > total, throw error.
        throw new Error("Validation Error: Total discount (".concat(totalDiscount, ") exceeds pre-discount total (").concat(preDiscountTotal, ")."));
    }
    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        service_tax: parseFloat(serviceTax.toFixed(2)),
        retail_tax: parseFloat(retailTax.toFixed(2)),
        total_tax: parseFloat(totalTax.toFixed(2)),
        discount: parseFloat(cleanManualDiscount.toFixed(2)),
        points_redeemed: parseFloat(cleanPointsRedeemed.toFixed(2)),
        grand_total: parseFloat(grandTotal.toFixed(2)),
    };
}
