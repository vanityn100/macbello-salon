export interface InvoiceItemInput {
  category?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: string | number | null;
}

export interface InvoiceCalculationResult {
  subtotal: number;
  service_tax: number;
  retail_tax: number;
  total_tax: number;
  discount: number;
  points_redeemed: number;
  grand_total: number;
}

/**
 * Single source of truth for all invoice calculations.
 * @param items Array of line items
 * @param manualDiscount Manual discount amount (in INR)
 * @param pointsRedeemed Loyalty points redeemed (in INR)
 * @returns Object with mathematically sound totals
 */
export function recalculateInvoiceTotals(
  items: InvoiceItemInput[],
  manualDiscount: number = 0,
  pointsRedeemed: number = 0
): InvoiceCalculationResult {
  // Defensive Input Validation
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Validation Error: Invoice must contain at least one line item.");
  }

  const validateNumeric = (val: any, fieldName: string, allowNegative = false) => {
    const num = Number(val);
    if (Number.isNaN(num) || !Number.isFinite(num)) {
      throw new Error(`Validation Error: Invalid numeric value for ${fieldName} (${val}).`);
    }
    if (!allowNegative && num < 0) {
      throw new Error(`Validation Error: ${fieldName} cannot be negative (${val}).`);
    }
    return num;
  };

  const cleanManualDiscount = validateNumeric(manualDiscount, "manualDiscount");
  const cleanPointsRedeemed = validateNumeric(pointsRedeemed, "pointsRedeemed");

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;

  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price");
    
    // Enforce integers for quantities if needed, but at minimum > 0
    if (qty === 0) {
       throw new Error("Validation Error: Item quantity must be greater than zero.");
    }

    const lineTotal = qty * price;
    
    // Parse tax_rate carefully
    let taxRate = 0;
    if (typeof item.tax_rate === 'string' && item.tax_rate.trim() !== '') {
      taxRate = validateNumeric(parseFloat(item.tax_rate), "tax_rate");
    } else if (typeof item.tax_rate === 'number') {
      taxRate = validateNumeric(item.tax_rate, "tax_rate");
    }

    const tax = lineTotal * taxRate;

    subtotal += lineTotal;
    if (item.category === "Service") {
      serviceTax += tax;
    } else {
      retailTax += tax;
    }
  }

  const totalTax = serviceTax + retailTax;
  const preDiscountTotal = subtotal + totalTax;
  const totalDiscount = cleanManualDiscount + cleanPointsRedeemed;

  let grandTotal = preDiscountTotal - totalDiscount;
  if (grandTotal < 0) {
     // User request: No guessing, but business rule says loyalty points shouldn't exceed total.
     // If they do, they are likely just capping the total. 
     // For strict compliance: "Never silently ignore errors or automatically guess financial values."
     // If discount > total, throw error.
     throw new Error(`Validation Error: Total discount (${totalDiscount}) exceeds pre-discount total (${preDiscountTotal}).`);
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
