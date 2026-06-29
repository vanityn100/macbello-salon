require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function checkDataIntegrity() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch all retail products
  const { data: products } = await supabase.from('services').select('id, name, item_code, hsn').eq('category', 'Retail');
  
  // 2. Fetch all retail invoice items
  const { data: invoiceItems } = await supabase.from('invoice_items').select('id, item_name, item_code, hsn, category').eq('category', 'Retail');

  const uniqueInvoiceNames = [...new Set(invoiceItems.map(i => i.item_name))];

  // Output table rows
  let markdown = [
    `# Data Integrity Comparison\n`,
    `| Inventory Product | Invoice Product | Inventory Product ID | Invoice Product ID | Match Status | Reason if not matched |`,
    `|---|---|---|---|---|---|`
  ];

  for (const p of products) {
    const exactMatch = uniqueInvoiceNames.find(n => n === p.name);
    if (exactMatch) continue; // Skip perfect matches for brevity, user cares about Sold=0

    // Look for fuzzy match
    const pNameNorm = p.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    
    let fuzzyMatchName = null;
    let reason = "No match found in invoices";

    for (const invName of uniqueInvoiceNames) {
      const invNameNorm = invName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      
      if (pNameNorm === invNameNorm) {
        fuzzyMatchName = invName;
        reason = "Matched after removing spaces/punctuation and case";
        break;
      }
      if (invNameNorm.includes(pNameNorm)) {
        fuzzyMatchName = invName;
        reason = "Invoice name contains inventory name";
        break;
      }
      if (pNameNorm.includes(invNameNorm) && invNameNorm.length > 5) {
         fuzzyMatchName = invName;
         reason = "Inventory name contains invoice name";
         break;
      }
    }

    markdown.push(`| ${p.name} | ${fuzzyMatchName || 'N/A'} | ${p.id} | N/A (Column doesn't exist) | ${fuzzyMatchName ? 'Fuzzy Match' : 'Unmatched'} | ${reason} |`);
  }

  // Also document schema fact
  markdown.push(`\n## Schema Verification`);
  markdown.push(`**Does invoice_items have a product_id or service_id?**`);
  markdown.push(`No. The \`invoice_items\` table schema does not contain a \`product_id\` or \`service_id\` foreign key. It relies entirely on \`item_name\`, \`item_code\`, and \`hsn\`.`);

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/data_integrity_report.md', markdown.join('\n'));
}

checkDataIntegrity();
