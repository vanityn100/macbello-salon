const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envVars['NEXT_PUBLIC_SUPABASE_URL'], envVars['SUPABASE_SERVICE_ROLE_KEY']);

async function getTables() {
  const { data: stock_movements, error: err1 } = await supabase.from('stock_movements').select('*').limit(1);
  console.log('stock_movements exists:', !err1, err1?.message);
  
  const { data: audit, error: err2 } = await supabase.from('audit_logs').select('*').limit(1);
  console.log('audit_logs exists:', !err2);
}

getTables();
