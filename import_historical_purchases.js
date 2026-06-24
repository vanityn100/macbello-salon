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
    
    // Check if line starts with a date
    if (parts[0].match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
      currentInvoice = {
        date: parts[0],
        seller: parts[1] || "",
        invoiceNo: parts[2] || "",
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
        amount: parseFloat(parts[9] || 0),
        gstAmount: parseFloat(parts[10] || 0),
        grandTotal: parseFloat(parts[11] || 0)
      });
    } else if (currentInvoice) {
      // Find where description starts
      let descIdx = 0;
      while (descIdx < parts.length && !parts[descIdx].trim()) {
        descIdx++;
      }
      
      // If we found a description and it's not a summary row
      if (descIdx < parts.length && 
          parts[descIdx] !== 'TOTAL' && 
          !parts[descIdx].includes('WITHOUT TAX') && 
          !parts[descIdx].includes('WITH TAX') && 
          !parts[descIdx].includes('TAX PAID') &&
          !parts[descIdx].match(/^\d+\.\d+$/)) {
        
        currentInvoice.items.push({
          desc: parts[descIdx],
          mrp: parseFloat(parts[descIdx+1] || 0),
          qty: parseInt(parts[descIdx+2] || 0, 10),
          rate: parseFloat(parts[descIdx+3] || 0),
          total: parseFloat(parts[descIdx+4] || 0),
          disc: parseFloat(parts[descIdx+5] || 0),
          amount: parseFloat(parts[descIdx+6] || 0),
          gstAmount: parseFloat(parts[descIdx+7] || 0),
          grandTotal: parseFloat(parts[descIdx+8] || 0)
        });
      }
    }
  }

  console.log(`Parsed ${invoices.length} invoices.`);
  let totalRows = 0;

  for (const inv of invoices) {
    const [month, day, year] = inv.date.split('/');
    const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    
    for (const item of inv.items) {
      if (!item.desc || isNaN(item.mrp)) continue;

      const gstAmt = item.gstAmount || (item.amount * 0.18);
      const grandTot = item.grandTotal || (item.amount + gstAmt);

      const { error } = await supabase.from('purchase_stock_entries').insert([{
        date: isoDate,
        seller: inv.seller,
        invoice_no: inv.invoiceNo,
        description_of_goods: item.desc,
        mrp: item.mrp || 0,
        quantity: item.qty || 0,
        rate: item.rate || 0,
        total: item.total || 0,
        discount_percent: item.disc || 0,
        amount: item.amount || 0,
        gst_percent: 18,
        gst_amount: gstAmt,
        grand_total: grandTot,
        branch: 'Historical Import'
      }]);

      if (error) {
        console.error('Error inserting row:', error);
      } else {
        totalRows++;
      }
    }
    console.log(`Imported invoice ${inv.invoiceNo}`);
  }
  
  console.log(`Successfully imported ${totalRows} individual items!`);
}

runImport().catch(console.error);
