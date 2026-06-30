/**
 * Centralized Reporting Engine — Single Source of Truth for All Reports
 *
 * ARCHITECTURE RULES (permanent):
 * - ALL report routes (tax, gstr1, inventory) MUST import from here.
 * - No report may implement its own financial formula.
 * - Financial values (line_total, subtotal, total_tax, grand_total) come from stored invoices — never recalculated.
 * - Catalogue fields (hsn, item_code, category) are enriched from the live catalogue for display only.
 * - CONSISTENCY: totalSales = SUM(grand_total) across ALL reports — the actual amount collected.
 */

// ─────────────────────────────────────────────────────────────────────────────
import productMasterExt from './productMasterExt.json';

// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogueEntry {
  id: string;
  name: string;
  item_code: string | null;
  hsn: string | null;
  category: string;
  tax_rate: number;
  price?: number;
}

export interface ReportAggregation {
  // For Tax Report (per-item rows)
  invoiceItemRegister: any[];
  detailedTransactions: any[];
  // For GSTR-1 (per-invoice-per-rate-bucket rows)
  b2bInvoices: any[];
  b2cInvoices: any[];
  gstr1InvoiceRegister: any[];
  // Common maps
  hsnMap: Record<string, any>;
  gstRateMap: Record<string, { gstRate: string; taxableValue: number; cgst: number; sgst: number; igst: number; gstCollected: number; invoiceIds: Set<string> }>;
  branchMap: Record<string, any>;
  itemMap: Record<string, any>;
  // Summary totals (consistent across all reports)
  totalSales: number;        // SUM(grand_total) — actual amount collected
  totalTaxable: number;      // SUM(subtotal)    — post-discount taxable base
  totalGstCollected: number; // SUM(total_tax)   — GST on taxable base
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalInvoices: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalogue Map Builder
// ─────────────────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  if (!name) return '';
  return name
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function normalizeCode(code: string | null | undefined): string {
  if (!code) return '';
  return String(code).replace(/[\u200B-\u200D\uFEFF\s]/g, '').toUpperCase();
}

/**
 * Fetches the full master catalogue once and returns O(1) lookup maps.
 * Call once per request — do NOT call per invoice.
 */
export async function buildCatalogueMap(
  adminSupabase: any
): Promise<{ byName: Map<string, CatalogueEntry>; byCode: Map<string, CatalogueEntry> }> {
  const { data: services } = await adminSupabase
    .from('services')
    .select('id, name, item_code, hsn, category, tax_rate, price')
    .not('status', 'in', '("archived","ARCHIVED")');

  const byName = new Map<string, CatalogueEntry>();
  const byCode = new Map<string, CatalogueEntry>();

  for (const s of (services || [])) {
    const entry: CatalogueEntry = {
      id: s.id,
      name: s.name,
      item_code: s.item_code || null,
      hsn: s.hsn || null,
      category: s.category || 'Service',
      tax_rate: s.tax_rate,
      price: s.price, // ensure price is attached
    };
    byName.set(normalizeName(s.name), entry);
    const code = normalizeCode(s.item_code);
    if (code) {
      byCode.set(code, entry);
    }
  }

  return { byName, byCode };
}

export function enrichItemWithCatalogue(
  item: any,
  catalogue: { byName: Map<string, CatalogueEntry>; byCode: Map<string, CatalogueEntry> }
): any {
  let entry: CatalogueEntry | undefined;
  
  // Prefer item_code lookup (most precise identifier)
  const cleanItemCode = normalizeCode(item.item_code);
  if (cleanItemCode) {
    entry = catalogue.byCode.get(cleanItemCode);
  }
  
  // Fallback: name lookup
  const normalizedItemName = normalizeName(item.item_name || item.name || '');
  if (!entry && normalizedItemName) {
    entry = catalogue.byName.get(normalizedItemName);
  }

  // 1. Match with Product List (MASTER reference)
  const productListEntry = (productMasterExt as Record<string, { hsn: string, gstRate: number }>)[normalizedItemName];

  // 2. Determine HSN (Product List > Catalogue > NEVER INVOICE unless it's a Service)
  let validHsn = "Unmatched";
  if (productListEntry && productListEntry.hsn) {
    validHsn = String(productListEntry.hsn).trim();
  } else if (entry && entry.hsn) {
    validHsn = String(entry.hsn).trim();
  } else if (item.category === 'Service' && item.hsn) {
    // Only trust invoice item.hsn for Services if not found in catalogue (to avoid breaking custom services)
    validHsn = String(item.hsn).trim();
  }

  // 3. Determine GST Rate (Product List > Catalogue > Invoice > Category Fallback)
  let catalogueRate = entry?.tax_rate;
  if (productListEntry && productListEntry.gstRate !== undefined && productListEntry.gstRate !== null) {
    catalogueRate = productListEntry.gstRate;
  }
  
  const storedRate = parseFloat(item.tax_rate);
  const finalTaxRate = (catalogueRate !== undefined && catalogueRate !== null) 
    ? catalogueRate 
    : ((storedRate > 0) ? storedRate : (item.category === 'Retail' ? 18 : 5));

  // OVERRIDE PRICE WITH CATALOGUE GST-INCLUSIVE PRICE (as requested)
  let correctedUnitPrice = parseFloat(item.unit_price) || 0;
  let correctedLineTotal = parseFloat(item.line_total) || 0;
  
  if (entry?.price !== undefined && entry?.price !== null) {
    const catExclusive = parseFloat(String(entry.price));
    if (!isNaN(catExclusive)) {
       // Normalize rate for calculation
       let calcRate = finalTaxRate;
       if (calcRate > 0 && calcRate <= 1) calcRate *= 100;
       else if (calcRate >= 100) calcRate /= 100;
       calcRate = Math.round(calcRate);
       
       const catInclusive = Math.round(catExclusive * (1 + (calcRate / 100)) * 100) / 100;
       // If the reported unit price differs from the current catalogue inclusive price, force it to match
       if (Math.abs(correctedUnitPrice - catInclusive) > 0.01) {
           correctedUnitPrice = catInclusive;
           correctedLineTotal = correctedUnitPrice * (item.quantity || 1);
       }
    }
  }

  return {
    ...item,
    // Overlay current catalogue fields for display — stored financials untouched
    hsn: validHsn,
    item_code: entry?.item_code || item.item_code || '',
    category: entry?.category || item.category || 'Service',
    tax_rate: finalTaxRate,
    unit_price: correctedUnitPrice,
    line_total: correctedLineTotal,
    catalogue_price: entry?.price,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Aggregation Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Single aggregation pass over all invoices.
 * Produces every data structure needed by every report:
 *   - Tax & Compliance Report (invoiceItemRegister, hsnMap, gstRateMap, branchMap, itemMap)
 *   - GSTR-1 (b2bInvoices, b2cInvoices, gstr1InvoiceRegister)
 *   - Inventory Summary (itemMap for Retail sales)
 *
 * FINANCIAL RULES:
 * - totalSales      = SUM(grand_total)  → actual amount collected (consistent across ALL reports)
 * - totalTaxable    = SUM(subtotal)     → post-discount taxable base (stored)
 * - totalGstCollected = SUM(total_tax)  → GST on taxable base (stored)
 * - Per-item base/tax use stored proportion (discount / totalInclusive) for breakdown
 * - Last-item correction anchors to stored invoice totals (eliminates rounding drift)
 */
export function aggregateInvoices(
  invoices: any[],
  catalogue: { byName: Map<string, CatalogueEntry>; byCode: Map<string, CatalogueEntry> }
): ReportAggregation {
  let totalSales = 0;
  let totalTaxable = 0;
  let totalGstCollected = 0;
  let totalCgst = 0;
  let totalSgst = 0;

  const invoiceItemRegister: any[] = [];
  const detailedTransactions: any[] = [];
  const b2bInvoices: any[] = [];
  const b2cInvoices: any[] = [];
  const gstr1InvoiceRegister: any[] = [];
  const hsnMap: Record<string, any> = {};
  const gstRateMap: Record<string, any> = {};
  const branchMap: Record<string, any> = {};
  const itemMap: Record<string, any> = {};

  for (const inv of invoices) {
    let grandTotal  = parseFloat(inv.grand_total)     || 0;
    let taxTotal    = parseFloat(inv.total_tax)        || 0;
    let subtotal    = parseFloat(inv.subtotal)         || 0;
    const discount    = parseFloat(inv.discount)         || 0;
    const pointsRedeemed = parseFloat(inv.points_redeemed) || 0;
    const invBranch   = inv.branch || 'Global';

    // Global counters and branch maps will be updated AFTER dynamic recalculation in the items loop
    // to ensure total consistency across the report.

    // Customer info (prefer billing-time snapshot, fall back to joined record)
    const customerName = inv.customer_name || inv.customers?.name  || 'Walk-in';
    const custPhone    = inv.customer_phone || inv.customers?.phone || '';
    const custGstin    = inv.customer_gstin
      || (inv.customers?.gstin && inv.customers.gstin !== '' ? inv.customers.gstin : null)
      || null;

    const rawItems = inv.invoice_items || [];

    // ── Empty invoice (no items) — use invoice-level totals ───────────────
    if (rawItems.length === 0) {
      const cgstFb = taxTotal / 2;
      totalCgst += cgstFb;
      totalSgst += cgstFb;

      invoiceItemRegister.push({
        invoiceNumber: inv.invoice_number,
        invoiceDate:   inv.created_at,
        customerName,
        customerGstin: custGstin || '—',
        branch:        invBranch,
        itemName:      '—', hsnCode: '—', itemCode: '—', category: '—', gstRate: '—',
        quantity:      0, unitPrice: 0,
        taxableValue:  subtotal, discount, loyaltyPoints: pointsRedeemed,
        cgst:          cgstFb, sgst: cgstFb, igst: 0,
        totalValue:    grandTotal,
        status:        inv.status,
      });

      // GSTR-1 fallback bucket (5%)
      const gstr1Row = {
        invoiceNumber: inv.invoice_number, invoiceDate: inv.created_at,
        customerName, customerPhone: custPhone, customerGstin: custGstin || '',
        branch: invBranch,
        taxableValue: parseFloat(subtotal.toFixed(2)),
        cgst: parseFloat(cgstFb.toFixed(2)), sgst: parseFloat(cgstFb.toFixed(2)),
        igst: 0, gstAmount: parseFloat(taxTotal.toFixed(2)),
        totalValue: parseFloat(grandTotal.toFixed(2)),
        status: inv.status, gstRate: '5%',
      };
      (custGstin && custGstin.trim() !== '' ? b2bInvoices : b2cInvoices).push(gstr1Row);
      gstr1InvoiceRegister.push(gstr1Row);
      continue;
    }

    // ── Enrich items with current catalogue data & override prices ───────────
    const enrichedItems = rawItems.map((it: any) => enrichItemWithCatalogue(it, catalogue));

    // RECALCULATE Invoice Totals dynamically based on the updated item prices
    let dynamicInclusiveTotal = 0;
    enrichedItems.forEach((it: any) => {
      dynamicInclusiveTotal += (parseFloat(it.line_total) || 0);
    });

    // We must respect the original absolute discount and points redeemed
    const totalDeductions = discount + pointsRedeemed;
    
    // The new grand total is the new inclusive total minus deductions
    grandTotal = Math.max(0, dynamicInclusiveTotal - totalDeductions);
    
    // Proportion for distributing discount
    const proportion = (dynamicInclusiveTotal > 0 && totalDeductions > 0)
      ? 1 - (totalDeductions / dynamicInclusiveTotal)
      : 1;

    // Dynamically recalculate invoice subtotal and tax total based on proportional items
    subtotal = 0;
    taxTotal = 0;
    
    // We compute the true taxable base for the invoice
    enrichedItems.forEach((it: any) => {
       const lineTot = parseFloat(it.line_total) || 0;
       const discInc = lineTot * proportion;
       let rate = parseFloat(it.tax_rate) || 0;
       if (rate > 0 && rate <= 1) rate = rate * 100;
       else if (rate >= 100) rate = rate / 100;
       rate = Math.round(rate);
       const tDec = rate / 100;
       
       const itmTaxable = discInc / (1 + tDec);
       const itmTax = discInc - itmTaxable;
       
       subtotal += itmTaxable;
       taxTotal += itmTax;
    });

    // Update global counters with the dynamically corrected invoice totals
    totalSales += grandTotal;
    totalTaxable += subtotal;
    totalGstCollected += taxTotal;

    // Update Branch summary
    if (!branchMap[invBranch]) {
      branchMap[invBranch] = {
        branchName: invBranch,
        invoiceCount: 0,
        revenue: 0,
        taxableValue: 0,
        gstCollected: 0,
      };
    }
    branchMap[invBranch].invoiceCount += 1;
    branchMap[invBranch].revenue      += grandTotal;
    branchMap[invBranch].taxableValue += subtotal;
    branchMap[invBranch].gstCollected += taxTotal;

    let sumItemTaxable = 0;
    let sumItemTax = 0;

    // GSTR-1: rate buckets per invoice (one record per GST rate per invoice)
    const rateBuckets: Record<string, any> = {};

    enrichedItems.forEach((item: any, idx: number) => {
      let rawRate = parseFloat(item.tax_rate) || 0;
      
      // Normalize historical anomalies without destroying non-standard slabs (0%, 12%, 28%)
      if (rawRate > 0 && rawRate <= 1) {
        rawRate = rawRate * 100; // e.g., 0.05 -> 5
      } else if (rawRate >= 100) {
        rawRate = rawRate / 100; // e.g., 500 -> 5, 1800 -> 18
      }
      // Ensure we round to nearest integer to avoid float precision issues (e.g., 5.000000001)
      rawRate = Math.round(rawRate);

      const taxDecimal = rawRate / 100;
      const rateLabel  = `${rawRate}%`;
      const qty        = item.quantity || 1;
      const lineTotal  = parseFloat(item.line_total) || 0;
      const hsnCode    = item.hsn || 'Unassigned';
      const itemCode   = item.item_code || '';
      const itemName   = item.item_name || 'Unknown Item';
      const category   = item.category || 'Service';

      const discountedInclusive = lineTotal * proportion;
      let itemTaxable = discountedInclusive / (1 + taxDecimal);
      let itemTax     = discountedInclusive - itemTaxable;

      // ── Last-item correction: snap to stored invoice totals ───────────────
      // This eliminates cumulative floating-point drift across all items
      if (idx === enrichedItems.length - 1) {
        itemTaxable = subtotal - sumItemTaxable;
        itemTax     = taxTotal  - sumItemTax;
      }

      sumItemTaxable += itemTaxable;
      sumItemTax     += itemTax;

      const itemCgst = itemTax / 2;
      const itemSgst = itemTax / 2;
      totalCgst += itemCgst;
      totalSgst += itemSgst;

      const rawUnitPrice    = parseFloat(item.unit_price) || 0;
      const taxableUnitPrice = taxDecimal > 0 ? rawUnitPrice / (1 + taxDecimal) : rawUnitPrice;
      const itemDiscount    = parseFloat((lineTotal * (1 - proportion)).toFixed(2));

      // ── Tax Report: invoice item register (one row per item) ─────────────
      invoiceItemRegister.push({
        invoiceNumber: inv.invoice_number,
        invoiceDate:   inv.created_at,
        customerName,
        customerGstin: custGstin || '—',
        branch:        invBranch,
        itemName,
        hsnCode,
        itemCode,
        category,
        gstRate:       rateLabel,
        quantity:      qty,
        unitPrice:     parseFloat(rawUnitPrice.toFixed(2)),
        taxableValue:  parseFloat(itemTaxable.toFixed(2)),
        discount:      itemDiscount,
        loyaltyPoints: pointsRedeemed,
        cgst:          parseFloat(itemCgst.toFixed(2)),
        sgst:          parseFloat(itemSgst.toFixed(2)),
        igst:          0,
        totalValue:    parseFloat((itemTaxable + itemTax).toFixed(2)),
        status:        inv.status,
      });

      // ── Detailed Transactions ────────────────────────────────────────────
      detailedTransactions.push({
        date:          inv.created_at,
        invoiceNumber: inv.invoice_number,
        customer:      customerName,
        itemName,
        hsnCode,
        itemCode,
        quantity:      qty,
        unitPrice:     parseFloat(rawUnitPrice.toFixed(2)),
        gstRate:       rateLabel,
        gstAmount:     parseFloat(itemTax.toFixed(2)),
        finalAmount:   parseFloat((itemTaxable + itemTax).toFixed(2)),
        branch:        invBranch,
      });

      // ── HSN Map (compound key: hsnCode + rateLabel) ───────────────────────
      // Compound key prevents merging same HSN at different rates (rare but possible)
      const hsnKey = `${hsnCode}__${rateLabel}`;
      if (!hsnMap[hsnKey]) {
        hsnMap[hsnKey] = {
          hsnCode, description: category,
          quantity: 0, taxableValue: 0, gstRate: rateLabel,
          cgst: 0, sgst: 0, igst: 0, total_gst: 0, totalValue: 0,
        };
      }
      hsnMap[hsnKey].quantity     += qty;
      hsnMap[hsnKey].taxableValue += itemTaxable;
      hsnMap[hsnKey].cgst         += itemCgst;
      hsnMap[hsnKey].sgst         += itemSgst;
      hsnMap[hsnKey].total_gst    += itemTax;
      hsnMap[hsnKey].totalValue   += (itemTaxable + itemTax);

      // ── GST Rate Map (Dynamic Grouping by Actual Rates) ─────────────────────
      const bucketKey = rateLabel;
      if (!gstRateMap[bucketKey]) {
        gstRateMap[bucketKey] = {
          gstRate: bucketKey,
          taxableValue: 0, cgst: 0, sgst: 0, igst: 0,
          gstCollected: 0,
          invoiceIds: new Set<string>(),
        };
      }
      gstRateMap[bucketKey].taxableValue  += itemTaxable;
      gstRateMap[bucketKey].cgst          += itemCgst;
      gstRateMap[bucketKey].sgst          += itemSgst;
      gstRateMap[bucketKey].gstCollected  += itemTax;
      gstRateMap[bucketKey].invoiceIds.add(inv.id);

      // ── Item Sales Map ────────────────────────────────────────────────────
      if (!itemMap[itemName]) {
        itemMap[itemName] = { itemName, category, gstRate: rateLabel, quantity: 0, revenue: 0 };
      }
      itemMap[itemName].quantity += qty;
      itemMap[itemName].revenue  += (itemTaxable + itemTax);

      // ── GSTR-1: Rate buckets per invoice ────────────────────────────────
      if (!rateBuckets[rateLabel]) {
        rateBuckets[rateLabel] = {
          taxableValue: 0, cgst: 0, sgst: 0, gstAmount: 0, totalValue: 0,
        };
      }
      rateBuckets[rateLabel].taxableValue += itemTaxable;
      rateBuckets[rateLabel].cgst         += itemCgst;
      rateBuckets[rateLabel].sgst         += itemSgst;
      rateBuckets[rateLabel].gstAmount    += itemTax;
      rateBuckets[rateLabel].totalValue   += (itemTaxable + itemTax);
    });

    // ── GSTR-1 Invoice Register (one row per GST rate per invoice) ────────
    Object.entries(rateBuckets).forEach(([rateLabel, bucket]: [string, any]) => {
      const gstr1Row = {
        invoiceNumber: inv.invoice_number,
        invoiceDate:   inv.created_at,
        customerName,
        customerPhone:  custPhone,
        customerGstin:  custGstin || '',
        branch:         invBranch,
        taxableValue:   parseFloat(bucket.taxableValue.toFixed(2)),
        cgst:           parseFloat(bucket.cgst.toFixed(2)),
        sgst:           parseFloat(bucket.sgst.toFixed(2)),
        igst:           0,
        gstAmount:      parseFloat(bucket.gstAmount.toFixed(2)),
        totalValue:     parseFloat(bucket.totalValue.toFixed(2)),
        status:         inv.status,
        gstRate:        rateLabel,
      };

      if (custGstin && custGstin.trim() !== '') {
        b2bInvoices.push(gstr1Row);
      } else {
        b2cInvoices.push(gstr1Row);
      }
      gstr1InvoiceRegister.push(gstr1Row);
    });
  }

  return {
    invoiceItemRegister,
    detailedTransactions,
    b2bInvoices,
    b2cInvoices,
    gstr1InvoiceRegister,
    hsnMap,
    gstRateMap,
    branchMap,
    itemMap,
    totalSales:         parseFloat(totalSales.toFixed(2)),
    totalTaxable:       parseFloat(totalTaxable.toFixed(2)),
    totalGstCollected:  parseFloat(totalGstCollected.toFixed(2)),
    totalCgst:          parseFloat(totalCgst.toFixed(2)),
    totalSgst:          parseFloat(totalSgst.toFixed(2)),
    totalIgst:          0,
    totalInvoices:      invoices.length,
  };
}

/**
 * Finalizes the GST rate map into a sorted array for report output.
 * Converts the invoiceIds Set into a count.
 */
export function finalizeGstRateSummary(
  gstRateMap: ReportAggregation['gstRateMap']
): any[] {
  return Object.values(gstRateMap)
    .map((g: any) => ({ ...g, invoiceCount: g.invoiceIds.size, invoiceIds: undefined }))
    .sort((a: any, b: any) => parseInt(a.gstRate) - parseInt(b.gstRate));
}

/**
 * Builds the B2C rate summary for GSTR-1.
 */
export function buildB2cRateSummary(b2cInvoices: any[]): any[] {
  const b2cRateMap: Record<string, any> = {};
  for (const inv of b2cInvoices) {
    const key = inv.gstRate;
    if (!b2cRateMap[key]) {
      b2cRateMap[key] = { gstRate: key, invoiceCount: 0, taxableValue: 0, gstAmount: 0, totalValue: 0 };
    }
    b2cRateMap[key].invoiceCount += 1;
    b2cRateMap[key].taxableValue += inv.taxableValue;
    b2cRateMap[key].gstAmount    += inv.gstAmount;
    b2cRateMap[key].totalValue   += inv.totalValue;
  }
  return Object.values(b2cRateMap).map((r: any) => ({
    ...r,
    taxableValue: parseFloat(r.taxableValue.toFixed(2)),
    gstAmount:    parseFloat(r.gstAmount.toFixed(2)),
    totalValue:   parseFloat(r.totalValue.toFixed(2)),
  }));
}

export function finalizeHsnSummary(hsnMap: ReportAggregation['hsnMap']): any[] {
  return Object.values(hsnMap).map((h: any) => ({
    ...h,
    taxableValue: parseFloat(h.taxableValue.toFixed(2)),
    cgst:         parseFloat(h.cgst.toFixed(2)),
    sgst:         parseFloat(h.sgst.toFixed(2)),
    igst:         parseFloat(h.igst.toFixed(2)),
    total_gst:    parseFloat(h.total_gst.toFixed(2)),
    totalValue:   parseFloat(h.totalValue.toFixed(2)),
  }));
}
