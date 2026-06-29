// scratch/migration_warehouse.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');

let url, key;
envFile.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
  const sql = `
    ALTER TABLE services ADD COLUMN IF NOT EXISTS total_received INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS product_allocations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID REFERENCES services(id) ON DELETE CASCADE,
        branch VARCHAR(255) NOT NULL,
        allocated_quantity INTEGER DEFAULT 0,
        UNIQUE(product_id, branch)
    );

    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS source VARCHAR(255);
    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS destination VARCHAR(255);
    ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
    
    ALTER TABLE product_allocations ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "Product Allocations Policy" ON product_allocations;
    CREATE POLICY "Product Allocations Policy" ON product_allocations FOR ALL TO authenticated USING (true) WITH CHECK (true);
  `;

  const { error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) {
    console.error("RPC exec_sql failed. Trying REST workaround or manual via another tool.");
    console.error(error);
  } else {
    console.log("Migration successful!");
  }
}

run();
