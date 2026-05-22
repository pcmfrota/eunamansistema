// Atualiza Mai/26: data_fim 2026-05-21, total_dias 30
const URL = "https://ffvwappomyuhyyeylpgt.supabase.co/rest/v1/calendario_suzano";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdndhcHBvbXl1aHl5ZXlscGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDczOTI5MCwiZXhwIjoyMDkwMzE1MjkwfQ.fKnqnMW0hnVWalOJD4NYDN2W6p4JJzPKAKzHlPlY4xc";

const headers = {
  "apikey": KEY,
  "Authorization": `Bearer ${KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

// 1. Buscar registro atual
const getRes = await fetch(`${URL}?ano=eq.2026&mes=eq.5&select=*`, { headers });
const rows = await getRes.json();
console.log("Registro atual:", JSON.stringify(rows, null, 2));

if (!rows || rows.length === 0) {
  console.log("Nenhum registro encontrado para Mai/26. Verificar tabela.");
  process.exit(1);
}

const id = rows[0].id;

// 2. Atualizar: data_fim = 2026-05-21, total_dias = 30
const patch = await fetch(`${URL}?id=eq.${id}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({
    data_fim: "2026-05-21",
    total_dias: 30
  })
});

const updated = await patch.json();
console.log("Status:", patch.status);
console.log("Resultado:", JSON.stringify(updated, null, 2));
