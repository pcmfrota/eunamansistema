-- ── 1. Criar Tabelas ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.docs_tacografo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  data_vencimento date NOT NULL,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.docs_civ_cipp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  data_vencimento date, -- Permite nulo pois alguns registros não possuem data no anexo (-)
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.docs_laudo_eletromecanico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  periodo text NOT NULL,
  data_expedicao date NOT NULL,
  data_vencimento date NOT NULL,
  observacoes text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.docs_laudo_implemento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  periodo text NOT NULL,
  data_expedicao date NOT NULL,
  data_vencimento date NOT NULL,
  observacoes text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 2. Habilitar RLS (Row Level Security) ─────────────────────────────────────

ALTER TABLE public.docs_tacografo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_civ_cipp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_laudo_eletromecanico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_laudo_implemento ENABLE ROW LEVEL SECURITY;

-- ── 3. Criar Políticas de Isolamento por Filial ───────────────────────────────

DROP POLICY IF EXISTS "filial_isolation_docs_tacografo" ON public.docs_tacografo;
CREATE POLICY "filial_isolation_docs_tacografo" ON public.docs_tacografo
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

DROP POLICY IF EXISTS "filial_isolation_docs_civ_cipp" ON public.docs_civ_cipp;
CREATE POLICY "filial_isolation_docs_civ_cipp" ON public.docs_civ_cipp
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

DROP POLICY IF EXISTS "filial_isolation_docs_laudo_eletromecanico" ON public.docs_laudo_eletromecanico;
CREATE POLICY "filial_isolation_docs_laudo_eletromecanico" ON public.docs_laudo_eletromecanico
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

DROP POLICY IF EXISTS "filial_isolation_docs_laudo_implemento" ON public.docs_laudo_implemento;
CREATE POLICY "filial_isolation_docs_laudo_implemento" ON public.docs_laudo_implemento
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- ── 4. Criar Índices de Performance ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_docs_tacografo_filial ON public.docs_tacografo(filial_id);
CREATE INDEX IF NOT EXISTS idx_docs_civ_cipp_filial ON public.docs_civ_cipp(filial_id);
CREATE INDEX IF NOT EXISTS idx_docs_laudo_eletro_filial ON public.docs_laudo_eletromecanico(filial_id);
CREATE INDEX IF NOT EXISTS idx_docs_laudo_impl_filial ON public.docs_laudo_implemento(filial_id);

-- ── 5. Atualizar role_permissions ─────────────────────────────────────────────

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/admin/usuarios']
WHERE role = 'admin';

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos']
WHERE role IN ('pcm', 'gestao');

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos']
WHERE role = 'mecanico';

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/preventivas', '/backlog', '/calendario', '/documentos']
WHERE role = 'visitante';

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos']
WHERE role = 'motorista';

-- ── 6. Inserir Dados Iniciais (Sementes) ──────────────────────────────────────

-- 6.1 CIV / CIPP
INSERT INTO public.docs_civ_cipp (local, co, placa, data_vencimento, filial_id) VALUES
('CARREGAMENTO', 'COMBOIO', 'LMT 7E29', '2027-04-14', 'MATRIZ'),
('MÓDULO 7 FW', 'COMBOIO', 'ROE 8F63', '2026-08-08', 'MATRIZ'),
('MÓDULO 2', 'COMBOIO', 'ROE 8F66', '2026-09-10', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J90', '2026-10-29', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J82', '2026-11-06', 'MATRIZ'),
('MÓDULO 5 FW', 'COMBOIO', 'ROG 1I26', '2026-11-13', 'MATRIZ'),
('RESERVA', 'MULTI.', 'PTV 4G53', '2026-12-08', 'MATRIZ'),
('MÓDULO 2', 'MUNCK', 'SGJ1G11', '2026-12-15', 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'ROG 1I38', '2026-12-16', 'MATRIZ'),
('MÓDULO 7 HV', 'COMBOIO', 'ROG 1I40', '2026-12-19', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J72', '2026-12-23', 'MATRIZ'),
('CARREGAMENTO', 'MULTI.', 'PTV 3A59', '2026-12-23', 'MATRIZ'),
('MÓDULO 5 FW', 'COMBOIO', 'ROG 1I41', '2027-01-06', 'MATRIZ'),
('MÓDULO 07', 'MUNCK', 'SGJ7I82', '2027-01-09', 'MATRIZ'),
('MALHA VIARIA', 'MUNCK', 'SFR4F28', '2027-01-19', 'MATRIZ'),
('MÓDULO 05', 'MUNCK', 'SFR4F37', '2027-01-20', 'MATRIZ'),
('CARREGAMENTO', 'MULTI', 'PTV 4G49', '2025-12-04', 'MATRIZ'),
('RESERVA', 'PIPA', 'PTF 4236', NULL, 'MATRIZ'),
('MODULO 02', 'PIPA', 'TCA4B23', NULL, 'MATRIZ'),
('MODULO 07 FW', 'PIPA', 'TCA4B26', NULL, 'MATRIZ'),
('MODULO 05 FW', 'PIPA', 'TCC2E83', NULL, 'MATRIZ'),
('MODULO 05 HV', 'PIPA', 'TCC6G17', NULL, 'MATRIZ'),
('MÓDULO 7 HV', 'PIPA', 'LUC 7J90', NULL, 'MATRIZ');

-- 6.2 Tacógrafo
INSERT INTO public.docs_tacografo (local, co, placa, data_vencimento, filial_id) VALUES
('RESERVA', 'PIPA', 'PTF 4236', '2026-04-12', 'MATRIZ'),
('MÓDULO 05', 'MUNCK', 'TZB1G41', '2026-06-19', 'MATRIZ'),
('MÓDULO 02', 'MUNCK', 'TZD6D14', '2026-06-20', 'MATRIZ'),
('MÓDULO 07', 'MUNCK', 'TZB1G12', '2026-06-18', 'MATRIZ'),
('MÓDULO 02', 'PIPA', 'TCA4B23', '2026-08-06', 'MATRIZ'),
('MODULO 07 FW', 'PIPA', 'TCA4B26', '2026-08-06', 'MATRIZ'),
('MODULO 05 FW', 'PIPA', 'TCC2E83', '2026-08-06', 'MATRIZ'),
('MODULO 05 HV', 'PIPA', 'TCC6G17', '2026-08-06', 'MATRIZ'),
('RESERVA', 'MULTI.', 'PTV 4G53', '2026-09-27', 'MATRIZ'),
('CARREGAMENTO', 'MULTI.', 'PTV 3A59', '2026-09-27', 'MATRIZ'),
('CARREGAMENTO', 'MULTI.', 'PTV 4G49', '2027-05-25', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J72', '2026-10-02', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J82', '2026-10-02', 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J90', '2026-10-02', 'MATRIZ'),
('SILVICULTURA', 'MUNCK', 'PTT 8D76', '2027-01-02', 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'LMT 7E29', '2027-04-25', 'MATRIZ'),
('MÓDULO 7 HV', 'PIPA', 'LUC 7J90', '2027-07-17', 'MATRIZ'),
('MÓDULO 7 FW', 'COMBOIO', 'ROE 8F63', '2027-10-30', 'MATRIZ'),
('MÓDULO 2', 'COMBOIO', 'ROE 8F66', '2027-10-31', 'MATRIZ'),
('MÓDULO 5 FW', 'COMBOIO', 'ROG 1I26', '2027-12-12', 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'ROG 1I38', '2027-12-17', 'MATRIZ'),
('MÓDULO 7 HV', 'COMBOIO', 'ROG 1I40', '2027-12-18', 'MATRIZ'),
('MÓDULO 5 FW', 'COMBOIO', 'ROG 1I41', '2028-01-05', 'MATRIZ');

-- 6.3 Laudo Eletromecânico Implemento
INSERT INTO public.docs_laudo_implemento (local, co, placa, periodo, data_expedicao, data_vencimento, observacoes, filial_id) VALUES
('CARREGAMENTO', 'PIPA', 'PTV 4G49', '1 ANO', '2026-05-21', '2027-05-14', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'COMBOIO', 'ROG 1I40', '1 ANO', '2024-08-09', '2026-06-26', NULL, 'MATRIZ'),
('MÓDULO 02', 'COMBOIO', 'ROE 8F66', '1 ANO', '2025-07-24', '2026-07-24', NULL, 'MATRIZ'),
('MÓDULO 5 FW', 'COMBOIO', 'ROG 1I41', '1 ANO', '2025-07-24', '2026-07-24', NULL, 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J82', '1 ANO', '2025-08-07', '2026-07-31', NULL, 'MATRIZ'),
('RESERVA', 'PIPA', 'PTF 4236', '1 ANO', '2025-10-01', '2026-09-04', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'PIPA', 'LUC 7J90', '1 ANO', '2025-12-29', '2026-09-25', NULL, 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J90', '1 ANO', '2025-10-09', '2026-10-09', NULL, 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'LMT 7E29', '1 ANO', '2025-10-22', '2026-10-22', NULL, 'MATRIZ'),
('MÓDULO 07 FW', 'COMBOIO', 'ROE 8F63', '1 ANO', '2025-10-28', '2026-10-23', NULL, 'MATRIZ'),
('MÓDULO 05 FW', 'COMBOIO', 'ROG 1I26', '1 ANO', '2025-12-12', '2026-12-07', NULL, 'MATRIZ'),
('MÓDULO 02 HV', 'MUNCK', 'SGJ1G11', '1 ANO', '2025-12-18', '2026-12-11', NULL, 'MATRIZ'),
('MÓDULO 02', 'PIPA', 'TCA4B23', '1 ANO', '2025-12-18', '2026-12-11', NULL, 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'ROG 1I38', '1 ANO', '2025-09-11', '2026-12-24', NULL, 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J72', '1 ANO', '2025-10-10', '2026-12-24', NULL, 'MATRIZ'),
('RESERVA', 'MULT', 'PTV 4G53', '1 ANO', '2026-01-08', '2027-01-01', NULL, 'MATRIZ'),
('MÓDULO 5 HV', 'PIPA', 'TCC6G17', '1 ANO', '2026-01-15', '2027-01-08', NULL, 'MATRIZ'),
('MÓDULO 05 FW', 'PIPA', 'TCC2E83', '1 ANO', '2026-01-19', '2027-01-14', NULL, 'MATRIZ'),
('MÓDULO 07 FW', 'PIPA', 'TCA4B26', '1 ANO', '2026-02-12', '2027-02-05', NULL, 'MATRIZ'),
('CARREGAMENTO', 'MULT', 'PTV 3A59', '1 ANO', '2026-02-11', '2027-02-05', NULL, 'MATRIZ'),
('MÓDULO 05 HV', 'MUNCK', 'TZB1G41', '1 ANO', '2026-04-16', '2027-04-16', NULL, 'MATRIZ'),
('SILVICULTURA', 'MUNCK', 'PTT 8D76', '1 ANO', '2026-04-22', '2027-04-16', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'MUNCK', 'TZB1G12', '1 ANO', '2026-04-16', '2027-04-16', NULL, 'MATRIZ');

-- 6.4 Laudo Eletromecânico Caminhão (docs_laudo_eletromecanico)
INSERT INTO public.docs_laudo_eletromecanico (local, co, placa, periodo, data_expedicao, data_vencimento, observacoes, filial_id) VALUES
('RESERVA', 'PIPA', 'PTF 4236', '6 MESES', '2025-10-01', '2026-03-10', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'PIPA', 'LUC 7J90', '6 MESES', '2025-10-02', '2026-03-31', NULL, 'MATRIZ'),
('BASE-OFICINA', 'MULT', 'PTV 4G53', '3 MESES', '2026-02-11', '2026-04-08', NULL, 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'ROG 1I38', '6 MESES', '2025-09-11', '2026-04-11', NULL, 'MATRIZ'),
('MÓDULO 07 FW', 'COMBOIO', 'ROE 8F63', '6 MESES', '2025-10-28', '2026-04-24', NULL, 'MATRIZ'),
('TITULAR', 'COMBOIO', 'TCN7J90', '6 MESES', '2025-10-30', '2026-04-30', NULL, 'MATRIZ'),
('CARREGAMENTO', 'MULT', 'PTV 3A59', '3 MESES', '2026-02-11', '2026-05-11', NULL, 'MATRIZ'),
('MÓDULO 05 HV', 'COMBOIO', 'ROG 1I26', '6 MESES', '2025-12-12', '2026-06-10', NULL, 'MATRIZ'),
('MÓDULO 02', 'PIPA', 'TCA4B23', '6 MESES', '2025-12-18', '2026-06-16', NULL, 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'TCC4D15', '6 MESES', '2026-03-24', '2026-06-24', NULL, 'MATRIZ'),
('RESERVA', 'COMBOIO', 'TCN7J72', '6 MESES', '2025-12-29', '2026-06-29', NULL, 'MATRIZ'),
('MÓDULO 05 FW', 'COMBOIO', 'ROG 1I41', '6 MESES', '2026-01-06', '2026-07-06', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'COMBOIO', 'ROG 1I40', '3 MESES', '2026-04-10', '2026-07-09', NULL, 'MATRIZ'),
('CARREGAMENTO', 'COMBOIO', 'LMT 7E29', '3 MESES', '2026-04-13', '2026-07-10', NULL, 'MATRIZ'),
('MÓDULO 5 HV', 'PIPA', 'TCC6G17', '6 MESES', '2026-01-15', '2026-07-14', NULL, 'MATRIZ'),
('MÓDULO 05 FW', 'PIPA', 'TCC2E83', '6 MESES', '2026-01-19', '2026-07-17', NULL, 'MATRIZ'),
('MÓDULO 02', 'COMBOIO', 'ROE 8F66', '6 MESES', '2026-02-03', '2026-08-03', NULL, 'MATRIZ'),
('MÓDULO 07 FW', 'PIPA', 'TCA4B26', '6 MESES', '2026-02-12', '2026-08-11', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'MUNCK', 'TZB1G12', '6 MESES', '2026-04-16', '2026-10-13', NULL, 'MATRIZ'),
('MÓDULO 05 HV', 'MUNCK', 'TZB1G41', '6 MESES', '2026-04-16', '2026-10-13', NULL, 'MATRIZ'),
('MÓDULO 07 HV', 'COMBOIO', 'TCN7J82', '3 MESES', '2026-04-17', '2026-10-17', 'LAUDO FOI FEITO COM O JOÃO', 'MATRIZ'),
('CARREGAMENTO', 'MUNCK', 'PTT 8D76', '6 MESES', '2026-04-22', '2026-10-19', NULL, 'MATRIZ'),
('CARREGAMENTO', 'PIPA', 'PTV 4G49', '6 MESES', '2026-05-21', '2026-11-17', NULL, 'MATRIZ');
