const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const envLines = envContent.split('\n');
for (const line of envLines) {
  if (line.includes('=')) {
    const [key, ...values] = line.split('=');
    process.env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const fileContent = fs.readFileSync('scratch/june_items_raw.txt', 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  // Skip header
  const rows = lines.slice(1).map(line => line.split('\t').map(col => col ? col.trim() : ''));

  // 1. Get all imported invoices
  const { data: invoices, error: invErr } = await supabase
    .from('invoices')
    .select('id, invoice_number, points_redeemed')
    .eq('created_by', 'system_import');

  if (invErr) {
    console.error("Error fetching invoices:", invErr);
    return;
  }

  const invoiceMap = {}; // mapping from "4071" -> invoice object
  for (const inv of invoices) {
    // invoice_number is like INV-20260627-4071
    const parts = inv.invoice_number.split('-');
    if (parts.length === 3) {
      invoiceMap[parts[2]] = inv;
    }
  }

  console.log(`Loaded ${invoices.length} imported invoices.`);

  // 2. Group items by invoice number
  const itemsByInvoice = {};
  for (const row of rows) {
    if (row.length < 14) continue;
    const invNo = row[1];
    if (!itemsByInvoice[invNo]) {
      itemsByInvoice[invNo] = [];
    }
    itemsByInvoice[invNo].push(row);
  }

  let processedCount = 0;

  // 3. Process each invoice
  for (const [invNo, items] of Object.entries(itemsByInvoice)) {
    const invoice = invoiceMap[invNo];
    if (!invoice) {
      console.log(`Warning: Invoice ${invNo} not found in DB. Skipping items.`);
      continue;
    }

    // Delete old dummy items
    await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);

    let subtotal = 0;
    let service_tax = 0;
    let retail_tax = 0;
    let total_tax = 0;
    let total_discount = 0;
    let grand_total = 0;

    const itemsToInsert = items.map(row => {
      const itemName = row[3] || 'Unknown Item';
      let category = row[6] || 'Service';
      if (category.toLowerCase() === 'product' || category.toLowerCase() === 'retail') {
        category = 'Retail';
      } else if (category.toLowerCase() === 'service') {
        category = 'Service';
      }
      const quantity = parseInt(row[7]) || 1;
      const unitPrice = parseFloat(row[8]) || 0;
      const itemDiscount = parseFloat(row[10]) || 0;
      const taxRate = parseFloat(row[11]) || 0;
      const taxAmt = parseFloat(row[12]) || 0;
      const lineTotal = parseFloat(row[14]) || 0;

      // Accumulate totals
      subtotal += (unitPrice * quantity);
      total_discount += itemDiscount;
      total_tax += taxAmt;
      grand_total += lineTotal;
      
      if (category.toLowerCase() === 'product' || category.toLowerCase() === 'retail') {
        retail_tax += taxAmt;
      } else {
        service_tax += taxAmt;
      }

      return {
        invoice_id: invoice.id,
        item_name: itemName,
        category: category,
        quantity: quantity,
        unit_price: unitPrice,
        tax_rate: taxRate,
        line_total: lineTotal
      };
    });

    // Insert new items
    const { error: insertErr } = await supabase.from('invoice_items').insert(itemsToInsert);
    if (insertErr) {
      console.error(`Error inserting items for ${invNo}:`, insertErr);
      continue;
    }

    // Apply loyalty deduction to grand total
    const finalGrandTotal = grand_total - parseFloat(invoice.points_redeemed || 0);

    // Update invoice totals
    const { error: updateErr } = await supabase.from('invoices').update({
      subtotal: subtotal,
      service_tax: service_tax,
      retail_tax: retail_tax,
      total_tax: total_tax,
      discount: total_discount,
      grand_total: finalGrandTotal
    }).eq('id', invoice.id);

    if (updateErr) {
      console.error(`Error updating totals for ${invNo}:`, updateErr);
    } else {
      processedCount++;
    }
  }

  console.log(`Successfully updated items for ${processedCount} invoices.`);
}

run().catch(console.error);
