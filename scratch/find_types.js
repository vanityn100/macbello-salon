require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTypes() {
  const types = ['SALE', 'sale', 'STOCK_OUT', 'stock_out', 'OUT', 'out', 'BILLING', 'billing', 'INVOICE', 'invoice', 'RECEIVE', 'RETURN', 'TRANSFER', 'ALLOCATE', 'STOCK_IN', 'ADJUSTMENT'];
  for (const type of types) {
     const { data, error } = await supabase.from('inventory_transactions').insert({
       product_id: '39b81be2-b7db-4e0d-983c-7ee827bcca64',
       branch: 'Peruva',
       transaction_type: type,
       quantity: 1,
       created_by: 'peruva@gmail.com'
     }).select();
     if (error && error.code === '23514') {
        // failed constraint
     } else if (!error) {
        console.log('SUCCESS:', type);
        // delete it
        await supabase.from('inventory_transactions').delete().eq('id', data[0].id);
     } else {
        console.log('OTHER ERROR for', type, ':', error.message);
     }
  }
}
checkTypes();
