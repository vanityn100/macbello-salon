const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');

// Initialize Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_KEY';
// Wait, I can just require dotenv and load from .env.local
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const workbook = XLSX.readFile('product list.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(sheet);
  
  // Normalize strings for matching
  const normalize = (str) => str ? str.toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
  
  const excelMap = new Map();
  excelData.forEach(r => {
     if (!r.PRODUCT) return;
     const normName = normalize(r.PRODUCT);
     excelMap.set(normName, {
       hsn: r['HSN CODE'] ? r['HSN CODE'].toString() : null,
       tax_rate: r['tax rate'] || r['GST'] || r['GST Rate'] || 18
     });
  });

  const { data: products, error } = await supabase.from('products').select('*');
  if (error) {
     console.error("DB Error:", error);
     return;
  }
  
  let matchCount = 0;
  let updateCount = 0;
  const updates = [];

  for (const p of products) {
    const normDbName = normalize(p.name);
    let match = excelMap.get(normDbName);
    
    if (!match) {
        // Try substring matching
        for (const [xlName, xlData] of excelMap.entries()) {
            if (normDbName.includes(xlName) || xlName.includes(normDbName)) {
                match = xlData;
                break;
            }
        }
    }
    
    if (match) {
       matchCount++;
       const newTaxRate = (match.tax_rate > 18) ? 18 : match.tax_rate;
       // Also if tax_rate in db is like 1800, we must fix it even if no excel match?
       // Wait, the user said "some of products has wrong hsn and gst rate ... fix that in catalogue nad everywhere... correct sheet is folder : product list"
       if (p.tax_rate != newTaxRate || p.hsn != match.hsn) {
          updates.push({
             id: p.id,
             name: p.name,
             old_hsn: p.hsn,
             new_hsn: match.hsn,
             old_tax: p.tax_rate,
             new_tax: newTaxRate
          });
       }
    } else {
       // If not in excel but has crazy tax rate, fix it anyway based on category?
       if (p.tax_rate > 18) {
          const newTaxRate = p.category === 'Service' ? 5 : 18;
          updates.push({
             id: p.id,
             name: p.name,
             old_hsn: p.hsn,
             new_hsn: p.hsn,
             old_tax: p.tax_rate,
             new_tax: newTaxRate
          });
       }
    }
  }

  console.log(`Matched ${matchCount} out of ${products.length} products.`);
  console.log(`Found ${updates.length} products requiring updates.`);
  if (updates.length > 0) {
      console.log(updates.slice(0, 10));
  }
}
run();
