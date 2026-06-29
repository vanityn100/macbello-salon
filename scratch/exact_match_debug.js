require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function debugInventory() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. Fetch inventory items
  const { data: rawProducts } = await supabase.from('services').select('id, name, category, branch_inventory(branch, current_stock)').eq('category', 'Retail');
  let products = rawProducts || [];
  
  // No targetBranch filter here as we want all operational branches
  
  // 2. Fetch invoice items
  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");
  
  let invoiceQuery = supabase
    .from("invoice_items")
    .select(`
      item_name, quantity, line_total, tax_rate,
      invoices!inner(branch, created_at, status)
    `)
    .eq("category", "Retail")
    .neq("invoices.status", "archived")
    .lte("invoices.created_at", endISO.toISOString())
    .gte("invoices.created_at", startISO.toISOString());
    
  const { data: soldItems, error: iErr } = await invoiceQuery;
  
  const salesMap = {};
  
  for (const sale of soldItems || []) {
    const name = sale.item_name;
    if (!salesMap[name]) {
      salesMap[name] = { qty: 0, taxable: 0, gst: 0, revenue: 0, matches: [] };
    }
    
    const lineTotal = parseFloat(sale.line_total) || 0;
    salesMap[name].qty += sale.quantity;
    salesMap[name].revenue += lineTotal;
    salesMap[name].matches.push(sale.item_name);
  }

  let markdown = [
    `# Inventory Exact Match Debug Report\n`,
    `**Total Retail Invoice Items Found (June 2026):** ${soldItems.length}\n`,
    `| Inventory Product (\`item_name\`) | Matched Invoice Items | Total Qty Found Before API Response | Final \`quantitySold\` |\n`,
    `|---|---|---|---|`
  ];

  for (const p of products) {
    const sales = salesMap[p.name] || { qty: 0, taxable: 0, gst: 0, revenue: 0, matches: [] };
    
    // As per user instructions: "If the item names are identical, the Sold value must not be 0."
    // Print the inventory item name, the matching invoice item names, total quantity found, final quantity sold
    const matchString = sales.matches.length > 0 ? sales.matches.map(m => `"${m}"`).join(", ") : "None";
    
    // Only output if the product has some activity or stock to keep report readable, OR if it's the ENRICHING/AZV products they mentioned.
    if (sales.qty > 0 || p.name.includes("AZV") || p.name === "ENRICHING" || p.name.includes("FLO W ONE")) {
      markdown.push(`| \`${p.name}\` | ${matchString} | ${sales.qty} | **${sales.qty}** |`);
    }
  }

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/exact_match_debug.md', markdown.join('\n'));
}

debugInventory();
