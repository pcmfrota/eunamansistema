
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente do Supabase não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("--- TESTE DE CONEXÃO E DADOS ---");
  
  // 1. Contar Equipamentos
  const { count: eqCount, error: eqErr } = await supabase
    .from('equipamentos')
    .select('*', { count: 'exact', head: true });
  console.log(`Equipamentos: ${eqCount} (Erro: ${eqErr?.message || 'Nenhum'})`);

  // 2. Contar OS (Sem filtros)
  const { count: osCount, error: osErr } = await supabase
    .from('ordens_servico')
    .select('*', { count: 'exact', head: true });
  console.log(`Total de OS no banco: ${osCount} (Erro: ${osErr?.message || 'Nenhum'})`);

  // 3. Verificar uma OS para ver o formato da data
  const { data: osExemplo } = await supabase
    .from('ordens_servico')
    .select('data_abertura, data_fechamento')
    .limit(1);
  if (osExemplo?.[0]) {
    console.log("Exemplo de datas no banco:");
    console.log(`- data_abertura: ${osExemplo[0].data_abertura}`);
    console.log(`- data_fechamento: ${osExemplo[0].data_fechamento}`);
  }

  // 4. Testar filtro específico de categoria
  const { count: pesadaCount } = await supabase
    .from('equipamentos')
    .select('*', { count: 'exact', head: true })
    .eq('categoria', 'PESADA');
  console.log(`Equipamentos na categoria 'PESADA': ${pesadaCount}`);
}

test();
