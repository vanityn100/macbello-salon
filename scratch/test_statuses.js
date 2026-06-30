require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testStatus() {
  const statuses = [
    "active",
    "archived",
    "ACTIVE",
    "LOW STOCK",
    "OUT OF STOCK",
    "ARCHIVED"
  ];
  
  for (const s of statuses) {
    const { data, error } = await supabase.from('services').insert({
      name: 'TEST_' + s + '_' + Date.now(),
      category: 'Retail',
      price: 100,
      tax_rate: 18,
      status: s,
      current_stock: 0,
      minimum_stock: 5
    }).select();
    
    if (error) {
      console.log(`Failed for ${s}:`, error.message);
    } else {
      console.log(`Success for ${s}`);
      await supabase.from('services').delete().eq('id', data[0].id);
    }
  }
}

testStatus();
