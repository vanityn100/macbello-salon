require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local", process.env.NEXT_PUBLIC_SUPABASE_URL);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runSync() {
  console.log("Starting Inventory Reconciliation & Sync...");
  
  let workbook;
  try {
    workbook = XLSX.readFile('product list.xlsx');
  } catch (err) {
    console.error("Failed to read product list.xlsx:", err.message);
    process.exit(1);
  }
  
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
  
  const report = [];
  let updatedCount = 0;
  let createdCount = 0;

  for (const row of data) {
    const rawName = row['PRODUCT'];
    if (!rawName) continue;
    
    const name = String(rawName).trim().toUpperCase();
    const hsn = row['HSN CODE'] ? String(row['HSN CODE']).trim() : null;
    const price = Number(row['AMOUNT']) || 0;
    const taxRate = Number(row['tax rate']) || 0;
    const initialQty = Number(row['QTY']) || 0;
    
    // 1. Match or Create in services
    let { data: serviceRec, error: sErr } = await supabase
      .from('services')
      .select('id, name')
      .ilike('name', name)
      .maybeSingle();
      
    let serviceId;
    
    if (sErr) {
      console.error(`Error querying service ${name}:`, sErr);
      continue;
    }
    
    if (!serviceRec) {
      // Create it - explicitly overriding status to 'active' just in case
      // Wait, there might be a stock_status column or something that defaults to OUT_OF_STOCK
      // But we just omit it or insert minimum required fields.
      const { data: newSvc, error: insErr } = await supabase
        .from('services')
        .insert({
          name: name,
          price: price,
          tax_rate: taxRate,
          category: 'Retail',
          hsn: hsn,
          status: 'active'
        })
        .select('id')
        .single();
        
      if (insErr) {
        // Log the full schema error
        console.error(`Error creating service ${name}:`, JSON.stringify(insErr, null, 2));
        continue;
      }
      serviceId = newSvc.id;
      createdCount++;
    } else {
      // Update it
      serviceId = serviceRec.id;
      const { error: updErr } = await supabase
        .from('services')
        .update({
          price: price,
          tax_rate: taxRate,
          hsn: hsn
        })
        .eq('id', serviceId);
        
      if (updErr) {
        console.error(`Error updating service ${name}:`, updErr);
      }
      updatedCount++;
    }
    
    // 2. Query historical sales in invoice_items
    const { data: soldItems, error: soldErr } = await supabase
      .from('invoice_items')
      .select('quantity')
      .ilike('item_name', name);
      
    let totalSold = 0;
    if (!soldErr && soldItems) {
      totalSold = soldItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
    }
    
    // 3. Calculate remaining stock
    const remainingStock = initialQty - totalSold;
    
    // 4. Update branch_inventory for Warehouse
    const { data: invRec } = await supabase
      .from('branch_inventory')
      .select('id')
      .eq('service_id', serviceId)
      .eq('branch', 'Warehouse')
      .maybeSingle();
      
    if (invRec) {
      await supabase
        .from('branch_inventory')
        .update({ current_stock: remainingStock })
        .eq('id', invRec.id);
    } else {
      await supabase
        .from('branch_inventory')
        .insert({
          service_id: serviceId,
          branch: 'Warehouse',
          current_stock: remainingStock,
          minimum_stock: 5
        });
    }
    
    // 5. Add to report
    report.push({
      product: name,
      originalQty: initialQty,
      totalSold: totalSold,
      remainingWarehouseStock: remainingStock,
      price: price,
      hsn: hsn || 'None'
    });
    
    console.log(`Processed ${name}: Init=${initialQty}, Sold=${totalSold}, Rem=${remainingStock}`);
  }
  
  // Write markdown report
  let md = `# Inventory Sync & Reconciliation Report\n\n`;
  md += `**Total Products Processed:** ${report.length}\n`;
  md += `**New Products Created:** ${createdCount}\n`;
  md += `**Existing Products Updated:** ${updatedCount}\n\n`;
  
  md += `| Product Name | Original Excel Qty | Total Sold (Historically) | Final Warehouse Stock | Updated Price | HSN |\n`;
  md += `|---|---|---|---|---|---|\n`;
  
  for (const r of report) {
    md += `| ${r.product} | ${r.originalQty} | ${r.totalSold} | **${r.remainingWarehouseStock}** | ${r.price} | ${r.hsn} |\n`;
  }
  
  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/walkthrough.md', md);
  console.log("Done! Written report to walkthrough.md");
}

runSync();
