const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const workbook = XLSX.readFile('product list.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(sheet);
  
  const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
  
  const excelMap = new Map();
  excelData.forEach(r => {
     if (!r.PRODUCT) return;
     const normName = normalize(r.PRODUCT);
     excelMap.set(normName, {
       hsn: r['HSN CODE'] ? r['HSN CODE'].toString().trim() : null,
       tax_rate: r['tax rate'] || r['GST'] || r['GST Rate'] || 18
     });
  });

  const { data: services, error } = await supabase.from('services').select('*');
  if (error) {
     console.error("DB Error:", error);
     return;
  }
  
  let matchCount = 0;
  const updates = [];

  for (const p of services) {
    const normDbName = normalize(p.name);
    let match = excelMap.get(normDbName);
    
    if (!match) {
        for (const [xlName, xlData] of excelMap.entries()) {
            if (normDbName.includes(xlName) || xlName.includes(normDbName)) {
                match = xlData;
                break;
            }
        }
    }
    
    if (match) {
       matchCount++;
       let newTaxRate = parseFloat(match.tax_rate) || 18;
       if (newTaxRate > 18) newTaxRate = 18; // cap it at 18 if excel has weird values
       
       const dbTaxRate = parseFloat(p.tax_rate);
       if (dbTaxRate != newTaxRate || String(p.hsn).trim() !== String(match.hsn).trim()) {
          updates.push({
             id: p.id,
             name: p.name,
             old_hsn: p.hsn,
             new_hsn: match.hsn || p.hsn,
             old_tax: dbTaxRate,
             new_tax: newTaxRate
          });
       }
    } else {
       // if not in excel, just fix the crazy tax rates
       const dbTaxRate = parseFloat(p.tax_rate);
       if (dbTaxRate > 18 || isNaN(dbTaxRate)) {
          const newTaxRate = p.category === 'Service' ? 5 : 18;
          updates.push({
             id: p.id,
             name: p.name,
             old_hsn: p.hsn,
             new_hsn: p.hsn,
             old_tax: dbTaxRate,
             new_tax: newTaxRate
          });
       }
    }
  }

  console.log(`Matched ${matchCount} out of ${services.length} records.`);
  console.log(`Found ${updates.length} records requiring updates.`);
  if (updates.length > 0) {
      console.log(updates.slice(0, 10));
      // Perform updates
      let success = 0;
      for (const u of updates) {
         const { error: updErr } = await supabase.from('services').update({ hsn: u.new_hsn, tax_rate: String(u.new_tax) }).eq('id', u.id);
         if (updErr) {
             console.error(`Failed to update ${u.name}:`, updErr);
         } else {
             success++;
         }
      }
      console.log(`Successfully updated ${success} records.`);
  }
}
run();
