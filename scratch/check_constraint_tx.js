require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkConstraint() {
  const { data, error } = await supabase.rpc('execute_sql', { query: `
    SELECT pg_get_constraintdef(oid) 
    FROM pg_constraint 
    WHERE conname = 'inventory_transactions_transaction_type_check';
  `});
  if(error) {
     // Fetch distinct transaction types instead
     const { data: tx, error: err2 } = await supabase.from('inventory_transactions').select('transaction_type');
     const types = new Set(tx?.map(t => t.transaction_type));
     console.log('Valid transaction types seen in db:', Array.from(types));
  } else {
     console.log(data);
  }
}

checkConstraint();
