const URL = "https://ffvwappomyuhyyeylpgt.supabase.co/rest/v1/calendario_suzano";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdndhcHBvbXl1aHl5ZXlscGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDczOTI5MCwiZXhwIjoyMDkwMzE1MjkwfQ.fKnqnMW0hnVWalOJD4NYDN2W6p4JJzPKAKzHlPlY4xc";

const headers = {
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

async function updateMonth(mes, data_inicio, data_fim, total_dias) {
  console.log(`\n🔍 Buscando registro de 2026 mes ${mes}...`);
  const getRes = await fetch(`${URL}?ano=eq.2026&mes=eq.${mes}&select=*`, { headers });
  const rows = await getRes.json();
  
  if (!rows || rows.length === 0) {
    console.log(`❌ Registro de mes ${mes}/2026 não encontrado!`);
    return;
  }
  
  const id = rows[0].id;
  console.log(`✅ Registro encontrado (ID: ${id}). Atualizando para: ${data_inicio} até ${data_fim} (${total_dias} dias)...`);
  
  const patch = await fetch(`${URL}?id=eq.${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      data_inicio,
      data_fim,
      total_dias
    })
  });
  
  const updated = await patch.json();
  if (patch.status >= 200 && patch.status < 300) {
    console.log(`🎉 Sucesso! Mês ${mes} atualizado.`);
  } else {
    console.log(`❌ Erro ao atualizar mês ${mes}:`, JSON.stringify(updated, null, 2));
  }
}

async function run() {
  try {
    // 1. Atualiza Junho: 22/05/2026 a 15/06/2026 (25 dias)
    await updateMonth(6, "2026-05-22", "2026-06-15", 25);
    
    // 2. Atualiza Julho: 16/06/2026 a 22/07/2026 (37 dias)
    await updateMonth(7, "2026-06-16", "2026-07-22", 37);
    
    console.log("\n🚀 Todas as atualizações de calendário foram concluídas!");
  } catch (error) {
    console.error("Erro na execução do script:", error);
  }
}

run();
