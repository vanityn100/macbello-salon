require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCols() {
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'inventory_transactions';
  `});
  if(error) {
     // fallback
     const { data: d2, error: e2 } = await supabase.from('inventory_transactions').select('*').limit(1);
     console.log('first row:', d2);
  }
}

checkCols();
