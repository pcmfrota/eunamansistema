-- Crie e popule a tabela aux_afiacao no Editor SQL do seu Supabase:

CREATE TABLE IF NOT EXISTS public.aux_afiacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'afiador' ou 'maquina'
  modulo text, -- 'MA02', 'MA04', 'MA05', 'MA06', 'MA07' (somente para 'maquina')
  value text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_category_modulo_value UNIQUE (category, modulo, value)
);

-- Habilitar RLS
ALTER TABLE public.aux_afiacao ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso público
DROP POLICY IF EXISTS "Enable read access for all users" ON public.aux_afiacao;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.aux_afiacao;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.aux_afiacao;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.aux_afiacao;

CREATE POLICY "Enable read access for all users" ON public.aux_afiacao FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.aux_afiacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.aux_afiacao FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.aux_afiacao FOR DELETE USING (true);

-- Inserir Afiadores padrão
INSERT INTO public.aux_afiacao (category, modulo, value) VALUES
('afiador', NULL, 'KHAYNAN FERNANDES FERREIRA'),
('afiador', NULL, 'FELYPE DANIEL MACEDO VIEIRA'),
('afiador', NULL, 'JOSIEL DA SILVA RIBEIRO'),
('afiador', NULL, 'GEOVANE DE ARAUJO MORAES'),
('afiador', NULL, 'LUCAS PEREIRA ALVES')
ON CONFLICT (category, modulo, value) DO NOTHING;

-- Inserir Máquinas padrão
INSERT INTO public.aux_afiacao (category, modulo, value) VALUES
('maquina', 'MA02', 'HVE-0546'),
('maquina', 'MA02', 'HVE-0660'),
('maquina', 'MA02', 'HVE-0426'),
('maquina', 'MA02', 'HVE-0653'),
('maquina', 'MA02', 'HVE-0481'),
('maquina', 'MA02', 'HVE-0480'),
('maquina', 'MA02', 'HVE-0483'),
('maquina', 'MA02', 'HVE-0431'),

('maquina', 'MA04', 'HVE-0552'),
('maquina', 'MA04', 'HVE-0553'),
('maquina', 'MA04', 'HVE-0554'),
('maquina', 'MA04', 'HVE-0555'),
('maquina', 'MA04', 'HVE-0556'),
('maquina', 'MA04', 'HVE-0557'),

('maquina', 'MA05', 'HVE-0655'),
('maquina', 'MA05', 'HVE-0434'),
('maquina', 'MA05', 'HVE-0656'),
('maquina', 'MA05', 'HVE-0482'),
('maquina', 'MA05', 'HVE-0432'),
('maquina', 'MA05', 'HVE-0548'),
('maquina', 'MA05', 'HVE-0547'),
('maquina', 'MA05', 'HVE-0435'),
('maquina', 'MA05', 'HVE-0690'),
('maquina', 'MA05', 'HVE-0654'),
('maquina', 'MA05', 'HVE-0658'),
('maquina', 'MA05', 'HVE-0659'),
('maquina', 'MA05', 'HVE-0427'),
('maquina', 'MA05', 'HVE-0430'),

('maquina', 'MA06', 'HVE-0560'),
('maquina', 'MA06', 'HVE-0561'),
('maquina', 'MA06', 'HVE-0562'),
('maquina', 'MA06', 'HVE-0563'),
('maquina', 'MA06', 'HVE-0564'),
('maquina', 'MA06', 'HVE-0565'),

('maquina', 'MA07', 'HVE-0550'),
('maquina', 'MA07', 'HVE-0634'),
('maquina', 'MA07', 'HVE-0661'),
('maquina', 'MA07', 'HVE-0429'),
('maquina', 'MA07', 'HVE-0635'),
('maquina', 'MA07', 'HVE-0636'),
('maquina', 'MA07', 'HVE-0551'),
('maquina', 'MA07', 'HVE-0484'),
('maquina', 'MA07', 'HVE-0657'),
('maquina', 'MA07', 'HVE-0689'),
('maquina', 'MA07', 'HVE-0549'),
('maquina', 'MA07', 'HVE-0633'),
('maquina', 'MA07', 'HVE-0433'),
('maquina', 'MA07', 'HVE-0398')
ON CONFLICT (category, modulo, value) DO NOTHING;
