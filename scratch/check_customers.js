require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCustomers() {
  const { data, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
     console.error(error);
  } else if (data && data.length > 0) {
     console.log('Customer columns:', Object.keys(data[0]));
  } else {
     console.log('No customers found, cannot infer columns.');
     const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { query: `
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'customers';
     `});
     if(e2) console.log(e2);
     else console.log(d2);
  }
}
checkCustomers();
