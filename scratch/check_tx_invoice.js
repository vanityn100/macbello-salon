require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('transactions').insert({
    customer_id: '10000000-0000-0000-0000-000000000000',
    transaction_type: 'add',
    points_change: 0,
    branch: 'Peruva',
    created_by_email: 'test',
    balance_after: 0,
    invoice_id: '10000000-0000-0000-0000-000000000000'
  }).select();
  
  if (error) {
     console.log(error);
  } else {
     console.log('Inserted:', data);
  }
}
run();
