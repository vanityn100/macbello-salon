require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function debugAllInvoices() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");

  // 1. Fetch total invoices in month
  const { data: invoices } = await supabase.from('invoices').select('id, invoice_number').gte('created_at', startISO.toISOString()).lte('created_at', endISO.toISOString()).neq('status', 'archived');
  
  // 2. Fetch ALL invoice items using pagination
  let allInvoiceItems = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('id, item_name, quantity, invoices!inner(created_at, status)')
      .gte('invoices.created_at', startISO.toISOString())
      .lte('invoices.created_at', endISO.toISOString())
      .neq('invoices.status', 'archived')
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (!items || items.length === 0) break;
    allInvoiceItems = allInvoiceItems.concat(items);
    if (items.length < pageSize) break;
    page++;
  }

  // 3. Group by item_name
  const salesMap = {};
  for (const item of allInvoiceItems) {
    const name = item.item_name;
    if (!salesMap[name]) {
       salesMap[name] = { qty: 0, count: 0 };
    }
    salesMap[name].qty += item.quantity;
    salesMap[name].count += 1;
  }

  // 4. Match against Inventory
  const { data: rawProducts } = await supabase.from('services').select('id, name').eq('category', 'Retail');
  
  const report = [
    `# Global Inventory Aggregation Debug Report`,
    `**Total Invoices Found:** ${invoices.length}`,
    `**Total Invoice Items Found:** ${allInvoiceItems.length}`,
    `**Total Unique Products Sold:** ${Object.keys(salesMap).length}\n`,
    `## Top 20 Products by Sold Quantity`,
    `| Item Name | Sold Quantity | Invoice Items Matched |`,
    `|---|---|---|`
  ];
  
  const top20 = Object.keys(salesMap).map(k => ({ name: k, ...salesMap[k] })).sort((a, b) => b.qty - a.qty).slice(0, 20);
  for (const t of top20) {
    report.push(`| ${t.name} | ${t.qty} | ${t.count} |`);
  }

  report.push(`\n## Inventory Products Aggregation`);
  report.push(`| Inventory Product (\`item_name\`) | Sold Quantity | Number of matching invoice_items |`);
  report.push(`|---|---|---|`);

  for (const p of rawProducts) {
    const sales = salesMap[p.name];
    if (sales || p.name.includes('AZV')) {
      report.push(`| ${p.name} | ${sales ? sales.qty : 0} | ${sales ? sales.count : 0} |`);
    }
  }

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/global_aggregation_report.md', report.join('\n'));
}

debugAllInvoices();
