import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

const supabaseUrl = envConfig["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = envConfig["SUPABASE_SERVICE_ROLE_KEY"];
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

async function run() {
  let hasMore = true;
  let count = 0;
  while (hasMore) {
    const { data: items } = await supabase.from("invoice_items").select("id, tax_rate").gt("tax_rate", 1).limit(1000);
    
    if (!items || items.length === 0) {
      hasMore = false;
      break;
    }
    
    console.log(`Processing batch of ${items.length}...`);
    for (const i of items) {
      await supabase.from("invoice_items").update({ tax_rate: i.tax_rate / 100 }).eq("id", i.id);
      count++;
    }
  }
  
  console.log(`Finished fixing ${count} invoice_items.`);
}

run().catch(console.error);
