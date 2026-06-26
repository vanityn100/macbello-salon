require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('branch_inventory').select('*').limit(1);
  if (error) {
    console.error("Error fetching branch_inventory:", error);
  } else {
    console.log("branch_inventory data:", data);
  }
}

main();
