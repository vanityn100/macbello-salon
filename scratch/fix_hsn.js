require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAndFixHSN() {
  console.log("Checking HSN mismatch...");
  const workbook = XLSX.readFile('product list.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  
  let updatedCount = 0;
  
  for (const row of data) {
    const rawName = row['PRODUCT'];
    if (!rawName) continue;
    const name = String(rawName).trim().toUpperCase();
    
    // Some excel HSN codes might be parsed as floats or scientific notation if they are huge numbers.
    // Ensure we parse them as pure string without decimals.
    let excelHsn = row['HSN CODE'];
    if (excelHsn === null || excelHsn === undefined || excelHsn === "") {
      excelHsn = null;
    } else {
      // If it's a number, convert to string safely
      if (typeof excelHsn === 'number') {
        // e.g. 33059090
        excelHsn = excelHsn.toString();
      } else {
        excelHsn = String(excelHsn).trim();
      }
    }
    
    const { data: svc } = await supabase.from('services').select('id, name, hsn').ilike('name', name).maybeSingle();
    
    if (svc) {
      let dbHsn = svc.hsn;
      // Normalizing both to compare safely
      const normExcel = excelHsn ? excelHsn : '';
      const normDb = dbHsn ? dbHsn : '';
      
      if (normExcel !== normDb) {
        console.log(`Mismatch found for ${name} -> Excel: '${normExcel}', DB: '${normDb}'`);
        
        // Update DB
        const { error } = await supabase.from('services').update({ hsn: excelHsn }).eq('id', svc.id);
        if (error) {
          console.error(`Failed to update ${name}:`, error.message);
        } else {
          console.log(`Updated ${name} HSN to ${normExcel}`);
          updatedCount++;
        }
      }
    } else {
      console.log(`Product not found in DB: ${name}`);
    }
  }
  
  console.log(`Done. Total HSN codes updated: ${updatedCount}`);
}

checkAndFixHSN();
