require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase
    .from('information_schema.check_constraints')
    .select('*')
    .eq('constraint_name', 'services_status_check');
  console.log('Result:', data, error);
}

check();
