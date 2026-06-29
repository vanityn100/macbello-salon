const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const fileContent = fs.readFileSync('scratch/june_data.txt', 'utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');
  
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = lines.slice(1).map(line => line.split('\t').map(col => col ? col.trim() : ''));

  let importedCount = 0;

  for (const row of rows) {
    if (row.length < 5) continue; // Skip invalid or total rows

    const rawDate = row[0]; // DD/MM/YYYY
    if (!rawDate.includes('/')) {
        console.log("Skipping total row:", row);
        continue;
    }
    const invoiceNoStr = row[1];
    const customerName = row[2] || 'WALK IN CUSTOMER';
    let customerPhone = row[3] || '';
    
    // Sometimes phone numbers are empty or invalid. If empty, generate a dummy or find walk-in
    if (!customerPhone || customerPhone.length < 5) {
      customerPhone = `00000${Math.floor(Math.random() * 99999)}`;
    }

    const totalAmount = parseFloat(row[4]) || 0;
    const loyaltyRedeemed = parseFloat(row[5]) || 0;
    const paymentMethod = row[6] || 'Cash';

    const pointsEarned = Math.floor(totalAmount / 10);

    // Parse date (DD/MM/YYYY -> Date object)
    const [dd, mm, yyyy] = rawDate.split('/');
    const dateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);

    // 1. Lookup or create customer
    let { data: existingCustomer } = await supabase
      .from('customers')
      .select('id, points')
      .eq('phone', customerPhone)
      .single();

    if (!existingCustomer) {
      const { data: newCustomer, error: createCustErr } = await supabase
        .from('customers')
        .insert([{
          name: customerName,
          phone: customerPhone,
          branch: 'Kaduthuruthy',
          points: 0
        }])
        .select()
        .single();
      
      if (createCustErr) {
        console.error("Error creating customer", customerPhone, createCustErr);
        continue;
      }
      existingCustomer = newCustomer;
    }

    // 2. Insert Invoice
    const invoiceNumber = `INV-${yyyy}${mm}${dd}-${invoiceNoStr}`;
    
    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert([{
        invoice_number: invoiceNumber,
        customer_id: existingCustomer.id,
        subtotal: totalAmount,
        total_tax: 0,
        service_tax: 0,
        retail_tax: 0,
        discount: 0,
        grand_total: totalAmount,
        points_earned: pointsEarned,
        points_redeemed: loyaltyRedeemed,
        payment_method: paymentMethod,
        branch: 'Kaduthuruthy',
        status: 'active',
        created_at: dateObj.toISOString(),
        created_by: 'system_import'
      }])
      .select()
      .single();

    if (invErr) {
      if (invErr.code === '23505') {
        console.log(`Invoice ${invoiceNumber} already exists. Skipping.`);
        continue;
      }
      console.error("Error creating invoice", invoiceNumber, invErr);
      continue;
    }

    // 3. Insert Invoice Item (dummy item for the full amount so it calculates in reports)
    const { error: itemErr } = await supabase
      .from('invoice_items')
      .insert([{
        invoice_id: invoice.id,
        item_name: 'Imported Service',
        category: 'Service',
        quantity: 1,
        unit_price: totalAmount,
        line_total: totalAmount,
        tax_rate: 0
      }]);

    if (itemErr) {
      console.error("Error creating invoice item for", invoiceNumber, itemErr);
    }

    // 4. Handle Loyalty Transactions
    if (loyaltyRedeemed > 0) {
      await supabase.from('transactions').insert([{
        customer_id: existingCustomer.id,
        type: 'redeemed',
        points: loyaltyRedeemed,
        description: `Imported redeemed for ${invoiceNumber}`,
        reference_id: invoice.id,
        created_by: 'system_import',
        created_at: dateObj.toISOString()
      }]);
      await supabase.from('customers').update({
        points: existingCustomer.points - loyaltyRedeemed
      }).eq('id', existingCustomer.id);
      existingCustomer.points -= loyaltyRedeemed; // update local ref
    }

    if (pointsEarned > 0) {
      await supabase.from('transactions').insert([{
        customer_id: existingCustomer.id,
        type: 'earned',
        points: pointsEarned,
        description: `Imported earned for ${invoiceNumber}`,
        reference_id: invoice.id,
        created_by: 'system_import',
        created_at: dateObj.toISOString()
      }]);
      await supabase.from('customers').update({
        points: existingCustomer.points + pointsEarned
      }).eq('id', existingCustomer.id);
    }

    importedCount++;
    console.log(`Imported invoice ${invoiceNumber} for ${customerName}`);
  }

  console.log(`\nImport complete! Total invoices imported: ${importedCount}`);
}

run().catch(console.error);
