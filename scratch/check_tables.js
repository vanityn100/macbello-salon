require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTables() {
  const { data, error } = await supabase.from('loyalty_transactions').select('*').limit(1);
  console.log('loyalty_transactions:', error ? error.message : 'exists');

  const { data: d2, error: e2 } = await supabase.from('transactions').select('*').limit(1);
  console.log('transactions:', e2 ? e2.message : 'exists');
}

checkTables();
