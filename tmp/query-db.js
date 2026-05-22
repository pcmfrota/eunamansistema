const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Key not found in .env.local");
  process.exit(1);
}

async function run() {
  console.log("Fetching Equipments...");
  const eqRes = await fetch(`${supabaseUrl}/rest/v1/equipamentos?select=id,placa,tipo,modelo,modulo,categoria`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  const equips = await eqRes.json();
  console.log(`Found ${equips.length} equipments:`);
  console.log(equips.slice(0, 10));

  console.log("\nFetching Count of ordens_servico...");
  const osCountRes = await fetch(`${supabaseUrl}/rest/v1/ordens_servico?select=id`, {
    method: 'HEAD',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Range': '0-0',
      'Prefer': 'count=exact'
    }
  });
  console.log("OS count headers:", osCountRes.headers.get('content-range'));

  console.log("\nFetching recent 5 ordens_servico...");
  const osRes = await fetch(`${supabaseUrl}/rest/v1/ordens_servico?select=id,numero_os,status,descricao,data_abertura,data_fechamento,horario_parada,horas_manutencao,placa,equipamento_id&limit=5`, {
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`
    }
  });
  const oss = await osRes.json();
  console.log(oss);
}

run().catch(console.error);
