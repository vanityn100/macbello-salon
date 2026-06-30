require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRPC() {
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    SELECT pg_get_functiondef(oid) 
    FROM pg_proc 
    WHERE proname = 'create_invoice_with_inventory';
  `});
  console.log(data, error);
}

checkRPC();
