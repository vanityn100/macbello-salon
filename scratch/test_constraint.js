require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data, error } = await supabase.from('inventory_transactions').insert({
    product_id: '39b81be2-b7db-4e0d-983c-7ee827bcca64',
    branch: 'Peruva',
    transaction_type: 'INVALID',
    quantity: 1,
    created_by: 'peruva@gmail.com'
  }).select();
  
  if (error) {
     console.log(error);
  } else {
     console.log('Inserted:', data);
  }
}
run();
