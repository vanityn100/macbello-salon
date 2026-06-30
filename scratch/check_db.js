require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('invoice_items').select('category, item_name').ilike('item_name', 'HYDRATING').limit(1).then(res => console.log(res.data));
