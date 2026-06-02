// Script para remover duplicatas do calendario_suzano
// Mantém apenas 1 entrada por mês/ano (a com menor ID)

const SUPABASE_URL = 'https://ffvwappomyuhyyeylpgt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmdndhcHBvbXl1aHl5ZXlscGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDczOTI5MCwiZXhwIjoyMDkwMzE1MjkwfQ.fKnqnMW0hnVWalOJD4NYDN2W6p4JJzPKAKzHlPlY4xc';

async function fetchAll() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/calendario_suzano?select=*&order=mes.asc,id.asc`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  });
  return res.json();
}

async function deleteById(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/calendario_suzano?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    }
  });
  return res.status;
}

async function main() {
  console.log('🔍 Buscando todos os registros do calendario_suzano...');
  const registros = await fetchAll();
  
  console.log(`📋 Total de registros encontrados: ${registros.length}`);
  registros.forEach(r => console.log(`  ID: ${r.id} | Mês: ${r.mes} | Ano: ${r.ano} | Início: ${r.data_inicio} | Fim: ${r.data_fim}`));

  // Agrupar por mes+ano
  const grupos = {};
  for (const r of registros) {
    const chave = `${r.mes}-${r.ano}`;
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(r);
  }

  console.log('\n🔄 Verificando duplicatas por mês/ano...');
  let deletados = 0;
  
  for (const [chave, lista] of Object.entries(grupos)) {
    if (lista.length > 1) {
      // Manter o primeiro (menor ID), deletar o resto
      const manter = lista[0];
      const deletar = lista.slice(1);
      console.log(`\n⚠️  Mês ${chave}: ${lista.length} registros - mantendo ID ${manter.id}`);
      for (const r of deletar) {
        console.log(`   🗑️  Deletando ID ${r.id}...`);
        const status = await deleteById(r.id);
        console.log(`   ✅ Status: ${status}`);
        deletados++;
      }
    } else {
      console.log(`✅ Mês ${chave}: OK (1 registro)`);
    }
  }

  console.log(`\n🎉 Concluído! ${deletados} duplicata(s) removida(s).`);
  
  // Verificação final
  console.log('\n📋 Estado final:');
  const final = await fetchAll();
  final.forEach(r => console.log(`  ID: ${r.id} | Mês: ${r.mes} | Ano: ${r.ano} | ${r.data_inicio} → ${r.data_fim}`));
}

main().catch(console.error);
