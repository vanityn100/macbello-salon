require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function generateDebugReport() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const targetBranch = "Kaduthuruthy";
  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");

  const { data: rawProducts } = await supabase
    .from("services")
    .select(`id, name, category, branch_inventory(branch, current_stock)`)
    .eq("category", "Retail");
    
  let products = rawProducts || [];
  if (targetBranch && targetBranch !== "All Branches") {
    products = products.filter(p => p.branch_inventory?.some(b => b.branch === targetBranch));
  }

  const { data: soldItems } = await supabase
    .from("invoice_items")
    .select(`item_name, quantity, invoices!inner(branch, created_at, status)`)
    .eq("category", "Retail")
    .neq("invoices.status", "archived")
    .lte("invoices.created_at", endISO.toISOString())
    .gte("invoices.created_at", startISO.toISOString());

  const salesMap = {};
  for (const sale of soldItems || []) {
    if (!salesMap[sale.item_name]) salesMap[sale.item_name] = { qty: 0 };
    salesMap[sale.item_name].qty += sale.quantity;
  }

  const report = products.map(p => {
    const whStock = p.branch_inventory?.find(b => b.branch === "Warehouse")?.current_stock || 0;
    const sold = salesMap[p.name]?.qty || 0;
    return {
      productName: p.name,
      warehouseStock: whStock,
      totalSoldAcrossAllBranches: sold,
      invoiceItemsFoundForThisProduct: soldItems.filter(s => s.item_name === p.name).length
    };
  });

  const markdown = [
    `# Inventory API Debug Report\n`,
    `**Total Invoice Items Found (All Retail, June 2026):** ${soldItems.length}\n`,
    `| Product Name | Warehouse Stock | Invoices Found | Calculated Sold |\n`,
    `|---|---|---|---|\n`
  ];

  for (const r of report) {
    if (r.warehouseStock > 0 || r.totalSoldAcrossAllBranches > 0) {
      markdown.push(`| ${r.productName} | ${r.warehouseStock} | ${r.invoiceItemsFoundForThisProduct} | **${r.totalSoldAcrossAllBranches}** |`);
    }
  }

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/debug_report.md', markdown.join('\n'));
}

generateDebugReport();
