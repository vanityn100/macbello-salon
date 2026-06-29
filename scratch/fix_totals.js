const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
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

function recalculateInvoiceTotals(items, manualDiscount = 0, pointsRedeemed = 0) {
  const totalDiscount = manualDiscount + pointsRedeemed;
  let totalLineTotal = 0;
  for (const item of items) {
    totalLineTotal += (parseInt(item.quantity) || 1) * (parseFloat(item.unit_price) || 0);
  }
  let proportion = 1;
  if (totalLineTotal > 0 && totalDiscount > 0) {
    proportion = 1 - (totalDiscount / totalLineTotal);
    if (proportion < 0) proportion = 0;
  }
  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;
  
  for (const item of items) {
    const qty = parseInt(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    
    let taxRate = 0;
    if (typeof item.tax_rate === 'string') taxRate = parseFloat(item.tax_rate);
    else if (typeof item.tax_rate === 'number') taxRate = item.tax_rate;
    if (taxRate > 1) taxRate = taxRate / 100;
    
    const lineTotal = qty * price;
    const discountedLineTotal = lineTotal * proportion;
    
    const baseAmount = discountedLineTotal;
    const taxAmount = baseAmount * taxRate;
    
    subtotal += baseAmount;
    
    const category = (item.category || 'Service').toLowerCase();
    if (category === 'service') serviceTax += taxAmount;
    else retailTax += taxAmount;
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

async function fix() {
  const { data: invoices } = await supabase.from('invoices').select('*');
  const { data: allItems } = await supabase.from('invoice_items').select('*');
  
  let fixed = 0;
  for (const inv of invoices) {
    const items = allItems.filter(i => i.invoice_id === inv.id);
    const calc = recalculateInvoiceTotals(items, inv.discount || 0, inv.points_redeemed || 0);
    
    if (Math.abs(calc.grand_total - inv.grand_total) > 0.10 || 
        Math.abs(calc.subtotal - inv.subtotal) > 0.10 || 
        Math.abs(calc.total_tax - inv.total_tax) > 0.10) {
        
        console.log(`Fixing ${inv.invoice_number}... Computed: ${calc.grand_total}, Stored: ${inv.grand_total}`);
        await supabase.from('invoices').update({
            subtotal: calc.subtotal,
            service_tax: calc.service_tax,
            retail_tax: calc.retail_tax,
            total_tax: calc.total_tax,
            grand_total: calc.grand_total
        }).eq('id', inv.id);
        fixed++;
    }
  }
  console.log(`Fixed ${fixed} invoices.`);
}
fix();
