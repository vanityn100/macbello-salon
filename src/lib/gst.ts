/**
 * Permanent GST Engine (Fail-Proof)
 * This centralized utility strictly enforces the 5% (Service) and 18% (Retail) GST rules.
 * No other module may implement its own GST percentage calculation, multiplication, or display rendering.
 */

import productMasterRaw from './productMaster.json';

// Typecast the JSON so TypeScript knows its structure
const productMaster: Record<string, { hsn: string, gstRate: number | null }> = productMasterRaw as any;

/**
 * Normalizes any historical or incoming GST rate into the exact integer 5 or 18.
 * Rejects or coerces any invalid anomalies (0.05, 1800, etc.).
 * If the rate is completely empty, derives it from the category.
 */
export function normalizeGst(rate: any, category?: string | null): number {
  let num: number | null = null;
  
  if (rate !== undefined && rate !== null && rate !== "") {
    if (typeof rate === 'string') {
      // Strip out '%', spaces, or other non-numeric chars except decimal
      num = parseFloat(rate.replace(/[^0-9.]/g, ''));
    } else {
      num = Number(rate);
    }
  }

  if (num !== null && !isNaN(num)) {
    // Detect variations of 5%
    if (num === 5 || num === 0.05 || num === 500 || num === 5000) return 5;
    // Detect variations of 18%
    if (num === 18 || num === 0.18 || num === 1800 || num === 18000) return 18;
  }

  // If we reach here, the rate was either empty, undefined, or an invalid number (like 999).
  // Fallback to strict category determination if category is provided.
  if (category) {
    const isRetail = category.toLowerCase().includes("retail") || category.toLowerCase().includes("product");
    return isRetail ? 18 : 5;
  }

  // If there's no category to fallback on, throw a hard validation error.
  throw new Error(`Validation Error: GST rate must be exactly 5 or 18. Received: ${rate}`);
}

/**
 * Renders the GST rate for any UI, PDF, Excel, or Report.
 * Guarantees exactly "5%" or "18%". Never outputs "500%" or "0.05%".
 */
export function formatGst(rate: any, category?: string | null): string {
  try {
    const validRate = normalizeGst(rate, category);
    return `${validRate}%`;
  } catch (err) {
    return "5%";
  }
}

/**
 * Provides the mathematical decimal (0.05 or 0.18) strictly for financial calculations.
 * E.g., taxAmount = baseAmount * getDecimalGst(rate)
 */
export function getDecimalGst(rate: any, category?: string | null): number {
  return normalizeGst(rate, category) / 100;
}

/**
 * Centralized GST & HSN Engine
 * Returns authoritative tax info for any item, prioritizing the Product Master for Retail
 * and strict fallbacks for Service.
 */
export function getTaxInfo(item: any): { isService: boolean, hsn: string, gstRate: number, gstLabel: string, gstDecimal: number } {
  const rawCategory = item.category || "Service";
  const isService = rawCategory.toLowerCase().includes("service") || rawCategory === "Service";

  let finalHsn = "Unassigned";
  let gstRate: any = null;

  if (isService) {
    finalHsn = item.hsn ? String(item.hsn) : "999729";
    gstRate = (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") ? item.tax_rate : 5;
  } else {
    // Retail Item
    const itemName = String(item.item_name || item.name || "").trim().toUpperCase();
    const prod = productMaster[itemName];

    if (item.hsn) {
      finalHsn = String(item.hsn);
    } else if (prod && prod.hsn) {
      finalHsn = String(prod.hsn);
    }

    if (item.tax_rate !== undefined && item.tax_rate !== null && item.tax_rate !== "") {
      gstRate = item.tax_rate;
    } else if (prod && prod.gstRate !== undefined && prod.gstRate !== null) {
      gstRate = prod.gstRate;
    } else {
      throw new Error(`Validation Error: Missing GST for product ${itemName}`);
    }
  }

  const normalizedRate = normalizeGst(gstRate, item.category);

  return {
    isService,
    hsn: finalHsn,
    gstRate: normalizedRate,
    gstLabel: `${normalizedRate}%`,
    gstDecimal: normalizedRate / 100
  };
}
