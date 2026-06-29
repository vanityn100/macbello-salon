const fs = require('fs');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

function recalculateInvoiceTotals(items, manualDiscount = 0, pointsRedeemed = 0) {
  const totalDiscount = manualDiscount + pointsRedeemed;
  let totalBase = 0;

  for (const item of items) {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    let taxRate = parseFloat(item.tax_rate) || 0;
    if (taxRate > 1) taxRate = taxRate / 100;
    
    const originalBase = (qty * price) / (1 + taxRate);
    totalBase += originalBase;
  }

  let proportion = 1;
  if (totalBase > 0 && totalDiscount > 0) {
    proportion = 1 - (totalDiscount / totalBase);
    if (proportion < 0) proportion = 0;
  }

  let subtotal = 0;
  let serviceTax = 0;
  let retailTax = 0;

  for (const item of items) {
    const qty = item.quantity || 1;
    const price = item.unit_price || 0;
    let taxRate = parseFloat(item.tax_rate) || 0;
    if (taxRate > 1) taxRate = taxRate / 100;

    const originalBase = (qty * price) / (1 + taxRate);
    const discountedBase = originalBase * proportion;
    const taxAmount = discountedBase * taxRate;

    subtotal += discountedBase;
    
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
    grand_total: parseFloat(grandTotal.toFixed(2)),
    points_earned: Math.floor(grandTotal / 10)
  };
}

async function runImport() {
  console.log("Starting Peruva data import...");
  
  const workbook = xlsx.readFile('PERUVA SALE REPORT TILL 27-6-2026.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  const invoiceGroups = {};
  for (const row of data) {
    const invNo = row['Invoice No'];
    if (!invNo) continue;
    if (!invoiceGroups[invNo]) {
      invoiceGroups[invNo] = {
        date: row['Date'],
        partyName: row['Party Name'],
        items: [],
        totalDiscount: 0
      };
    }
    
    const taxPercent = parseFloat(row['Tax Percent']) || 0;
    const unitPriceBase = parseFloat(row['UnitPrice']) || 0;
    // GST-inclusive price: Base * (1 + Tax)
    const inclusivePrice = unitPriceBase * (1 + taxPercent / 100);
    
    let category = (row['Category'] || 'Service').toString().trim().toLowerCase();
    if (category === 'product' || category === 'retail') {
      category = 'Retail';
    } else {
      category = 'Service';
    }

    invoiceGroups[invNo].items.push({
      item_name: row['Item Name'],
      item_code: row['Item Code'],
      hsn: row['HSN/SAC'],
      category: category,
      quantity: parseFloat(row['Quantity']) || 1,
      unit_price: parseFloat(inclusivePrice.toFixed(2)),
      tax_rate: taxPercent
    });
    
    const disc = parseFloat(row['Discount']) || 0;
    invoiceGroups[invNo].totalDiscount += disc;
  }

  const invoices = Object.keys(invoiceGroups);
  console.log(`Found ${invoices.length} unique invoices to process.`);
  
  const createdBy = 'admin@macbello.com';
  
  for (const invNo of invoices) {
    const inv = invoiceGroups[invNo];
    
    // Parse date DD/MM/YYYY to YYYY-MM-DD
    const dateParts = inv.date.split('/');
    let createdAt = new Date().toISOString();
    if (dateParts.length === 3) {
      createdAt = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T12:00:00Z`;
    }

    const calc = recalculateInvoiceTotals(inv.items, inv.totalDiscount, 0);

    let customerId = null;
    if (inv.partyName) {
      // Find or create customer
      const { data: existingCust } = await supabase.from('customers').select('id').eq('name', inv.partyName).maybeSingle();
      if (existingCust) {
        customerId = existingCust.id;
      } else {
        const { data: newCust, error: custErr } = await supabase.from('customers').insert({
          name: inv.partyName,
          phone: String(Math.floor(Math.random() * 9000000000) + 1000000000)
        }).select('id').single();
        if (newCust) customerId = newCust.id;
        else console.error('Failed to create customer:', custErr);
      }
    } else {
      // Fallback walk-in customer
      const { data: walkin } = await supabase.from('customers').select('id').eq('name', 'Walk-in Customer').maybeSingle();
      if (walkin) {
        customerId = walkin.id;
      } else {
        const { data: newCust } = await supabase.from('customers').insert({
          name: 'Walk-in Customer',
          phone: '9999999999'
        }).select('id').single();
        if (newCust) customerId = newCust.id;
      }
    }

    const { data: insertedInv, error: invErr } = await supabase.from('invoices').insert({
      invoice_number: `INV-20260628-PERUVA-${invNo}`,
      customer_id: customerId,
      customer_name: inv.partyName,
      branch: 'Peruva',
      subtotal: calc.subtotal,
      service_tax: calc.service_tax,
      retail_tax: calc.retail_tax,
      total_tax: calc.total_tax,
      grand_total: calc.grand_total,
      discount: calc.discount,
      points_redeemed: calc.points_redeemed,
      points_earned: calc.points_earned,
      status: 'active',
      payment_method: 'Cash',
      created_by: createdBy,
      created_at: createdAt
    }).select('*').single();

    if (invErr) {
      console.error(`Failed to insert invoice ${invNo}:`, invErr.message);
      continue;
    }

    const itemsToInsert = inv.items.map(item => ({
      invoice_id: insertedInv.id,
      item_name: item.item_name,
      item_code: item.item_code,
      hsn: item.hsn,
      category: item.category,
      quantity: item.quantity,
      unit_price: item.unit_price,
      tax_rate: item.tax_rate,
      line_total: item.quantity * item.unit_price
    }));

    const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsToInsert);
    if (itemsErr) {
      console.error(`Failed to insert items for invoice ${invNo}:`, itemsErr.message);
    }
  }

  console.log("Import completed!");
}

runImport();
