-- Create aux_afiacao table for dynamic configurations of afiacao
CREATE TABLE IF NOT EXISTS public.aux_afiacao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  category text NOT NULL, -- 'afiador', 'maquina', 'material', 'estado_recebimento', 'tipo_descarte'
  modulo text, -- 'MA02', 'MA04', 'MA05', 'MA06', 'MA07' (somente para 'maquina')
  value text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb, -- campos extras {codigo, ni, custo, tipo}
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_category_modulo_value UNIQUE (category, modulo, value)
);

-- Enable RLS
ALTER TABLE public.aux_afiacao ENABLE ROW LEVEL SECURITY;

-- Setup Policies
CREATE POLICY "Enable read access for all users" ON public.aux_afiacao FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.aux_afiacao FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.aux_afiacao FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.aux_afiacao FOR DELETE USING (true);

-- Seed Initial Data for Afiadores
INSERT INTO public.aux_afiacao (category, modulo, value) VALUES
('afiador', NULL, 'KHAYNAN FERNANDES FERREIRA'),
('afiador', NULL, 'FELYPE DANIEL MACEDO VIEIRA'),
('afiador', NULL, 'JOSIEL DA SILVA RIBEIRO'),
('afiador', NULL, 'GEOVANE DE ARAUJO MORAES'),
('afiador', NULL, 'LUCAS PEREIRA ALVES')
ON CONFLICT (category, modulo, value) DO NOTHING;

-- Seed Initial Data for Maquinas
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

-- Seed Initial Data for Materiais
INSERT INTO public.aux_afiacao (category, value, metadata) VALUES
('material', 'COROA 14 DENTES OREGON/ORC14404', '{"codigo": "1", "ni": "25045281", "custo": 115.52, "tipo": "Coroa"}'),
('material', 'CORRENTE OREGON/18HX V132', '{"codigo": "12", "ni": "25301352", "custo": 1612.35, "tipo": "Corrente"}'),
('material', 'CORRENTE OREGON/18HX 370E', '{"codigo": "13", "ni": "25301352", "custo": 1612.35, "tipo": "Corrente"}'),
('material', 'EMENDA UNIAO OREGON/512935 MACHO', '{"codigo": "2", "ni": "25301353", "custo": 1.75, "tipo": "Macho"}'),
('material', 'EMENDA UNIAO OREGON/518853 FEMEA', '{"codigo": "3", "ni": "25301351", "custo": 1.21, "tipo": "Fêmea"}'),
('material', 'ESTRELA P/BARRA HARVESTER OREGON/101918 (ROLTOP)', '{"codigo": "15", "ni": "25045282", "custo": 70.79, "tipo": "Estrela"}'),
('material', 'SABRE JET FIT OREGON/752HSFB194 (370E)', '{"codigo": "16", "ni": "25301354", "custo": 298.69, "tipo": "Sabre"}'),
('material', 'SABRE KOMATSU/5256506 (370E)', '{"codigo": "17", "ni": "27036813", "custo": 371.06, "tipo": "SABRE"}'),
('material', 'SABRE KOMATSU/5208092 (V132)', '{"codigo": "18", "ni": "27057056", "custo": 361.31, "tipo": "SABRE"}'),
('material', 'CHAPA MAQNOVA/P0239', '{"codigo": "20", "ni": "27104167", "custo": 100.00, "tipo": "CHAPA"}'),
('material', 'SABRE MAQNOVA/P0199', '{"codigo": "21", "ni": "27076237", "custo": 10.50, "tipo": "SABRE"}'),
('material', 'REBITE', '{"codigo": "22", "ni": "27190176", "custo": 11.00, "tipo": ""}'),
('material', 'BOLSAS', '{"codigo": "10", "ni": "27095494", "custo": 12.00, "tipo": ""}'),
('material', 'CORRENTE 370E (MAQNOVA)', '{"codigo": "14", "ni": "25301352", "custo": 1612.35, "tipo": "Corrente"}'),
('material', 'SABRE ROTARY-AX', '{"codigo": "23", "ni": "27276133", "custo": 100.00, "tipo": "SABRE"}'),
('material', 'CHAPA ROTARY-AX (PONTEIRA)', '{"codigo": "40", "ni": "27274881", "custo": 101.00, "tipo": "SABRE"}')
ON CONFLICT (category, modulo, value) DO NOTHING;

-- Seed Initial Data for Estados de Recebimento
INSERT INTO public.aux_afiacao (category, value, metadata) VALUES
('estado_recebimento', 'QUEIMADA (O)', '{"codigo": "A"}'),
('estado_recebimento', 'TORCIDA (O)', '{"codigo": "B"}'),
('estado_recebimento', 'CONTAMINADA (O) COM AREIA', '{"codigo": "C"}'),
('estado_recebimento', 'SEM LUBRIFICAÇÃO', '{"codigo": "D"}'),
('estado_recebimento', 'NORMAL', '{"codigo": "E"}'),
('estado_recebimento', 'FALTANDO PEDAÇO', '{"codigo": "F"}'),
('estado_recebimento', 'ELOS DE TRAÇÃO DANIFICADOS', '{"codigo": "G"}'),
('estado_recebimento', 'QUEBRADA', '{"codigo": "H"}'),
('estado_recebimento', 'FACAS AMASSADAS', '{"codigo": "I"}'),
('estado_recebimento', 'PEÇA NÃO ENTREGUE', '{"codigo": "J"}'),
('estado_recebimento', 'PEÇA NÃO UTILIZADA', '{"codigo": "K"}'),
('estado_recebimento', 'MATERIAL DO KIT INCORRETO', '{"codigo": "L"}'),
('estado_recebimento', 'EMPENADO', '{"codigo": "M"}'),
('estado_recebimento', 'PONTEIRA FECHADA', '{"codigo": "N"}'),
('estado_recebimento', 'CANALETA DANIFICADA', '{"codigo": "O"}'),
('estado_recebimento', 'CANALETA FECHADA', '{"codigo": "P"}'),
('estado_recebimento', 'ROOLTOP DANIFICADO', '{"codigo": "Q"}')
ON CONFLICT (category, modulo, value) DO NOTHING;

-- Seed Initial Data for Tipos de Descarte
INSERT INTO public.aux_afiacao (category, value, metadata) VALUES
('tipo_descarte', 'MAL USO', '{"codigo": "A"}'),
('tipo_descarte', 'PERDA', '{"codigo": "B"}'),
('tipo_descarte', 'QUEBRA', '{"codigo": "C"}'),
('tipo_descarte', 'LUBRIFICAÇÃO', '{"codigo": "D"}'),
('tipo_descarte', 'VIDA ÚTIL', '{"codigo": "E"}'),
('tipo_descarte', 'ACIDENTE', '{"codigo": "F"}'),
('tipo_descarte', 'TORÇÃO', '{"codigo": "G"}'),
('tipo_descarte', 'PONTEIRA QUEIMADA', '{"codigo": "H"}'),
('tipo_descarte', 'PONTEIRA FECHADA', '{"codigo": "I"}'),
('tipo_descarte', 'PONTEIRA QUEBRADA', '{"codigo": "J"}')
ON CONFLICT (category, modulo, value) DO NOTHING;
