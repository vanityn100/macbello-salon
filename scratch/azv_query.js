require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function runAZVQueries() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  const startISO = new Date("2026-06-01T00:00:00.000Z").toISOString();
  const endISO = new Date("2026-06-30T23:59:59.999Z").toISOString();

  // Query 1: Exact Match
  const { data: exactMatch } = await supabase
    .from('invoice_items')
    .select(`
      item_name, quantity, category,
      invoices!inner(invoice_number, created_at, branch)
    `)
    .eq('item_name', 'AZV SUNSCREEN SPF 50')
    .gte('invoices.created_at', startISO)
    .lte('invoices.created_at', endISO);

  // Query 2: ILIKE Match
  const { data: ilikeMatch } = await supabase
    .from('invoice_items')
    .select(`
      item_name, quantity, category,
      invoices!inner(invoice_number, created_at, branch)
    `)
    .ilike('item_name', '%AZV%')
    .gte('invoices.created_at', startISO)
    .lte('invoices.created_at', endISO);

  let markdown = [
    `# AZV Raw Invoice Items Query Report\n`,
    `## 1. Exact Match: "AZV SUNSCREEN SPF 50"`,
    `Rows returned: ${exactMatch.length}\n`
  ];

  if (exactMatch.length > 0) {
    markdown.push(`| Invoice Number | Invoice Date | Branch | item_name | quantity | category |`);
    markdown.push(`|---|---|---|---|---|---|`);
    for (const row of exactMatch) {
      markdown.push(`| ${row.invoices.invoice_number} | ${row.invoices.created_at} | ${row.invoices.branch} | ${row.item_name} | ${row.quantity} | ${row.category} |`);
    }
  }

  markdown.push(`\n## 2. Partial Search: ILIKE "%AZV%"`);
  markdown.push(`Rows returned: ${ilikeMatch.length}\n`);

  if (ilikeMatch.length > 0) {
    markdown.push(`| Invoice Number | Invoice Date | Branch | item_name | quantity | category |`);
    markdown.push(`|---|---|---|---|---|---|`);
    for (const row of ilikeMatch) {
      markdown.push(`| ${row.invoices.invoice_number} | ${row.invoices.created_at} | ${row.invoices.branch} | ${row.item_name} | ${row.quantity} | ${row.category} |`);
    }
  }

  fs.writeFileSync('C:/Users/adoni/.gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/azv_query_results.md', markdown.join('\n'));
}

runAZVQueries();
