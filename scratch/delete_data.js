const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function deleteData() {
  console.log('Starting data deletion...');

  try {
    // We must delete in the correct order to respect foreign key constraints
    
    // 1. Delete audit logs related to invoices and customers
    console.log('Deleting audit logs for customers and invoices...');
    await supabase.from('audit_logs').delete().like('action', 'customer%');
    await supabase.from('audit_logs').delete().like('action', 'invoice%');
    await supabase.from('audit_logs').delete().like('action', 'payment%');
    await supabase.from('audit_logs').delete().like('action', 'appointment%');
    
    // 2. Delete invoice items
    console.log('Deleting invoice items...');
    await supabase.from('invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 3. Delete invoice audit logs and loyalty audit logs
    console.log('Deleting invoice audit logs and loyalty audit logs...');
    const { error: err_ial } = await supabase.from('invoice_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err_ial && err_ial.code !== '42P01') console.error('invoice_audit_logs err:', err_ial);
    const { error: err_lal } = await supabase.from('loyalty_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (err_lal && err_lal.code !== '42P01') console.error('loyalty_audit_logs err:', err_lal);
    
    // 4. Delete transactions (loyalty, payments)
    console.log('Deleting transactions...');
    await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 5. Delete appointments
    console.log('Deleting appointments...');
    await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 6. Delete invoices
    console.log('Deleting invoices...');
    await supabase.from('invoices').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // 7. Delete customers
    console.log('Deleting customers...');
    await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Deletion completed successfully.');
  } catch (error) {
    console.error('Error during deletion:', error);
  }
}

deleteData();
