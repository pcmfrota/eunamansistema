-- Create afiacao table
CREATE TABLE IF NOT EXISTS public.afiacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data text NOT NULL,
  afiador text NOT NULL,
  modulo text NOT NULL,
  maquina text,
  letra text NOT NULL,
  kit text NOT NULL,
  tipo_formulario text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.afiacao ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming similar to other tables, allowing insert/select to authenticated or all for now based on typical setup. Need to verify what standard is used.)
-- Creating a simple standard policy for now.
CREATE POLICY "Enable read access for all users" ON public.afiacao FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.afiacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.afiacao FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.afiacao FOR DELETE USING (true);
