-- Cadastro de Máquinas Suzano (frotas HV/FW/Carregamento vinculadas a cada módulo) e
-- correção do catálogo de módulos: os prints enviados mostram que os módulos de verdade
-- são só "MA02", "MA05", "MA07" (cada um podendo ter máquinas de ambas as frentes HV e FW
-- misturadas) — não 5 módulos separados "02-HV / 05-HV / 05-FW / 07-HV / 07-FW" como o
-- texto original do spec sugeria. Substitui os 5 módulos especulativos pelos 3 reais.

-- 1) Tabela de máquinas
CREATE TABLE IF NOT EXISTS public.insumos_maquinas_suzano (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  modulo_id uuid REFERENCES public.insumos_modulos(id),
  frente text CHECK (frente IN ('HV', 'FW')),
  tipo text,
  origem text NOT NULL DEFAULT 'CADASTRO' CHECK (origem IN ('CADASTRO', 'MOTORISTA')),
  foto_url text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  criado_por_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.insumos_maquinas_suzano ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_maquinas_suzano' AND policyname = 'insumos_maquinas_suzano_all') THEN
    CREATE POLICY "insumos_maquinas_suzano_all" ON public.insumos_maquinas_suzano FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_insumos_maquinas_modulo ON public.insumos_maquinas_suzano(modulo_id);

-- Bucket pra foto obrigatória quando o motorista cadastra uma máquina nova em campo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('insumos-fotos-maquinas', 'insumos-fotos-maquinas', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'insumos_fotos_maquinas_read') THEN
    CREATE POLICY "insumos_fotos_maquinas_read" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'insumos-fotos-maquinas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'insumos_fotos_maquinas_write') THEN
    CREATE POLICY "insumos_fotos_maquinas_write" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'insumos-fotos-maquinas');
  END IF;
END $$;

-- 2) Corrige o catálogo de módulos: insere os 3 reais (MA02/MA05/MA07), reaponta qualquer
-- ficha já criada que referenciasse um dos 5 módulos especulativos, e remove os antigos.
INSERT INTO public.insumos_modulos (codigo, nome, centro, deposito, controle) VALUES
  ('MA02', 'Módulo 02', NULL, NULL, NULL),
  ('MA05', 'Módulo 05', NULL, NULL, NULL),
  ('MA07', 'Módulo 07', NULL, NULL, NULL)
ON CONFLICT (codigo) DO NOTHING;

DO $$
DECLARE
  id_ma02 uuid; id_ma05 uuid; id_ma07 uuid;
  id_old record;
BEGIN
  SELECT id INTO id_ma02 FROM public.insumos_modulos WHERE codigo = 'MA02';
  SELECT id INTO id_ma05 FROM public.insumos_modulos WHERE codigo = 'MA05';
  SELECT id INTO id_ma07 FROM public.insumos_modulos WHERE codigo = 'MA07';

  FOR id_old IN SELECT id, codigo FROM public.insumos_modulos WHERE codigo IN ('MOD02_HV', 'MOD05_HV', 'MOD05_FW', 'MOD07_HV', 'MOD07_FW') LOOP
    UPDATE public.insumos_fichas_abastecimento SET modulo_id = CASE
      WHEN id_old.codigo = 'MOD02_HV' THEN id_ma02
      WHEN id_old.codigo IN ('MOD05_HV', 'MOD05_FW') THEN id_ma05
      WHEN id_old.codigo IN ('MOD07_HV', 'MOD07_FW') THEN id_ma07
    END WHERE modulo_id = id_old.id;
    UPDATE public.insumos_fichas_recarga SET modulo_id = CASE
      WHEN id_old.codigo = 'MOD02_HV' THEN id_ma02
      WHEN id_old.codigo IN ('MOD05_HV', 'MOD05_FW') THEN id_ma05
      WHEN id_old.codigo IN ('MOD07_HV', 'MOD07_FW') THEN id_ma07
    END WHERE modulo_id = id_old.id;
    DELETE FROM public.insumos_modulo_material WHERE modulo_id = id_old.id;
    DELETE FROM public.insumos_modulos WHERE id = id_old.id;
  END LOOP;
END $$;

-- 3) Depósitos confirmados que faltavam
UPDATE public.equipamentos SET deposito_suzano = 'CB90' WHERE placa = 'ROG1I26';
UPDATE public.equipamentos SET deposito_suzano = 'CB91' WHERE placa = 'ROG1I38';

-- 4) Seed das máquinas por módulo (prefixo HVE = frente HV, FWX = frente FW)
DO $$
DECLARE id_ma02 uuid; id_ma05 uuid; id_ma07 uuid;
BEGIN
  SELECT id INTO id_ma02 FROM public.insumos_modulos WHERE codigo = 'MA02';
  SELECT id INTO id_ma05 FROM public.insumos_modulos WHERE codigo = 'MA05';
  SELECT id INTO id_ma07 FROM public.insumos_modulos WHERE codigo = 'MA07';

  INSERT INTO public.insumos_maquinas_suzano (codigo, modulo_id, frente, tipo) VALUES
    ('HVE-0396', id_ma02, 'HV', 'HV'), ('HVE-0426', id_ma02, 'HV', 'HV'), ('HVE-0431', id_ma02, 'HV', 'HV'),
    ('HVE-0480', id_ma02, 'HV', 'HV'), ('HVE-0481', id_ma02, 'HV', 'HV'), ('HVE-0483', id_ma02, 'HV', 'HV'),
    ('HVE-0546', id_ma02, 'HV', 'HV'), ('HVE-0653', id_ma02, 'HV', 'HV'), ('HVE-0660', id_ma02, 'HV', 'HV'),

    ('FWX-0129', id_ma05, 'FW', 'FW'), ('FWX-0206', id_ma05, 'FW', 'FW'), ('FWX-0209', id_ma05, 'FW', 'FW'),
    ('FWX-0254', id_ma05, 'FW', 'FW'), ('FWX-0277', id_ma05, 'FW', 'FW'), ('FWX-0278', id_ma05, 'FW', 'FW'),
    ('FWX-0279', id_ma05, 'FW', 'FW'), ('FWX-0281', id_ma05, 'FW', 'FW'), ('FWX-0282', id_ma05, 'FW', 'FW'),
    ('FWX-0283', id_ma05, 'FW', 'FW'),
    ('HVE-0397', id_ma05, 'HV', 'HV'), ('HVE-0427', id_ma05, 'HV', 'HV'), ('HVE-0432', id_ma05, 'HV', 'HV'),
    ('HVE-0434', id_ma05, 'HV', 'HV'), ('HVE-0435', id_ma05, 'HV', 'HV'), ('HVE-0482', id_ma05, 'HV', 'HV'),
    ('HVE-0547', id_ma05, 'HV', 'HV'), ('HVE-0548', id_ma05, 'HV', 'HV'), ('HVE-0569', id_ma05, 'HV', 'HV'),
    ('HVE-0654', id_ma05, 'HV', 'HV'), ('HVE-0655', id_ma05, 'HV', 'HV'), ('HVE-0656', id_ma05, 'HV', 'HV'),
    ('HVE-0658', id_ma05, 'HV', 'HV'), ('HVE-0659', id_ma05, 'HV', 'HV'), ('HVE-0690', id_ma05, 'HV', 'HV'),

    ('FWX-0155', id_ma07, 'FW', 'FW'), ('FWX-0157', id_ma07, 'FW', 'FW'), ('FWX-0207', id_ma07, 'FW', 'FW'),
    ('FWX-0208', id_ma07, 'FW', 'FW'), ('FWX-0259', id_ma07, 'FW', 'FW'), ('FWX-0260', id_ma07, 'FW', 'FW'),
    ('FWX-0280', id_ma07, 'FW', 'FW'),
    ('HVE-0398', id_ma07, 'HV', 'HV'), ('HVE-0429', id_ma07, 'HV', 'HV'), ('HVE-0484', id_ma07, 'HV', 'HV'),
    ('HVE-0549', id_ma07, 'HV', 'HV'), ('HVE-0550', id_ma07, 'HV', 'HV'), ('HVE-0551', id_ma07, 'HV', 'HV'),
    ('HVE-0557', id_ma07, 'HV', 'HV'), ('HVE-0633', id_ma07, 'HV', 'HV'), ('HVE-0634', id_ma07, 'HV', 'HV'),
    ('HVE-0635', id_ma07, 'HV', 'HV'), ('HVE-0636', id_ma07, 'HV', 'HV'), ('HVE-0657', id_ma07, 'HV', 'HV'),
    ('HVE-0661', id_ma07, 'HV', 'HV'), ('HVE-0689', id_ma07, 'HV', 'HV'),

    -- Sem módulo confirmado no print (lista "Equipamento" avulsa) — ajustar depois no cadastro se tiver um módulo fixo.
    ('GRU-0048', NULL, NULL, 'GRU'), ('GRU-0049', NULL, NULL, 'GRU'), ('GRU-0050', NULL, NULL, 'GRU'),
    ('GRU-0051', NULL, NULL, 'GRU'), ('GRU-0052', NULL, NULL, 'GRU'), ('GRU-0053', NULL, NULL, 'GRU'),
    ('GRU-0054', NULL, NULL, 'GRU'), ('GRU-0055', NULL, NULL, 'GRU'), ('GRU-0056', NULL, NULL, 'GRU'),
    ('GRU-0058', NULL, NULL, 'GRU'), ('GRU-9022', NULL, NULL, 'GRU')
  ON CONFLICT (codigo) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
