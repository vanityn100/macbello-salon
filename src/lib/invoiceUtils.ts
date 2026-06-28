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
  points_earned: number;
  items_breakdown?: Array<{
    baseAmount: number;
    taxAmount: number;
    discountedLineTotal: number;
  }>;
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
  
  const parseTaxRate = (rate: any) => {
    let taxRate = 0;
    if (typeof rate === 'string' && rate.trim() !== '') {
      taxRate = validateNumeric(parseFloat(rate), "tax_rate");
    } else if (typeof rate === 'number') {
      taxRate = validateNumeric(rate, "tax_rate");
    }
    if (taxRate > 1) {
      taxRate = taxRate / 100;
    }
    return taxRate;
  };

  const cleanManualDiscount = validateNumeric(manualDiscount, "manualDiscount");
  const cleanPointsRedeemed = validateNumeric(pointsRedeemed, "pointsRedeemed");
  const totalDiscount = cleanManualDiscount + cleanPointsRedeemed;

  let totalBase = 0;

  // First pass: Calculate Total Taxable Base
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price"); // GST-Inclusive
    if (qty === 0) {
       throw new Error("Validation Error: Item quantity must be greater than zero.");
    }
    const taxRate = parseTaxRate(item.tax_rate);
    const originalBase = (qty * price) / (1 + taxRate);
    totalBase += originalBase;
  }

  // Calculate proportional discount factor against the BASE
  let proportion = 1;
  if (totalBase > 0 && totalDiscount > 0) {
    proportion = 1 - (totalDiscount / totalBase);
    if (proportion < 0) {
      throw new Error(`Validation Error: Total discount (${totalDiscount}) exceeds total taxable base (${totalBase}).`);
    }
  }

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;
  const items_breakdown = [];

  // Second pass: Calculate Base Amount and GST per item
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price");
    const taxRate = parseTaxRate(item.tax_rate);

    const originalBase = (qty * price) / (1 + taxRate);
    const discountedBase = originalBase * proportion;
    const taxAmount = discountedBase * taxRate;
    
    // The line total shown in breakdowns should reflect the inclusive amount after discount
    const discountedLineTotal = discountedBase + taxAmount;

    items_breakdown.push({
      baseAmount: parseFloat(discountedBase.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      discountedLineTotal: parseFloat(discountedLineTotal.toFixed(2))
    });

    subtotal += discountedBase;
    
    const category = (item.category || 'Service').toLowerCase();
    if (category === 'service') {
      serviceTax += taxAmount;
    } else {
      retailTax += taxAmount;
    }
  }

  const totalTax = serviceTax + retailTax;
  const grandTotal = subtotal + totalTax;

  const pointsEarned = Math.floor(grandTotal / 10);

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    service_tax: parseFloat(serviceTax.toFixed(2)),
    retail_tax: parseFloat(retailTax.toFixed(2)),
    total_tax: parseFloat(totalTax.toFixed(2)),
    discount: parseFloat(cleanManualDiscount.toFixed(2)),
    points_redeemed: parseFloat(cleanPointsRedeemed.toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2)),
    points_earned: pointsEarned,
    items_breakdown
  };
}
