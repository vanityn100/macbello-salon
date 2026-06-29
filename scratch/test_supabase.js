require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function testSupabase() {
  const adminSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  let baseQuery = adminSupabase
    .from("invoice_items")
    .select(`item_name, quantity, invoices!inner(branch, created_at, status)`)
    .neq("invoices.status", "archived");

  let allSoldItems = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData, error: iErr } = await baseQuery.range(page * pageSize, (page + 1) * pageSize - 1);
    if (iErr) {
      console.error(iErr);
      break;
    }
    if (pageData && pageData.length > 0) {
      allSoldItems = allSoldItems.concat(pageData);
      if (pageData.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  console.log("Total Fetched:", allSoldItems.length);
}

testSupabase();
