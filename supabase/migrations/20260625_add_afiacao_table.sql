-- Create afiacao table
CREATE TABLE IF NOT EXISTS public.afiacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data DATE NOT NULL,
  afiador TEXT NOT NULL,
  modulo TEXT NOT NULL,
  maquina TEXT,
  letra TEXT,
  kit TEXT,
  tipo_formulario TEXT NOT NULL,
  detalhes JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.afiacao ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Enable read access for all users" ON public.afiacao;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.afiacao;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.afiacao;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.afiacao;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.afiacao FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.afiacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.afiacao FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.afiacao FOR DELETE USING (true);
