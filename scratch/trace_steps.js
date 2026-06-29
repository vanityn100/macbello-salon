require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function simulate() {
  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");
  const targetBranch = "Kaduthuruthy";

  console.log("=== STEP 1 ===");
  let baseQuery = adminSupabase
    .from("invoice_items")
    .select(`
      item_name, quantity, line_total, tax_rate,
      invoices!inner(branch, created_at, status)
    `)
    .neq("invoices.status", "archived")
    .lte("invoices.created_at", endISO.toISOString())
    .gte("invoices.created_at", startISO.toISOString());

  let allSoldItems = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data: pageData, error: iErr } = await baseQuery.range(page * 1000, (page + 1) * 1000 - 1);
    if (iErr) throw iErr;
    if (pageData && pageData.length > 0) {
      allSoldItems = allSoldItems.concat(pageData);
      if (pageData.length < 1000) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }

  const enrichingItems = allSoldItems.filter(i => i.item_name === 'ENRICHING');
  console.log("Raw items for ENRICHING:", enrichingItems.length);
  if (enrichingItems.length > 0) {
    console.log("Example:", enrichingItems[0]);
  }

  console.log("\n=== STEP 2 ===");
  const salesMap = {};
  for (const item of allSoldItems) {
    const name = item.item_name;
    if (!salesMap[name]) salesMap[name] = { qty: 0 };
    salesMap[name].qty += item.quantity;
  }
  console.log("salesMap['ENRICHING'] ->", salesMap['ENRICHING']);

  console.log("\n=== STEP 3 ===");
  const { data: rawProducts } = await adminSupabase.from("services").select(`*, branch_inventory ( branch, current_stock, minimum_stock )`).eq("category", "Retail");
  
  let products = rawProducts || [];
  products = products.filter((p) => p.branch_inventory?.some((b) => b.branch === targetBranch));
  
  const report = products.map((p) => {
    const sales = salesMap[p.name] || { qty: 0 };
    return {
      productName: p.name,
      quantitySold: sales.qty
    };
  });
  
  const enrichingObj = report.find(p => p.productName === 'ENRICHING');
  console.log("Inventory Product Object before returning API:");
  console.log(enrichingObj);

}
simulate().catch(console.error);
