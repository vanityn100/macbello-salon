const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runImport() {
  const data = fs.readFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/scratch/import_data.txt', 'utf-8');
  const lines = data.split('\n').map(l => l.trimEnd());
  
  let currentInvoice = null;
  const invoices = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split('\t');
    
    // Check if it's a new invoice (starts with date)
    if (parts[0].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      currentInvoice = {
        date: parts[0],
        supplier: parts[1],
        invoiceNo: parts[2],
        items: []
      };
      invoices.push(currentInvoice);
      
      currentInvoice.items.push({
        desc: parts[3],
        mrp: parseFloat(parts[4]),
        qty: parseInt(parts[5], 10),
        rate: parseFloat(parts[6]),
        total: parseFloat(parts[7]),
        disc: parseFloat(parts[8] || 0),
        amount: parseFloat(parts[9] || 0)
      });
    } else if (currentInvoice) {
      // Find the description which is the first non-empty value
      let descIdx = 0;
      while (descIdx < parts.length && !parts[descIdx].trim()) {
        descIdx++;
      }
      
      // Some rows are just "TOTAL" or empty lines
      if (descIdx < parts.length && parts[descIdx] !== "TOTAL" && !parts[descIdx].includes("WITHOUT TAX") && !parts[descIdx].includes("WITH TAX") && !parts[descIdx].includes("TAX PAID") && !parts[descIdx].match(/^\d+\.\d+$/)) {
        currentInvoice.items.push({
          desc: parts[descIdx],
          mrp: parseFloat(parts[descIdx+1] || 0),
          qty: parseInt(parts[descIdx+2] || 0, 10),
          rate: parseFloat(parts[descIdx+3] || 0),
          total: parseFloat(parts[descIdx+4] || 0),
          disc: parseFloat(parts[descIdx+5] || 0),
          amount: parseFloat(parts[descIdx+6] || 0)
        });
      }
    }
  }

  console.log(`Parsed ${invoices.length} invoices.`);

  for (const inv of invoices) {
    // Check if invoice already imported
    const { data: existing } = await supabase.from('stock_purchases')
       .select('id').eq('invoice_number', inv.invoiceNo).eq('supplier_name', inv.supplier).maybeSingle();
       
    if (existing) {
       console.log(`Skipping existing invoice ${inv.invoiceNo}`);
       continue;
    }

    let grandTotal = 0;
    const finalItems = [];

    for (const item of inv.items) {
      if (!item.desc || isNaN(item.mrp)) continue;
      
      // Find or create product
      let { data: prod } = await supabase.from('services').select('id').eq('name', item.desc).maybeSingle();
      if (!prod) {
        console.log(`Auto-creating missing product: ${item.desc}`);
        const { data: newProd, error: createErr } = await supabase.from('services').insert([{
           name: item.desc,
           category: 'Retail',
           price: item.mrp || 0,
           branch: 'MACBELLO',
           type: 'Retail'
        }]).select('id').single();
        if (createErr) { console.error("Error creating product:", createErr); continue; }
        prod = newProd;
      }

      // GST is 18% as per the column
      const gstAmt = item.amount * 0.18;
      const lineTotal = item.amount + gstAmt;
      grandTotal += lineTotal;

      finalItems.push({
        product_id: prod.id,
        mrp: item.mrp,
        quantity: item.qty,
        purchase_rate: item.rate,
        discount_percent: 0,
        discount_amount: item.disc,
        taxable_amount: item.amount,
        gst_percent: 18,
        gst_amount: gstAmt,
        line_total: lineTotal
      });
    }

    if (finalItems.length === 0) continue;

    const [month, day, year] = inv.date.split('/');
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const purchaseNumber = `PO-${isoDate.replace(/-/g, "")}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: insertedInv, error: invErr } = await supabase.from('stock_purchases').insert([{
      purchase_number: purchaseNumber,
      invoice_number: inv.invoiceNo,
      supplier_name: inv.supplier,
      purchase_date: isoDate,
      branch: 'MACBELLO',
      grand_total: parseFloat(grandTotal.toFixed(2)),
      created_by: 'historical_import'
    }]).select('id').single();

    if (invErr) {
       console.error("Error inserting invoice", invErr);
       continue;
    }

    for (const fi of finalItems) {
       fi.purchase_id = insertedInv.id;
    }
    await supabase.from('stock_purchase_items').insert(finalItems);

    for (const fi of finalItems) {
       const { data: invRow } = await supabase.from('branch_inventory')
         .select('id, current_stock').eq('branch', 'MACBELLO').eq('service_id', fi.product_id).maybeSingle();
         
       if (invRow) {
         await supabase.from('branch_inventory').update({ current_stock: invRow.current_stock + fi.quantity }).eq('id', invRow.id);
       } else {
         await supabase.from('branch_inventory').insert([{
           service_id: fi.product_id,
           branch: 'MACBELLO',
           current_stock: fi.quantity,
           minimum_stock: 5
         }]);
       }
    }
    
    console.log(`Successfully imported invoice ${inv.invoiceNo} with ${finalItems.length} items. Total: ${grandTotal.toFixed(2)}`);
  }
}

runImport().catch(console.error);
