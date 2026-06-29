const fs = require('fs');
const envFile = fs.readFileSync('C:/Users/adoni/Documents/ADONIS/Antigravity/.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  envVars['NEXT_PUBLIC_SUPABASE_URL'],
  envVars['SUPABASE_SERVICE_ROLE_KEY']
);

function recalculateTotalsGSTInclusive(items, manualDiscount = 0, pointsRedeemed = 0) {
  const totalDiscount = manualDiscount + pointsRedeemed;
  let totalLineTotal = 0;

  for (const item of items) {
    const qty = parseInt(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    totalLineTotal += (qty * price);
  }

  // Calculate proportional discount
  let proportion = 1;
  if (totalLineTotal > 0 && totalDiscount > 0) {
    proportion = 1 - (totalDiscount / totalLineTotal);
    // Don't allow negative proportion
    if (proportion < 0) proportion = 0;
  }

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;

  for (const item of items) {
    const qty = parseInt(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    
    // Some tax rates in historical data were imported as '5' or '18' instead of '0.05'
    let taxRate = parseFloat(item.tax_rate) || 0;
    if (taxRate > 1) {
      taxRate = taxRate / 100;
    }

    const lineTotal = qty * price;
    const discountedLineTotal = lineTotal * proportion;
    
    // Base amount after discount
    const baseAmount = discountedLineTotal / (1 + taxRate);
    const taxAmount = discountedLineTotal - baseAmount;

    subtotal += baseAmount;
    
    const category = (item.category || 'Service').toLowerCase();
    if (category === 'service') {
      serviceTax += taxAmount;
    } else {
      retailTax += taxAmount;
    }
  }

  const totalTax = serviceTax + retailTax;
  const grandTotal = subtotal + totalTax;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    service_tax: parseFloat(serviceTax.toFixed(2)),
    retail_tax: parseFloat(retailTax.toFixed(2)),
    total_tax: parseFloat(totalTax.toFixed(2)),
    discount: parseFloat(manualDiscount.toFixed(2)),
    points_redeemed: parseFloat(pointsRedeemed.toFixed(2)),
    grand_total: parseFloat(grandTotal.toFixed(2))
  };
}

async function run() {
  console.log("Fetching all invoices and items...");
  
  // Need to paginate if more than 1000
  let allInvoices = [];
  let hasMore = true;
  let from = 0;
  const limit = 1000;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .range(from, from + limit - 1);
      
    if (error) {
      console.error("Error fetching invoices:", error);
      return;
    }
    
    if (data && data.length > 0) {
      allInvoices = allInvoices.concat(data);
      from += limit;
    } else {
      hasMore = false;
    }
  }
  
  console.log(`Fetched ${allInvoices.length} invoices. Validating...`);
  
  let mismatches = [];
  let perfectlyMatched = 0;

  for (const inv of allInvoices) {
    if (!inv.invoice_items || inv.invoice_items.length === 0) continue;
    
    const manualDiscount = parseFloat(inv.discount) || 0;
    const pointsRedeemed = parseFloat(inv.points_redeemed) || 0;
    
    const computed = recalculateTotalsGSTInclusive(inv.invoice_items, manualDiscount, pointsRedeemed);
    
    const storedGrandTotal = parseFloat(inv.grand_total) || 0;
    const storedTotalTax = parseFloat(inv.total_tax) || 0;
    const storedSubtotal = parseFloat(inv.subtotal) || 0;
    
    const diffGrandTotal = Math.abs(computed.grand_total - storedGrandTotal);
    const diffTotalTax = Math.abs(computed.total_tax - storedTotalTax);
    
    // We consider it a mismatch if the difference is more than 0.05 rupees (5 paise) due to rounding
    if (diffGrandTotal > 0.05 || diffTotalTax > 0.05) {
      mismatches.push({
        invoice_number: inv.invoice_number,
        invoice_id: inv.id,
        stored: {
          grand_total: storedGrandTotal,
          total_tax: storedTotalTax,
          subtotal: storedSubtotal
        },
        computed: computed,
        diff_grand_total: diffGrandTotal.toFixed(2),
        diff_total_tax: diffTotalTax.toFixed(2),
        reason: diffGrandTotal > 0.05 ? "Grand Total Mismatch" : "Tax Mismatch"
      });
    } else {
      perfectlyMatched++;
    }
  }
  
  console.log(`Validation complete. ${perfectlyMatched} invoices perfectly match the new engine.`);
  console.log(`Found ${mismatches.length} mismatches.`);
  
  fs.writeFileSync('C:/Users/adoni/Documents/ADONIS/Antigravity/scratch/mismatch_report.json', JSON.stringify(mismatches, null, 2));
  console.log("Mismatch report saved to scratch/mismatch_report.json");
}

run();
