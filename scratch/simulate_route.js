require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function simulateRoute() {
  const startDate = "2026-06-01";
  const endDate = "2026-06-30";
  const targetBranch = "Kaduthuruthy";

  const startISO = new Date(startDate);
  startISO.setHours(0, 0, 0, 0);
  const endISO = new Date(endDate);
  endISO.setHours(23, 59, 59, 999);

  let productQuery = adminSupabase
    .from("services")
    .select(`*, branch_inventory ( branch, current_stock, minimum_stock ), product_allocations ( branch, allocated_quantity )`)
    .eq("category", "Retail")
    .not("status", "in", '("archived","ARCHIVED")')
    .order("name", { ascending: true });

  const { data: rawProducts, error: pErr } = await productQuery;
  if (pErr) throw pErr;

  let products = rawProducts || [];
  if (targetBranch && targetBranch !== "All Branches") {
    products = products.filter((p) => 
      p.branch_inventory?.some((b) => b.branch === targetBranch)
    );
  }

  const { data: resetLog } = await adminSupabase.from("audit_logs").select("created_at").eq("action", "INVENTORY_RESET").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const resetTimestamp = resetLog ? new Date(resetLog.created_at) : null;

  let baseQuery = adminSupabase
    .from("invoice_items")
    .select(`item_name, quantity, line_total, tax_rate, invoices!inner(branch, created_at, status)`)
    .neq("invoices.status", "archived")
    .lte("invoices.created_at", endISO.toISOString());

  if (resetTimestamp && resetTimestamp > startISO) {
      baseQuery = baseQuery.gte("invoices.created_at", resetTimestamp.toISOString());
  } else {
      baseQuery = baseQuery.gte("invoices.created_at", startISO.toISOString());
  }

  console.log("resetTimestamp:", resetTimestamp);
  console.log("startISO:", startISO);
  let allSoldItems = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: iErr } = await baseQuery.range(page * pageSize, (page + 1) * pageSize - 1);
    if (iErr) throw iErr;
    if (pageData && pageData.length > 0) {
      allSoldItems = allSoldItems.concat(pageData);
      if (pageData.length < pageSize) hasMore = false;
      else page++;
    } else {
      hasMore = false;
    }
  }

  const salesMap = {};
  for (const sale of allSoldItems) {
    const name = sale.item_name;
    if (!salesMap[name]) {
      salesMap[name] = { qty: 0, taxable: 0, gst: 0, revenue: 0, matches: [] };
    }
    const lineTotal = parseFloat(sale.line_total) || 0;
    const rate = parseFloat(sale.tax_rate) || 0;
    const totalInc = lineTotal;
    const taxable = totalInc / (1 + rate);
    const gst = totalInc - taxable;

    salesMap[name].qty += sale.quantity;
    salesMap[name].taxable += taxable;
    salesMap[name].gst += gst;
    salesMap[name].revenue += totalInc;
    salesMap[name].matches.push(sale.item_name);
  }

  const report = products.map((p) => {
    const sales = salesMap[p.name] || { qty: 0, taxable: 0, gst: 0, revenue: 0, matches: [] };
    return {
      productName: p.name,
      quantitySold: sales.qty
    };
  });

  const enriching = report.find(p => p.productName === 'ENRICHING');
  console.log("Length:", allSoldItems.length);
  console.log("ENRICHING in final report:", enriching);
}

simulateRoute().catch(console.error);
