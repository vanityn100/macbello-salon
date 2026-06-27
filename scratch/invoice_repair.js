const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function recalculateInvoiceTotals(items, manualDiscount = 0, pointsRedeemed = 0) {
  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;

  for (const item of items) {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unit_price) || 0);
    const lineTotal = qty * price;
    
    let taxRate = 0;
    if (typeof item.tax_rate === 'string') {
      taxRate = parseFloat(item.tax_rate) || 0;
    } else if (typeof item.tax_rate === 'number') {
      taxRate = item.tax_rate;
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
  const totalDiscount = (Number(manualDiscount) || 0) + (Number(pointsRedeemed) || 0);

  let grandTotal = preDiscountTotal - totalDiscount;
  if (grandTotal < 0) grandTotal = 0;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    service_tax: parseFloat(serviceTax.toFixed(2)),
    retail_tax: parseFloat(retailTax.toFixed(2)),
    total_tax: parseFloat(totalTax.toFixed(2)),
    discount: parseFloat((Number(manualDiscount) || 0).toFixed(2)),
    points_redeemed: parseFloat((Number(pointsRedeemed) || 0).toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2)),
  };
}

async function runRepairPreview() {
  console.log("=========================================");
  console.log("   INVOICE REPAIR PREVIEW (NO WRITES)  ");
  console.log("=========================================\n");

  const isWriteMode = process.argv.includes('--execute');

  // Fetch all exported GSTR1 report IDs to avoid touching finalized invoices
  const { data: logs, error: logErr } = await supabase
    .from('audit_logs')
    .select('details')
    .like('action', 'gstr1_export_%');

  if (logErr) throw logErr;

  const exportedRanges = [];
  logs.forEach(l => {
    // details: `Report MB-GSTR1... | Period: 2026-06-01 to 2026-06-30 | Branch...`
    const match = l.details.match(/Period: (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    if (match) exportedRanges.push({ start: match[1], end: match[2] });
  });

  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select(`
      id, invoice_number, created_at, status, branch,
      subtotal, service_tax, retail_tax, total_tax, discount, points_redeemed, grand_total,
      invoice_items (item_name, category, quantity, unit_price, tax_rate, line_total)
    `);

  if (invErr) throw invErr;

  let totalScanned = 0;
  let totalAnomalies = 0;
  let totalExceptions = 0;
  const toFix = [];

  for (const inv of invoices) {
    if (inv.status === 'archived' || inv.status === 'cancelled') continue;
    
    totalScanned++;
    const items = inv.invoice_items || [];
    const computed = recalculateInvoiceTotals(items, inv.discount, inv.points_redeemed);

    // Check if there is any mismatch in core financial fields
    const hasMismatch = (
      Math.abs(computed.subtotal - parseFloat(inv.subtotal || 0)) > 0.05 ||
      Math.abs(computed.total_tax - parseFloat(inv.total_tax || 0)) > 0.05 ||
      Math.abs(computed.grand_total - parseFloat(inv.grand_total || 0)) > 0.05
    );

    if (hasMismatch) {
      // Check if it falls in an exported GSTR-1 period
      const invDateStr = new Date(inv.created_at).toISOString().slice(0, 10);
      let isExported = false;
      for (const r of exportedRanges) {
        if (invDateStr >= r.start && invDateStr <= r.end) {
          isExported = true; break;
        }
      }

      console.log(`[MISMATCH] Invoice: ${inv.invoice_number} (ID: ${inv.id})`);
      console.log(`   - Stored:   Subtotal Rs.${inv.subtotal}, Tax Rs.${inv.total_tax}, Grand Total Rs.${inv.grand_total}`);
      console.log(`   - Computed: Subtotal Rs.${computed.subtotal}, Tax Rs.${computed.total_tax}, Grand Total Rs.${computed.grand_total}`);
      
      if (isExported) {
        console.log(`   🚨 EXCEPTION: This invoice falls within an exported GSTR-1 period (${invDateStr}). Cannot safely repair automatically.`);
        totalExceptions++;
      } else {
        totalAnomalies++;
        toFix.push({ invoice: inv, computed });
      }
      console.log("-----------------------------------------");
    }
  }

  console.log(`\nSUMMARY: Scanned ${totalScanned} active invoices.`);
  console.log(`Found ${totalAnomalies} correctable anomalies and ${totalExceptions} locked exceptions.`);

  if (isWriteMode && toFix.length > 0) {
    console.log(`\nExecuting repairs for ${toFix.length} invoices...`);
    for (const fix of toFix) {
      const { invoice, computed } = fix;
      
      const { error: updErr } = await supabase
        .from('invoices')
        .update({
          subtotal: computed.subtotal,
          service_tax: computed.service_tax,
          retail_tax: computed.retail_tax,
          total_tax: computed.total_tax,
          grand_total: computed.grand_total
        })
        .eq('id', invoice.id);
        
      if (updErr) {
        console.error(`Failed to update ${invoice.invoice_number}:`, updErr.message);
        continue;
      }

      await supabase.from('audit_logs').insert({
        user_id: 'system_repair_script',
        role: 'system',
        branch: invoice.branch || 'Global',
        action: 'repair_invoice_totals',
        details: `Repaired ${invoice.invoice_number}. Old Total: ${invoice.grand_total}, New Total: ${computed.grand_total}. Reason: Calculation drift.`,
      });
      console.log(`✅ Repaired ${invoice.invoice_number}`);
    }
    console.log("Repair complete.");
  } else if (!isWriteMode && toFix.length > 0) {
    console.log(`\nTo execute these repairs, run this script with the --execute flag.`);
  }
}

runRepairPreview().catch(console.error);
