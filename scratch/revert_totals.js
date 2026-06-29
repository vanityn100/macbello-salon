const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, subtotal, points_redeemed')
    .eq('created_by', 'system_import')
    .gt('points_redeemed', 0);

  if (error) {
    console.error("Error fetching invoices:", error);
    return;
  }

  for (const inv of invoices) {
    // Revert grand_total to be equal to subtotal
    const originalGrandTotal = parseFloat(inv.subtotal);
    
    console.log(`Reverting invoice ${inv.invoice_number}: setting grand_total back to ${originalGrandTotal}`);
    
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({ grand_total: originalGrandTotal })
      .eq('id', inv.id);
      
    if (updateErr) {
      console.error(`Error updating ${inv.invoice_number}:`, updateErr);
    }
  }

  console.log("Revert complete.");
}

run().catch(console.error);
