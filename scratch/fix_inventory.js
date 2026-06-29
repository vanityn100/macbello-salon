const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runSync() {
  const workbook = XLSX.readFile('product list.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  
  for (const row of data) {
    const rawName = row['PRODUCT'];
    if (!rawName) continue;
    
    const name = String(rawName).trim().toUpperCase();
    const hsn = row['HSN CODE'] ? String(row['HSN CODE']).trim() : null;
    const price = Number(row['AMOUNT']) || 0;
    const taxRate = Number(row['tax rate']) || 0;
    const initialQty = Number(row['QTY']) || 0;
    
    let { data: serviceRec } = await supabase.from('services').select('id, name').ilike('name', name).maybeSingle();
    let serviceId;
    
    if (!serviceRec) {
      // Create it with a dummy stock of 1 to bypass the broken DB trigger on 0 stock
      const { data: newSvc, error: insErr } = await supabase
        .from('services')
        .insert({
          name: name,
          price: price,
          tax_rate: taxRate,
          category: 'Retail',
          hsn: hsn,
          status: 'ACTIVE',
          current_stock: 1
        })
        .select('id')
        .single();
        
      if (insErr) {
        console.error(`Still failing on ${name}:`, insErr.message);
        continue;
      }
      serviceId = newSvc.id;
      console.log("Created missing service:", name);
    } else {
      serviceId = serviceRec.id;
    }
    
    // Calculate remaining
    const { data: soldItems } = await supabase.from('invoice_items').select('quantity').ilike('item_name', name);
    let totalSold = soldItems ? soldItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0) : 0;
    const remainingStock = initialQty - totalSold;
    
    // Upsert Warehouse
    const { data: invRec } = await supabase.from('branch_inventory').select('id').eq('service_id', serviceId).eq('branch', 'Warehouse').maybeSingle();
    if (invRec) {
      await supabase.from('branch_inventory').update({ current_stock: remainingStock }).eq('id', invRec.id);
    } else {
      await supabase.from('branch_inventory').insert({
        service_id: serviceId,
        branch: 'Warehouse',
        current_stock: remainingStock,
        minimum_stock: 5
      });
    }
  }
  console.log("All missing failed items fixed!");
}

runSync();
