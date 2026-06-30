import { getTaxInfo } from './gst';

export interface InvoiceItemInput {
  category?: string | null;
  quantity: number;
  unit_price: number;
  tax_rate: string | number | null;
}

export interface InvoiceCalculationResult {
  subtotal: number;
  service_base: number;
  retail_base: number;
  service_inclusive: number;
  retail_inclusive: number;
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

  let gstIncludedTotal = 0;

  // First pass: Calculate Total GST-Inclusive amount
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price"); // GST-Inclusive
    if (qty === 0) {
       throw new Error("Validation Error: Item quantity must be greater than zero.");
    }
    gstIncludedTotal += (qty * price);
  }

  // Calculate proportional discount factor against the GST-Inclusive total
  let proportion = 1;
  const totalDeductions = cleanManualDiscount + cleanPointsRedeemed;
  if (gstIncludedTotal > 0 && totalDeductions > 0) {
    proportion = 1 - (totalDeductions / gstIncludedTotal);
    if (proportion < 0) {
      throw new Error(`Validation Error: Total deductions (${totalDeductions}) exceed total GST-inclusive amount (${gstIncludedTotal}).`);
    }
  }

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;
  let serviceBase = 0;
  let retailBase = 0;
  let serviceInclusive = 0;
  let retailInclusive = 0;
  const items_breakdown = [];

  // Second pass: Calculate Base Amount and GST per item after discount
  for (const item of items) {
    const qty = validateNumeric(item.quantity, "quantity");
    const price = validateNumeric(item.unit_price, "unit_price");
    const taxRate = getTaxInfo(item).gstDecimal;

    const originalInclusive = qty * price;
    const discountedInclusive = originalInclusive * proportion;
    
    // Base Price is extracted from the discounted inclusive amount
    const discountedBase = discountedInclusive / (1 + taxRate);
    const taxAmount = discountedInclusive - discountedBase;

    items_breakdown.push({
      baseAmount: parseFloat(discountedBase.toFixed(2)),
      taxAmount: parseFloat(taxAmount.toFixed(2)),
      discountedLineTotal: parseFloat(discountedInclusive.toFixed(2))
    });

    subtotal += discountedBase;
    
    const category = (item.category || 'Service').toLowerCase();
    if (category === 'service') {
      serviceTax += taxAmount;
      serviceBase += discountedBase;
      serviceInclusive += discountedInclusive;
    } else {
      retailTax += taxAmount;
      retailBase += discountedBase;
      retailInclusive += discountedInclusive;
    }
  }

  const totalTax = serviceTax + retailTax;
  
  // Grand Total is strictly GST Included Total - Manual Discount - Loyalty Redemption
  const grandTotal = gstIncludedTotal - cleanManualDiscount - cleanPointsRedeemed;

  const pointsEarned = Math.floor(grandTotal / 100);

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    service_base: parseFloat(serviceBase.toFixed(2)),
    retail_base: parseFloat(retailBase.toFixed(2)),
    service_inclusive: parseFloat(serviceInclusive.toFixed(2)),
    retail_inclusive: parseFloat(retailInclusive.toFixed(2)),
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
