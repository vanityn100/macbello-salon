require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function migrate() {
  console.log("Starting idempotent migration...");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch all products (services)
  const { data: products } = await supabase.from('services').select('id, name, category');
  
  // Create an exact match map (normalized)
  const productMap = {};
  for (const p of products) {
    const normName = p.name.trim().toLowerCase();
    if (!productMap[normName]) {
      productMap[normName] = [];
    }
    productMap[normName].push(p);
  }

  // 2. Fetch all invoice items
  // We fetch ALL to verify idempotency (skip if service_id already set)
  const { data: invoiceItems } = await supabase.from('invoice_items').select('id, invoice_id, item_name, category, service_id');

  const report = [
    `# Historical Invoice ID Migration Report\n`,
    `| Invoice ID | Invoice Item Name | Matched Service ID | Match Type |`,
    `|---|---|---|---|`
  ];

  let skippedCount = 0;
  let updatedCount = 0;
  let manualReviewCount = 0;

  for (const item of invoiceItems) {
    if (item.service_id) {
      // Already migrated! Idempotent check.
      skippedCount++;
      continue;
    }

    const normItemName = item.item_name.trim().toLowerCase();
    
    // Safety check 1: Exact normalized match
    const candidates = productMap[normItemName];
    
    if (!candidates || candidates.length === 0) {
      report.push(`| ${item.invoice_id} | ${item.item_name} | NULL | Manual Review Required (No exact match) |`);
      manualReviewCount++;
      continue;
    }

    // Safety check 2: Multiple products with same name?
    if (candidates.length > 1) {
      report.push(`| ${item.invoice_id} | ${item.item_name} | NULL | Manual Review Required (Multiple matches) |`);
      manualReviewCount++;
      continue;
    }

    // Match is 100% certain.
    const matchedProduct = candidates[0];

    // Safety check 3: Same category? (Retail vs Service)
    if (matchedProduct.category !== item.category) {
      report.push(`| ${item.invoice_id} | ${item.item_name} | NULL | Manual Review Required (Category mismatch: ${matchedProduct.category} vs ${item.category}) |`);
      manualReviewCount++;
      continue;
    }

    // Safe to update
    const { error } = await supabase.from('invoice_items').update({ service_id: matchedProduct.id }).eq('id', item.id);
    
    if (error) {
      console.error(`Failed to update item ${item.id}:`, error.message);
    } else {
      updatedCount++;
      report.push(`| ${item.invoice_id} | ${item.item_name} | ${matchedProduct.id} | Exact Name |`);
    }
  }

  report.unshift(`**Summary:**\n- Updated: ${updatedCount}\n- Skipped (Already Linked): ${skippedCount}\n- Manual Review Required: ${manualReviewCount}\n\n`);

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/historical_migration_report.md', report.join('\n'));
  console.log("Migration complete. Report generated.");
}

migrate();
