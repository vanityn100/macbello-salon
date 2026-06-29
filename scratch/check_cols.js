const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function getCols() {
  const { data, error } = await supabase.rpc('get_schema_info'); // doesn't exist
  // We can just select 1 row and Object.keys(data[0])
  const res = await supabase.from('services').select('*').limit(1);
  console.log(Object.keys(res.data[0]));
}
getCols();
