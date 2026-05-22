const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/)?.[1]?.trim();
const supabaseAnonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const placa = "SGJ7I82";
  
  // Find equipment ID
  const { data: eq } = await supabase.from('equipamentos').select('id, placa').ilike('placa', placa).single();
  console.log('Equipamento:', eq);

  const inicio = "2026-04-22T00:00:00";
  const fim = "2026-05-21T23:59:59";

  // Method 1: Chained .or()
  const { data: dataChained, error: errChained } = await supabase
    .from('ordens_servico')
    .select('id, numero_os, data_abertura, data_fechamento, horario_parada')
    .eq('equipamento_id', eq.id)
    .or(`data_abertura.lte.${fim},horario_parada.lte.${fim}`)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`);

  console.log('Chained count:', dataChained ? dataChained.length : 0, 'Error:', errChained);

  // Method 2: Fetch all for equipment and filter in memory
  const { data: dataAll, error: errAll } = await supabase
    .from('ordens_servico')
    .select('id, numero_os, data_abertura, data_fechamento, horario_parada')
    .eq('equipamento_id', eq.id);

  console.log('All count:', dataAll ? dataAll.length : 0, 'Error:', errAll);

  if (dataAll) {
    function parseLocal(dateStr) {
      if (!dateStr) return 0;
      const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
      if (match) {
        return new Date(
          parseInt(match[1]),
          parseInt(match[2]) - 1,
          parseInt(match[3]),
          parseInt(match[4]),
          parseInt(match[5])
        ).getTime();
      }
      return new Date(dateStr).getTime();
    }
    const tInicio = parseLocal(inicio);
    const tFim = parseLocal(fim);

    const memFiltered = dataAll.filter(os => {
      const ab = parseLocal(os.horario_parada || os.data_abertura);
      const fc = os.data_fechamento ? parseLocal(os.data_fechamento) : null;
      return ab <= tFim && (!fc || fc >= tInicio);
    });
    console.log('Memory filtered count:', memFiltered.length);
    console.log('Memory filtered OSs:', memFiltered.map(o => o.numero_os));
    console.log('Chained OSs:', dataChained ? dataChained.map(o => o.numero_os) : []);

    const missing = memFiltered.filter(m => !dataChained.some(c => c.id === m.id));
    console.log('Missing OSs in chained:', missing.map(o => ({
      numero_os: o.numero_os,
      data_abertura: o.data_abertura,
      data_fechamento: o.data_fechamento,
      horario_parada: o.horario_parada
    })));
  }
}

test();
