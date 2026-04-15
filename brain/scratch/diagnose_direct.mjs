
// Script de diagnóstico simplificado usando a lib do projeto
import { supabase } from '../../lib/supabase.js';

async function diagnose() {
  console.log("--- Executando Diagnóstico Automático ---");
  
  try {
    // 1. Verificar Equipamentos
    const { count, error: errEq } = await supabase
      .from('equipamentos')
      .select('*', { count: 'exact', head: true });
    
    console.log(`Equipamentos na base: ${count || 0}`);
    if (errEq) console.error("Erro Equipamentos:", errEq.message);

    // 2. Verificar OS
    const { data: os, error: errOs } = await supabase
      .from('ordens_servico')
      .select('*')
      .limit(10);
    
    if (errOs) {
      console.error("Erro OS:", errOs.message);
    } else {
      console.log(`Ordens de Serviço encontradas: ${os.length}`);
      if (os.length > 0) {
        console.log("Datas da primeira OS:");
        console.log(`- Abertura: ${os[0].data_abertura}`);
        console.log(`- Fechamento: ${os[0].data_fechamento}`);
        console.log(`- Status: ${os[0].status}`);
      }
    }

    // 3. Verificar Calendário
    const { data: cal } = await supabase.from('calendario_suzano').select('*').limit(1);
    console.log(`Calendário configurado: ${cal && cal.length > 0 ? 'SIM' : 'NÃO'}`);

  } catch (e) {
    console.error("Erro fatal no diagnóstico:", e.message);
  }
}

diagnose();
