require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
  });
  
  try {
    const res = await pool.query(`
      SELECT pg_get_constraintdef(oid) 
      FROM pg_constraint 
      WHERE conname = 'inventory_transactions_transaction_type_check';
    `);
    console.log(res.rows);
  } catch (err) {
    console.error("PG query failed:", err.message);
  } finally {
    pool.end();
  }
}
run();
