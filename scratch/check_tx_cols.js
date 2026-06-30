require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('transactions').select('*').limit(1);
  if (error) {
     console.error(error);
  } else if (data && data.length > 0) {
     console.log('Transactions columns:', Object.keys(data[0]));
  } else {
     const { data: d2 } = await supabase.rpc('execute_sql', { query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions';
     `});
     console.log(d2);
  }
}
run();
