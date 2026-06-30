import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
  console.log("Looking for customer 'Adonis'...");
  
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('id, name')
    .ilike('name', '%Adonis%');
    
  if (cErr) {
    console.error("Error finding customer:", cErr);
    return;
  }
  
  if (!customers || customers.length === 0) {
    console.log("No customer found matching 'Adonis'.");
    return;
  }
  
  for (const customer of customers) {
    console.log(`Found customer: ${customer.name} (ID: ${customer.id})`);
    
    // Find invoices
    const { data: invoices, error: invErr } = await supabase
      .from('invoices')
      .select('id')
      .eq('customer_id', customer.id);
      
    if (invErr) {
      console.error("Error fetching invoices:", invErr);
      continue;
    }
    
    const invoiceIds = invoices.map(i => i.id);
    console.log(`Found ${invoiceIds.length} invoices for this customer.`);
    
    if (invoiceIds.length > 0) {
      // Find retail invoice items to restore stock
      const { data: items, error: itmErr } = await supabase
        .from('invoice_items')
        .select('item_name, quantity, category')
        .in('invoice_id', invoiceIds)
        .eq('category', 'Retail');
        
      if (itmErr) {
        console.error("Error fetching invoice items:", itmErr);
      } else if (items && items.length > 0) {
        console.log(`Found ${items.length} retail items to restore stock for.`);
        for (const item of items) {
          const { data: service, error: srvErr } = await supabase
            .from('services')
            .select('id, current_stock')
            .eq('name', item.item_name)
            .eq('category', 'Retail')
            .single();
            
          if (service) {
            console.log(`Restoring ${item.quantity} stock for ${item.item_name}. Current: ${service.current_stock}`);
            await supabase
              .from('services')
              .update({ current_stock: service.current_stock + item.quantity })
              .eq('id', service.id);
              
            // Log compensating adjustment
            await supabase
              .from('inventory_transactions')
              .insert({
                product_id: service.id,
                transaction_type: 'ADJUSTMENT',
                quantity: item.quantity,
                created_by: 'system_cleanup_script',
                branch: 'HQ' // fallback
              });
          }
        }
      }
      
      // Delete invoices (cascade deletes invoice_items and invoice_audit_logs)
      console.log("Deleting invoices...");
      const { error: delInvErr } = await supabase
        .from('invoices')
        .delete()
        .in('id', invoiceIds);
        
      if (delInvErr) console.error("Error deleting invoices:", delInvErr);
    }
    
    // Delete customer (cascade deletes loyalty_audit_logs, transactions)
    console.log("Deleting customer record...");
    const { error: delCustErr } = await supabase
      .from('customers')
      .delete()
      .eq('id', customer.id);
      
    if (delCustErr) {
      console.error("Error deleting customer:", delCustErr);
    } else {
      console.log(`Successfully deleted customer ${customer.name} and all associated records.`);
    }
  }
}

run();
