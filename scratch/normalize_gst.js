const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: services, error } = await supabase.from('services').select('id, name, category, tax_rate');
  if (error) {
     console.error("DB Error:", error);
     return;
  }
  
  const updates = [];

  for (const p of services) {
    const rawRate = parseFloat(p.tax_rate);
    let newTaxRate = 18;
    
    if (isNaN(rawRate) || rawRate === null) {
       newTaxRate = p.category === 'Service' ? 5 : 18;
    } else if (rawRate <= 0.1) {
       newTaxRate = 5;
    } else if (rawRate <= 1) {
       newTaxRate = 18;
    } else if (rawRate < 10) {
       newTaxRate = 5;
    } else {
       newTaxRate = 18;
    }
    
    // Explicitly enforce Service=5, Retail=18 if we want, but let's just stick to mapping the numeric value correctly unless it's completely wrong.
    // Wait, the rule says: IF Item Type == Service GST Rate = 5. IF Item Type == Retail Product GST Rate = 18. 
    // Let's enforce exactly that for everything to guarantee 100% compliance.
    const expectedRate = p.category === 'Service' ? 5 : 18;

    if (rawRate !== expectedRate) {
       updates.push({
          id: p.id,
          name: p.name,
          old_tax: p.tax_rate,
          new_tax: expectedRate
       });
    }
  }

  console.log(`Found ${updates.length} records requiring normalization.`);
  
  let success = 0;
  for (const u of updates) {
     const { error: updErr } = await supabase.from('services').update({ tax_rate: String(u.new_tax) }).eq('id', u.id);
     if (updErr) {
         console.error(`Failed to update ${u.name}:`, updErr);
     } else {
         success++;
     }
  }
  console.log(`Successfully normalized ${success} records.`);
}
run();
