require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testCreate() {
  const payload = {
    name: 'Shampoo Test',
    category: 'Retail',
    price: 500,
    branch: null,
    hsn: '999729',
    tax_rate: 0.05,
    item_code: 'MAC999',
    status: 'OUT OF STOCK',
    current_stock: 0,
    minimum_stock: 5
  };

  const { data, error } = await supabase.from('services').insert(payload).select().single();
  console.log("Create product:", error ? error.message : "Success!");

  if (!error && data) {
    console.log("Data inserted:", data.id);
    await supabase.from('services').delete().eq('id', data.id);
  }
}

testCreate();
