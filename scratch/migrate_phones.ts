import { createClient } from "@supabase/supabase-js";
import { normalizePhone } from "../src/lib/phone.js";
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

async function runMigration() {
  console.log("Starting Global Phone Normalization Migration...");
  
  const report = {
    totalScanned: 0,
    normalized: 0,
    alreadyValid: 0,
    invalid: 0,
    duplicateConflicts: 0,
    skipped: 0,
    conflicts: [] as any[],
    invalidNumbers: [] as any[]
  };

  // 1. Process Customers
  console.log("--- Scanning customers table ---");
  let { data: customers, error: customerErr } = await supabase.from("customers").select("id, name, phone");
  if (customerErr) throw customerErr;
  
  if (customers) {
    report.totalScanned += customers.length;
    
    // Check for uniqueness before updating
    const phoneMap = new Map<string, string>(); // E.164 -> Customer ID
    
    // Map out all current and target E.164 numbers to detect conflicts upfront
    for (const customer of customers) {
      const result = normalizePhone(customer.phone);
      if (!result.isValid || !result.normalized) {
        report.invalid++;
        report.invalidNumbers.push({ table: "customers", id: customer.id, original: customer.phone, reason: result.error });
        continue;
      }
      
      const e164 = result.normalized;
      if (phoneMap.has(e164) && phoneMap.get(e164) !== customer.id) {
        // Conflict! Another customer already claims this normalized number
        report.duplicateConflicts++;
        report.conflicts.push({
          e164,
          id1: phoneMap.get(e164),
          id2: customer.id,
          original: customer.phone
        });
      } else {
        phoneMap.set(e164, customer.id);
      }
    }
    
    // Perform updates if no conflict for that specific customer
    for (const customer of customers) {
      const result = normalizePhone(customer.phone);
      if (!result.isValid || !result.normalized) continue; // Tracked above
      
      const e164 = result.normalized;
      
      // If this customer is involved in a conflict, skip updating them for now
      const isConflict = report.conflicts.some(c => c.e164 === e164);
      if (isConflict) {
        report.skipped++;
        continue;
      }
      
      if (customer.phone === e164) {
        report.alreadyValid++;
        continue;
      }
      
      // Update
      const { error: updateErr } = await supabase.from("customers").update({ phone: e164 }).eq("id", customer.id);
      if (updateErr) {
        console.error(`Error updating customer ${customer.id}:`, updateErr);
      } else {
        report.normalized++;
      }
    }
  }

  // 2. Process Appointments
  console.log("--- Scanning appointments table ---");
  let { data: appointments, error: aptErr } = await supabase.from("appointments").select("id, customer_phone");
  if (aptErr) throw aptErr;
  
  if (appointments) {
    report.totalScanned += appointments.length;
    for (const apt of appointments) {
      if (!apt.customer_phone) continue;
      
      const result = normalizePhone(apt.customer_phone);
      if (!result.isValid || !result.normalized) {
        report.invalid++;
        report.invalidNumbers.push({ table: "appointments", id: apt.id, original: apt.customer_phone, reason: result.error });
        continue;
      }
      
      const e164 = result.normalized;
      if (apt.customer_phone === e164) {
        report.alreadyValid++;
        continue;
      }
      
      const { error: updateErr } = await supabase.from("appointments").update({ customer_phone: e164 }).eq("id", apt.id);
      if (updateErr) {
        console.error(`Error updating appointment ${apt.id}:`, updateErr);
      } else {
        report.normalized++;
      }
    }
  }

  // 3. Process Stock Purchases
  console.log("--- Scanning stock_purchases table ---");
  let { data: purchases, error: purErr } = await supabase.from("stock_purchases").select("id, supplier_phone");
  if (purErr) throw purErr;
  
  if (purchases) {
    report.totalScanned += purchases.length;
    for (const pur of purchases) {
      if (!pur.supplier_phone) continue;
      
      const result = normalizePhone(pur.supplier_phone);
      if (!result.isValid || !result.normalized) {
        report.invalid++;
        report.invalidNumbers.push({ table: "stock_purchases", id: pur.id, original: pur.supplier_phone, reason: result.error });
        continue;
      }
      
      const e164 = result.normalized;
      if (pur.supplier_phone === e164) {
        report.alreadyValid++;
        continue;
      }
      
      const { error: updateErr } = await supabase.from("stock_purchases").update({ supplier_phone: e164 }).eq("id", pur.id);
      if (updateErr) {
        console.error(`Error updating stock purchase ${pur.id}:`, updateErr);
      } else {
        report.normalized++;
      }
    }
  }

  console.log("\n================ MIGRATION REPORT ================");
  console.log(JSON.stringify(report, null, 2));
  console.log("==================================================");
  
  fs.writeFileSync("phone_migration_report.json", JSON.stringify(report, null, 2));
  console.log("Report saved to phone_migration_report.json");
}

runMigration().catch(console.error);
