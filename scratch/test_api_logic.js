require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function test() {
  // Simulate what the API route does
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  let invoiceQuery = supabase
          .from("invoice_items")
          .select(`
            item_name, quantity, line_total, tax_rate,
            invoices!inner(branch, created_at, status)
          `)
          .eq("category", "Retail")
          .neq("invoices.status", "archived")
          .gte("invoices.created_at", "2026-06-01T00:00:00.000Z")
          .lte("invoices.created_at", "2026-06-30T23:59:59.999Z");
          
  // We omitted the Warehouse filter.
  
  const { data: soldItems, error: iErr } = await invoiceQuery;
  console.log("Sold Items fetched:", soldItems?.length, "Error:", iErr);
  
  const salesMap = {};
  for (const sale of soldItems || []) {
    const name = sale.item_name;
    if (!salesMap[name]) salesMap[name] = { qty: 0 };
    salesMap[name].qty += sale.quantity;
  }
  console.log("Sales for ENRICHING:", salesMap["ENRICHING"]);
  console.log("Sales for AZV SUNSCREEN SPF 50:", salesMap["AZV SUNSCREEN SPF 50"]);
}

test();
