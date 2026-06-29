import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables manually
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
} else {
  console.error("No .env.local found.");
  process.exit(1);
}

const dbUrl = envConfig["DATABASE_URL"] || envConfig["POSTGRES_URL"];

if (!dbUrl) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to database.");
    
    // Read the SQL file
    const sqlPath = path.resolve(process.cwd(), ".gemini/antigravity/brain/cc1a1962-b79a-428c-8fa2-640dc7f5fabf/scratch/update_inventory_status.sql");
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log("Executing SQL...");
    await client.query(sql);
    console.log("SQL executed successfully! Trigger is now active.");
    
  } catch (err) {
    console.error("Error executing SQL:", err);
  } finally {
    await client.end();
  }
}

run();
