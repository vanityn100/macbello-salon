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
  const { data: services } = await supabase.from("services").select("id, tax_rate").gt("tax_rate", 1);
  console.log(`Found ${services?.length || 0} services with tax_rate > 1`);
  
  if (services && services.length > 0) {
    console.log("Fixing them...");
    for (const s of services) {
      await supabase.from("services").update({ tax_rate: s.tax_rate / 100 }).eq("id", s.id);
    }
  }

  const { data: items } = await supabase.from("invoice_items").select("id, tax_rate").gt("tax_rate", 1);
  console.log(`Found ${items?.length || 0} invoice_items with tax_rate > 1`);
  
  if (items && items.length > 0) {
    console.log("Fixing them...");
    for (const i of items) {
      await supabase.from("invoice_items").update({ tax_rate: i.tax_rate / 100 }).eq("id", i.id);
    }
  }
}

run().catch(console.error);
