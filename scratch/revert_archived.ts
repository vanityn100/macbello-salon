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
  const idsToRevert = [
    "8baac068-15d9-4d4f-b52a-822a70634bc2",
    "698f5d9d-67ff-43df-a33d-4534f8208862",
    "6eee858b-c240-4239-b257-6a1df1f93cf2",
    "28b59a1c-70c9-4a07-b39d-de47027f0322",
    "6528790f-fe38-4f37-83b8-0df22721dc8e",
    "8217c78e-67b1-45fb-a55b-4ecf0f014df5",
    "15584117-59e5-48cc-81f0-36215269a187",
    "0ba7086f-41dd-4ceb-858c-1abb134d6726",
    "076dbc63-86c0-49d1-8fe6-4977da8e85c3"
  ];

  for (const id of idsToRevert) {
    console.log(`Reverting ${id} to archived`);
    await supabase.from("services").update({ status: "archived" }).eq("id", id);
  }
  
  console.log("Done reverting!");
}

run().catch(console.error);
