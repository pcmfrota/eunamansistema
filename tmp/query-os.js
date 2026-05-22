const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
const serviceRoleKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/)?.[1]?.trim();

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Supabase config missing!");
  process.exit(1);
}

async function run() {
  console.log("Fetching equipments...");
  const eqRes = await fetch(`${supabaseUrl}/rest/v1/equipamentos?select=*`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  });
  const equips = await eqRes.json();
  console.log(`Found ${equips.length} equipments.`);

  console.log("\nFetching OSs...");
  const osRes = await fetch(`${supabaseUrl}/rest/v1/ordens_servico?select=*`, {
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`
    }
  });
  const osList = await osRes.json();
  console.log(`Found ${osList.length} OSs.`);

  // Write a breakdown to analyse what's in the database
  const analysis = {
    equipments_by_tipo: {},
    os_sample: osList.slice(0, 10),
    os_unmatched_plates: [],
    os_by_placa: {},
    equips: equips.map(e => ({ id: e.id, placa: e.placa, tipo: e.tipo, categoria: e.categoria }))
  };

  equips.forEach(e => {
    const t = e.tipo || 'NULL';
    analysis.equipments_by_tipo[t] = (analysis.equipments_by_tipo[t] || 0) + 1;
  });

  const equipPlates = new Set(equips.map(e => (e.placa || '').toUpperCase().trim()));

  osList.forEach(os => {
    const p = (os.placa || '').toUpperCase().trim();
    analysis.os_by_placa[p] = (analysis.os_by_placa[p] || 0) + 1;
    if (!equipPlates.has(p)) {
      analysis.os_unmatched_plates.push({
        id: os.id,
        numero_os: os.numero_os,
        placa: os.placa,
        equipamento_id: os.equipamento_id,
        descricao: os.descricao
      });
    }
  });

  fs.writeFileSync(path.join(__dirname, 'db_dump_analysis.json'), JSON.stringify(analysis, null, 2), 'utf-8');
  console.log("\nAnalysis written to tmp/db_dump_analysis.json");
}

run().catch(console.error);
