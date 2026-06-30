require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTypes() {
  const types = ['EARNED', 'earned', 'REDEEMED', 'redeemed', 'SALE', 'sale', 'INVOICE', 'invoice', 'ADD', 'add', 'EARN', 'earn', 'REDEEM', 'redeem'];
  for (const type of types) {
     const { data, error } = await supabase.from('transactions').insert({
       customer_id: '10000000-0000-0000-0000-000000000000',
       transaction_type: type,
       points_change: 0,
       branch: 'Peruva',
       created_by_email: 'test',
       balance_after: 0
     }).select();
     if (error && error.code === '23514') {
        // failed constraint
     } else if (!error) {
        console.log('SUCCESS:', type);
        await supabase.from('transactions').delete().eq('id', data[0].id);
     } else {
        console.log('VALID TYPE (failed later):', type, ':', error.message);
     }
  }
}
checkTypes();
