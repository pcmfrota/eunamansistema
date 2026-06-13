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

async function run() {
  const res = await supabase.from('equipamentos')
    .select('id, placa, tipo, categoria, modulo, modelo, status, area, created_at, deleted_at')
    .limit(5);
  
  if (res.error) {
    console.error('DATABASE QUERY ERROR:', res.error.message);
  } else {
    console.log('QUERY SUCCESSFUL, count:', res.data.length);
    console.log('Sample row:', res.data[0]);
  }
}
run();
