import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ffvwappomyuhyyeylpgt.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente do Supabase não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkColumns() {
  console.log("Checking columns of ordens_servico table...");
  
  // We can query information_schema.columns via an RPC or raw SQL. Since we have service role key, we might not have a raw sql execute method on the client. 
  // Let's query information_schema by doing a fetch or running a postgres command if we have an RPC, or just getting a single row to inspect keys.
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error fetching ordens_servico:", error.message);
  } else if (data && data.length > 0) {
    console.log("Columns present in ordens_servico row:", Object.keys(data[0]));
  } else {
    console.log("No rows in ordens_servico or empty result. Let's insert a dummy transaction or find another way.");
    // Let's query profiles too
    const { data: profs } = await supabase.from('profiles').select('*').limit(1);
    if (profs && profs.length > 0) {
      console.log("Columns present in profiles row:", Object.keys(profs[0]));
    }
  }
}

checkColumns();
