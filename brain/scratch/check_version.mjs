import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

let supabaseUrl = '';
let supabaseServiceKey = '';

try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=([^\s]+)/)?.[1];
  supabaseServiceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=([^\s]+)/)?.[1];
} catch (e) {
  console.error('Error reading env:', e);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function check() {
  const { data, error } = await supabase.rpc('execute_sql_temp', { sql_query: 'SELECT version();' })
  if (error) {
    // If rpc doesn't exist, try querying a public API or we can just try to run a query.
    console.log('RPC execute_sql_temp failed, trying direct select:');
    // Let's try to query table info to see if we can connect
    const { data: tbls, error: tblsErr } = await supabase.from('equipamentos').select('id').limit(1);
    console.log('Equipamentos query status:', tblsErr ? tblsErr.message : 'OK');
  } else {
    console.log('Version info:', data);
  }
}
check();
