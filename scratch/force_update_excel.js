require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function forceUpdateEverything() {
  console.log("Force updating all products...");
  const workbook = XLSX.readFile('product list.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  
  for (const row of data) {
    const rawName = row['PRODUCT'];
    if (!rawName) continue;
    const name = String(rawName).trim().toUpperCase();
    
    let excelHsn = row['HSN CODE'];
    if (excelHsn === null || excelHsn === undefined || excelHsn === "") {
      excelHsn = null;
    } else {
      if (typeof excelHsn === 'number') {
        excelHsn = excelHsn.toString();
      } else {
        excelHsn = String(excelHsn).trim();
      }
    }
    
    const price = Number(row['AMOUNT']) || 0;
    const taxRate = Number(row['tax rate']) || 0;
    
    // Explicitly update all
    const { data: svc } = await supabase.from('services').select('id, name').ilike('name', name).maybeSingle();
    
    if (svc) {
      const { error } = await supabase.from('services').update({ hsn: excelHsn, price: price, tax_rate: taxRate }).eq('id', svc.id);
      if (error) {
        console.error(`Failed to force update ${name}:`, error.message);
      } else {
        console.log(`Force updated ${name} - HSN: ${excelHsn}, Price: ${price}, GST: ${taxRate}`);
      }
    } else {
      console.log(`Product not found in DB: ${name}`);
    }
  }
  
  console.log(`Done.`);
}

forceUpdateEverything();
