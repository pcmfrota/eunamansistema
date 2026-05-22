import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read env variables manually from .env.local
const envPath = path.join('c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log("Supabase URL:", url);

const supabase = createClient(url, key);

async function check() {
  const result: any = {};
  try {
    // Check one row of ordens_servico to see columns
    const { data: osRows, error: osError } = await supabase
      .from('ordens_servico')
      .select('*')
      .limit(1);

    result.osSample = osRows;
    result.osError = osError;

    // Check count of ordens_servico
    const { count, error: countError } = await supabase
      .from('ordens_servico')
      .select('*', { count: 'exact', head: true });
    
    result.totalOsCount = count;
    result.countError = countError;

    // Get unique classes/types
    const { data: equips, error: eqError } = await supabase
      .from('equipamentos')
      .select('tipo, id, placa')
      .limit(100);

    result.equipsCount = equips?.length || 0;
    result.equipsSample = equips?.slice(0, 5);
    result.eqError = eqError;

    fs.writeFileSync(
      path.join('c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema', 'tmp', 'debug_direct.json'),
      JSON.stringify(result, null, 2),
      'utf8'
    );
    console.log("Done diagnose!");
  } catch (e: any) {
    console.error("Error during diagnose:", e.message);
  }
}

check();
