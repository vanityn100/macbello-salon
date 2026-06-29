import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

const supabaseUrl = envConfig["NEXT_PUBLIC_SUPABASE_URL"];
const supabaseKey = envConfig["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function run() {
  console.log("Fetching all products...");
  const { data: services, error: sErr } = await supabase
    .from("services")
    .select("id, status");

  if (sErr) throw sErr;
  
  console.log(`Found ${services.length} services. Syncing stock...`);
  
  for (const s of services) {
    if (s.status === 'archived' || s.status === 'ARCHIVED') continue; // Ignore archived

    const { data: inv, error: iErr } = await supabase
      .from("branch_inventory")
      .select("current_stock")
      .eq("service_id", s.id);
      
    if (iErr) throw iErr;
    
    const totalStock = inv.reduce((sum, item) => sum + (item.current_stock || 0), 0);
    
    let newStatus = 'ACTIVE';
    if (totalStock <= 0) newStatus = 'OUT OF STOCK';
    else if (totalStock === 1) newStatus = 'LOW STOCK';
    
    if (s.status !== newStatus) {
      console.log(`Updating ${s.id}: ${s.status} -> ${newStatus} (Stock: ${totalStock})`);
      await supabase.from("services").update({ status: newStatus }).eq("id", s.id);
    }
  }
  
  console.log("Done syncing statuses!");
}

run().catch(console.error);
