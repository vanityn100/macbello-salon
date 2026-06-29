require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function normalize(name) {
  if (!name) return "";
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'")
    .toUpperCase();
}

async function simulate() {
  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");
  const targetBranch = "Kaduthuruthy";

  let baseQuery = adminSupabase
    .from("invoice_items")
    .select(`item_name, quantity, line_total, tax_rate, invoices!inner(branch, created_at, status)`)
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

  const salesMap = {};
  for (const item of allSoldItems) {
    const key = normalize(item.item_name);
    if (!salesMap[key]) {
      salesMap[key] = { qty: 0, taxable: 0, gst: 0, revenue: 0 };
    }
    const lineTotal = parseFloat(item.line_total) || 0;
    const rate = parseFloat(item.tax_rate) || 0;
    const totalInc = lineTotal;
    const taxable = totalInc / (1 + rate);
    const gst = totalInc - taxable;
    salesMap[key].qty += item.quantity;
    salesMap[key].taxable += taxable;
    salesMap[key].gst += gst;
    salesMap[key].revenue += totalInc;
  }

  const { data: rawProducts } = await adminSupabase.from("services").select(`*, branch_inventory ( branch, current_stock, minimum_stock )`).eq("category", "Retail");
  
  let products = rawProducts || [];
  products = products.filter((p) => p.branch_inventory?.some((b) => b.branch === targetBranch));
  
  const report = products.map((p) => {
    const key = normalize(p.name);
    const sales = salesMap[key] || { qty: 0, taxable: 0, gst: 0, revenue: 0 };
    return {
      productName: p.name,
      key,
      quantitySold: sales.qty,
      revenue: sales.revenue
    };
  });
  
  const targets = ["ENRICHING", "FLO W ONE SHAMPOO 300ML", "HYDRATING", "KEUNE DEV 6% 20VOL 1000ML", "KRONE ANTI DANDRUFF CONTROL MASQUE 100ML", "SPA ANTI HAIRLOSS SERUM"];
  
  for (const t of targets) {
    const match = report.find(p => normalize(p.productName) === normalize(t));
    if (match) {
        console.log(`[Validation Output] ${match.productName} | Normalized: ${match.key} | Sold Quantity: ${match.quantitySold} | Revenue: ${match.revenue}`);
    } else {
        console.log(`[Validation Output] Missing product entirely from API: ${t}`);
    }
  }
}
simulate().catch(console.error);
