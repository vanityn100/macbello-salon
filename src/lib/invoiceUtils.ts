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

  const cleanManualDiscount = validateNumeric(manualDiscount, "manualDiscount");
  const cleanPointsRedeemed = validateNumeric(pointsRedeemed, "pointsRedeemed");
  const totalDiscount = cleanManualDiscount + cleanPointsRedeemed;

  let totalLineTotal = 0;

  // First pass: Calculate total selling price (Gross)
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price");
    if (qty === 0) {
       throw new Error("Validation Error: Item quantity must be greater than zero.");
    }
    totalLineTotal += (qty * price);
  }

  // Calculate proportional discount factor
  let proportion = 1;
  if (totalLineTotal > 0 && totalDiscount > 0) {
    proportion = 1 - (totalDiscount / totalLineTotal);
    if (proportion < 0) {
      throw new Error(`Validation Error: Total discount (${totalDiscount}) exceeds total payable (${totalLineTotal}).`);
    }
  }

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;
  const items_breakdown = [];

  // Second pass: Calculate Base Amount and GST proportionally
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price");
    
    // Parse tax_rate carefully (handles "5" or "0.05")
    let taxRate = 0;
    if (typeof item.tax_rate === 'string' && item.tax_rate.trim() !== '') {
      taxRate = validateNumeric(parseFloat(item.tax_rate), "tax_rate");
    } else if (typeof item.tax_rate === 'number') {
      taxRate = validateNumeric(item.tax_rate, "tax_rate");
    }
    if (taxRate > 1) {
      taxRate = taxRate / 100;
    }

    const lineTotal = qty * price;
    const discountedLineTotal = lineTotal * proportion;
    
    // Base amount is the discounted line total (since unit_price is GST-exclusive)
    const baseAmount = discountedLineTotal;
    const taxAmount = baseAmount * taxRate;

    items_breakdown.push({
      baseAmount: parseFloat(baseAmount.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      discountedLineTotal: parseFloat(discountedLineTotal.toFixed(2))
    });

    subtotal += baseAmount;
    
    const category = (item.category || 'Service').toLowerCase();
    if (category === 'service') {
      serviceTax += taxAmount;
    } else {
      retailTax += taxAmount;
    }
  }

  const totalTax = serviceTax + retailTax;
  // Grand total is strictly the sum of Base + Tax across all discounted items
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
