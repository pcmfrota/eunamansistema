
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Erro: NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não definidos.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("--- Diagnóstico EUNAMAN ---");
  
  // 1. Teste de Equipamentos
  const { data: eqs, error: errEq } = await supabase.from('equipamentos').select('count', { count: 'exact' });
  console.log("Equipamentos cadastrados:", eqs ? eqs : "0", errEq ? errEq.message : "OK");

  // 2. Teste de OS (Sem filtros)
  const { data: os, error: errOs } = await supabase.from('ordens_servico').select('*').limit(5);
  console.log("Amostra de OS (Total):", os?.length || 0, errOs ? errOs.message : "OK");
  
  if (os && os.length > 0) {
    console.log("Exemplo de OS:", JSON.stringify(os[0], null, 2));
  } else {
    console.warn("AVISO: Tabela ordens_servico está VAZIA no banco!");
  }

  // 3. Teste de Calendário
  const { data: cal } = await supabase.from('calendario_suzano').select('*').limit(3);
  console.log("Calendário Suzano:", cal?.length || 0);
}

diagnose();
