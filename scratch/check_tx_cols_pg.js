require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL
  });
  
  try {
    const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions';
    `);
    console.log(res.rows.map(r => r.column_name));
  } catch (err) {
    console.error("PG query failed:", err.message);
  } finally {
    pool.end();
  }
}
run();
