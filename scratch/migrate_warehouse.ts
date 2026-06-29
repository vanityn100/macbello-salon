import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), ".env.local");
let envConfig: Record<string, string> = {};

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, "utf-8");
  envFile.split("\n").forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      envConfig[match[1].trim()] = match[2].trim();
    }
  });
}

const dbUrl = envConfig["DATABASE_URL"] || envConfig["POSTGRES_URL"];

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    
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
    
    await client.query(sql);
    console.log("Migration successful!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

run();
