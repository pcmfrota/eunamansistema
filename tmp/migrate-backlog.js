import fs from 'fs';
import path from 'path';

const projectPath = 'c:\\Users\\jessi\\OneDrive\\Área de Trabalho\\EUNAMAN SISTEMA\\eunamansistema';
const envPath = path.join(projectPath, '.env.local');

async function run() {
  if (!fs.existsSync(envPath)) {
    console.error('Arquivo .env.local não encontrado!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
  const supabaseAnonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('URL ou Chave do Supabase não encontradas!');
    process.exit(1);
  }

  const headers = {
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  console.log('--- Buscando registros do backlog para migração ---');

  const res = await fetch(`${supabaseUrl}/rest/v1/backlog?select=id,status,criticidade,status_programacao`, {
    headers
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Erro ao buscar dados:', errText);
    process.exit(1);
  }

  const items = await res.json();
  console.log(`Total de registros encontrados: ${items.length}`);

  let updatedCount = 0;

  for (const item of items) {
    let newStatus = item.status;
    let newCrit = item.criticidade;

    // 1. Mapeamento de Status
    const statusLower = String(item.status || '').toLowerCase().trim();
    if (statusLower === 'aberta' || statusLower === 'em andamento' || statusLower === '') {
      newStatus = 'PENDENTE';
    } else if (statusLower === 'concluido' || statusLower === 'concluida' || statusLower === 'concluída' || statusLower === 'encerrada' || statusLower === 'encerrado' || statusLower === 'concluído') {
      newStatus = 'ENCERRADO';
    } else if (statusLower === 'programado' || statusLower === 'programada') {
      newStatus = 'PROGRAMADO';
    }

    // 2. Mapeamento de Criticidade
    const critUpper = String(item.criticidade || '').toUpperCase().trim();
    if (critUpper === 'A' || critUpper === 'INTERDIÇÃO' || critUpper === 'ALTA' || critUpper === 'INTERDICAO') {
      newCrit = 'A';
    } else {
      newCrit = 'B';
    }

    if (newStatus !== item.status || newCrit !== item.criticidade) {
      // Atualiza o item individualmente para precisão
      const patchRes = await fetch(`${supabaseUrl}/rest/v1/backlog?id=eq.${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: newStatus,
          criticidade: newCrit
        })
      });

      if (patchRes.ok) {
        updatedCount++;
      } else {
        console.error(`Erro ao atualizar item ${item.id}:`, await patchRes.text());
      }
    }
  }

  console.log(`Migração concluída! Total de registros atualizados no Supabase: ${updatedCount}`);
}

run().catch(console.error);
