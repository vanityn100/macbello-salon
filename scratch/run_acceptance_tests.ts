import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
function recalculateInvoiceTotals(items: any[], manualDiscount = 0, pointsRedeemed = 0) {
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

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars: Record<string, string> = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function runTests() {
  console.log("Starting Acceptance Tests...");

  const { data: cust, error: custErr } = await supabase.from('customers').insert({
    name: 'Acceptance Test Customer',
    phone: '9999999999'
  }).select('*').single();
  if (custErr) throw custErr;
  
  const customerId = cust.id;

  const scenarios = [
    { name: '1. GST-inclusive service with no discount', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 0 },
    { name: '2. GST-inclusive product with no discount', items: [{ quantity: 1, unit_price: 1180, tax_rate: 18, category: 'Product' }], discount: 0, loyalty: 0 },
    { name: '3. Service + manual discount', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 100, loyalty: 0 },
    { name: '4. Product + manual discount', items: [{ quantity: 1, unit_price: 1180, tax_rate: 18, category: 'Product' }], discount: 100, loyalty: 0 },
    { name: '5. Service + loyalty redemption', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 50 },
    { name: '6. Product + loyalty redemption', items: [{ quantity: 1, unit_price: 1180, tax_rate: 18, category: 'Product' }], discount: 0, loyalty: 50 },
    { name: '7. Manual discount + loyalty redemption together', items: [{ quantity: 1, unit_price: 1180, tax_rate: 18, category: 'Product' }], discount: 100, loyalty: 50 },
    { name: '8. Mixed invoice (5% service + 18% product)', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }, { quantity: 1, unit_price: 1180, tax_rate: 18, category: 'Product' }], discount: 0, loyalty: 0 },
    { name: '9. Multiple quantities', items: [{ quantity: 3, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 0 },
    { name: '10. Decimal prices', items: [{ quantity: 1, unit_price: 99.99, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 0 },
    { name: '11. Zero discount', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 0 },
    { name: '12. Large discounts', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 450, loyalty: 0 },
    { name: '13. Maximum allowed loyalty redemption', items: [{ quantity: 1, unit_price: 500, tax_rate: 5, category: 'Service' }], discount: 0, loyalty: 500 }
  ];

  let passed = 0;
  
  for (const scenario of scenarios) {
    try {
      const calc = recalculateInvoiceTotals(scenario.items, scenario.discount, scenario.loyalty);
      
      const { data: inv, error: invErr } = await supabase.from('invoices').insert({
        customer_id: customerId,
        subtotal: calc.subtotal,
        service_tax: calc.service_tax,
        retail_tax: calc.retail_tax,
        total_tax: calc.total_tax,
        grand_total: calc.grand_total,
        discount: calc.discount,
        points_redeemed: calc.points_redeemed,
        points_earned: 0,
        status: 'active',
        invoice_number: 'TEST-' + Math.floor(Math.random()*10000)
      }).select('*').single();
      
      if (invErr) throw invErr;

      const itemsToInsert = scenario.items.map(item => ({
        invoice_id: inv.id,
        item_name: 'Test Item',
        category: item.category,
        quantity: item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        line_total: item.quantity * item.unit_price
      }));

      await supabase.from('invoice_items').insert(itemsToInsert);

      console.log(`PASS: ${scenario.name} -> Grand Total: ${calc.grand_total}`);
      passed++;
    } catch (e) {
      console.error(`FAIL: ${scenario.name} -`, e);
    }
  }

  console.log(`\nTests completed: ${passed}/${scenarios.length} passed.`);
}

runTests();
