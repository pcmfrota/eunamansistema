import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const sql = `
CREATE TABLE IF NOT EXISTS public.lavagens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa TEXT NOT NULL,
    data DATE NOT NULL,
    colaborador TEXT,
    horimetro NUMERIC,
    km NUMERIC,
    status TEXT DEFAULT 'Pendente',
    lavagem_realizada BOOLEAN DEFAULT true,
    observacoes TEXT,
    imagem_1_url TEXT,
    imagem_2_url TEXT,
    imagem_3_url TEXT,
    imagem_horimetro_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    validated_at TIMESTAMPTZ,
    UNIQUE(placa, data)
);

ALTER TABLE public.lavagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.lavagens;
CREATE POLICY "Allow all for authenticated users" ON public.lavagens
    FOR ALL USING (true);
`

async function setup() {
  console.log('Executando SQL para criar tabela lavagens...')
  
  // Note: execute raw sql is not directly available in supabase-js v2 without a function
  // We will try to create a rpc if it doesn't exist, but usually we just use the API to check if table exists
  // For now, I'll use the management tool again or just assume the user will run it if I fail here.
  // Actually, I can use the SQL tool from the server one more time, maybe it was just a fluke.
  
  // Or I can use a simpler approach: insert a dummy record to check if table exists
  const { error } = await supabase.from('lavagens').select('id').limit(1)
  if (error && error.code === 'PGRST116') {
    console.log('Tabela não existe ou está vazia.')
  } else if (error) {
    console.log('Erro ao acessar tabela:', error.message)
  } else {
    console.log('Tabela lavagens já existe.')
  }
}

setup()
