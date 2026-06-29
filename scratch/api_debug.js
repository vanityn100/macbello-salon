require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debugAPI() {
  console.log("=== API DEBUG TRACE ===");
  const targetBranch = "Kaduthuruthy"; // Simulated UI dropdown
  const startISO = new Date("2026-06-01T00:00:00.000Z");
  const endISO = new Date("2026-06-30T23:59:59.999Z");

  // Step 1: Fetch all products and their branch inventory
  const { data: rawProducts, error: pErr } = await supabase
    .from("services")
    .select(`
      id, name, category, price, hsn, item_code, tax_rate, status, total_received,
      branch_inventory ( branch, current_stock, minimum_stock ),
      product_allocations ( branch, allocated_quantity )
    `)
    .eq("category", "Retail")
    .order("name", { ascending: true });

  let products = rawProducts || [];
  
  // Frontend filter logic replica from route.ts (line ~450):
  if (targetBranch && targetBranch !== "All Branches") {
    products = products.filter((p) => 
      p.branch_inventory?.some((b) => b.branch === targetBranch)
    );
  }
  console.log(`[DEBUG] Products after branch filter (${targetBranch}):`, products.length);

  // Step 2: Fetch Invoices
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

  // In my last edit, I removed the branch filter for invoices.
  
  const { data: soldItems, error: iErr } = await invoiceQuery;
  
  console.log(`[DEBUG] Total invoice items found:`, soldItems?.length || 0);

  // Step 3: Aggregate Sales
  const salesMap = {};
  for (const sale of soldItems || []) {
    const name = sale.item_name;
    if (!salesMap[name]) salesMap[name] = { qty: 0 };
    salesMap[name].qty += sale.quantity;
  }
  
  console.log(`[DEBUG] Total sold for ENRICHING across all branches:`, salesMap["ENRICHING"]?.qty || 0);

  // Step 4: Map to Frontend
  const report = products.map((p) => {
    const sales = salesMap[p.name] || { qty: 0 };
    let currentStock = 0;
    
    if (targetBranch === "All Branches" || !targetBranch) {
      currentStock = p.branch_inventory?.reduce((sum, b) => sum + (b.current_stock || 0), 0) || 0;
    } else {
      const branchRecord = p.branch_inventory?.find((b) => b.branch === targetBranch);
      if (branchRecord) {
        currentStock = branchRecord.current_stock;
      }
    }
    
    return {
      productId: p.id,
      productName: p.name,
      currentStock: currentStock,
      quantitySold: sales.qty
    };
  });

  const enriching = report.find(r => r.productName === "ENRICHING");
  console.log("[DEBUG] API Response for ENRICHING:", enriching);
}

debugAPI();
