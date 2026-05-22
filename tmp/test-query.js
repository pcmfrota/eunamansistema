const fetch = require('node-fetch'); // wait, node-fetch might not be installed but Node 18+ has native fetch! Let's just use native fetch if available, otherwise require node-fetch or make it super safe.

const url = "https://ffvwappomyuhyyeylpgt.supabase.co";
const key = "sb_publishable_Mq3FIfJZHUqt0BjvnQ6LoA_isrFPOt2";

async function run() {
  console.log("=== LENDO TIPOS DE EQUIPAMENTOS DO BANCO ===");
  try {
    const res = await fetch(`${url}/rest/v1/equipamentos?select=placa,tipo,modelo&limit=20`, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });
    const data = await res.json();
    console.log("Equipamentos encontrados:", JSON.stringify(data, null, 2));

    const tipos = Array.from(new Set(data.map(d => d.tipo)));
    console.log("Tipos distintos no banco:", tipos);

    console.log("\n=== LENDO PLACAS E OS PARA O TIPO 'pipa' ===");
    const pipaPlacas = data.filter(d => String(d.tipo).toLowerCase() === 'pipa').map(d => d.placa);
    console.log("Placas do tipo pipa:", pipaPlacas);

    if (pipaPlacas.length > 0) {
      // Query OS for these plates
      const platesIn = pipaPlacas.map(p => `"${p}"`).join(',');
      const osRes = await fetch(`${url}/rest/v1/ordens_servico?select=placa,numero_os,status,descricao&placa=in.(${platesIn})&limit=10`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      });
      const osData = await osRes.json();
      console.log("OS correspondentes no banco:", JSON.stringify(osData, null, 2));
    }
  } catch (err) {
    console.error("Erro ao rodar query:", err);
  }
}

run();
