require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// We will try to call a standard RPC if we can't run raw SQL.
console.log("Checking for SQL connection...");
