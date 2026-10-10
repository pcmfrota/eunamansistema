-- Módulo "Controle de Insumos" (Fichas de Abastecimento / Recarga de comboios) — rota /insumos
-- Rodar manualmente no SQL Editor do Supabase (mesmo padrão dos demais add-*.sql deste repo).
-- Fase 0 (fundação): cria todo o schema de uma vez; as telas vêm nas fases seguintes.

-- ============================================================================
-- 1) EXTENSÃO DE public.equipamentos (reaproveita a frota já cadastrada —
--    as 25 placas dos comboios/pipas/munck/multifuncional/skid já existem lá,
--    classificadas corretamente em `tipo`. Só faltam estes 3 campos.)
-- ============================================================================
ALTER TABLE public.equipamentos
  ADD COLUMN IF NOT EXISTS deposito_suzano text,
  ADD COLUMN IF NOT EXISTS numero_tanques_diesel int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS capacidade_tanque_litros numeric;

-- ============================================================================
-- 2) CATÁLOGOS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insumos_modulos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  centro text,
  deposito text,
  controle text,
  ativo boolean NOT NULL DEFAULT true,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.insumos_materiais (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo int,
  ni text NOT NULL,
  referencia text NOT NULL,
  material text NOT NULL,
  unidade text NOT NULL DEFAULT 'L',
  aplicacao text NOT NULL CHECK (aplicacao IN
    ('DIESEL', 'CORRENTE', 'GRAXA', 'TRANSMISSAO', 'FLUIDO', 'HIDRAULICO_MOTOR', 'DIFERENCIAL', 'ADITIVO')),
  ativo boolean NOT NULL DEFAULT true,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vínculo "aplicação -> NI" por módulo (cada módulo pode faturar o mesmo tipo de insumo
-- num NI diferente). Fica vazio no seed inicial; é preenchido pela tela de cadastro.
CREATE TABLE IF NOT EXISTS public.insumos_modulo_material (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  modulo_id uuid NOT NULL REFERENCES public.insumos_modulos(id) ON DELETE CASCADE,
  aplicacao text NOT NULL,
  material_id uuid NOT NULL REFERENCES public.insumos_materiais(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_id, aplicacao)
);

CREATE TABLE IF NOT EXISTS public.insumos_impedimentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text,
  descricao text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3) FICHA DE ABASTECIMENTO
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insumos_fichas_abastecimento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_sequencial serial,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  modulo_id uuid REFERENCES public.insumos_modulos(id),
  turno text NOT NULL CHECK (turno IN ('1', '2', '3')),
  data date NOT NULL,
  motorista_nome text,
  motorista_matricula text,
  lubrificador_nome text,
  lubrificador_matricula text,
  km_horimetro_inicial numeric,
  km_horimetro_final numeric,
  regua_tanque1_inicial_cm numeric,
  regua_tanque1_inicial_lts numeric,
  regua_tanque1_final_cm numeric,
  regua_tanque1_final_lts numeric,
  regua_tanque2_inicial_cm numeric,
  regua_tanque2_inicial_lts numeric,
  regua_tanque2_final_cm numeric,
  regua_tanque2_final_lts numeric,
  codigo_impedimento_id uuid REFERENCES public.insumos_impedimentos(id),
  observacoes text,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'FINALIZADA', 'VALIDADA')),
  validado_por uuid,
  validado_por_nome text,
  validado_em timestamptz,
  criado_por uuid,
  criado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Não deixa abrir 2 fichas em rascunho ao mesmo tempo pro mesmo comboio.
CREATE UNIQUE INDEX IF NOT EXISTS idx_insumos_abastecimento_rascunho_unico
  ON public.insumos_fichas_abastecimento (equipamento_id)
  WHERE status = 'RASCUNHO';

CREATE INDEX IF NOT EXISTS idx_insumos_abastecimento_equipamento ON public.insumos_fichas_abastecimento(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_insumos_abastecimento_data ON public.insumos_fichas_abastecimento(data);
CREATE INDEX IF NOT EXISTS idx_insumos_abastecimento_filial ON public.insumos_fichas_abastecimento(filial_id);

-- Resumo por insumo (Diesel T1/T2, Corrente, Graxa, 85W140, Fluido, Hidráulico/Motor,
-- 85W140LS/Diferencial, Arla) — "saiu" é sempre calculado a partir das linhas de equipamento,
-- nunca digitado direto.
CREATE TABLE IF NOT EXISTS public.insumos_ficha_insumos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id uuid NOT NULL REFERENCES public.insumos_fichas_abastecimento(id) ON DELETE CASCADE,
  insumo_tipo text NOT NULL CHECK (insumo_tipo IN
    ('DIESEL_T1', 'DIESEL_T2', 'CORRENTE', 'GRAXA', 'TRANSMISSAO', 'FLUIDO', 'HIDRAULICO_MOTOR', 'DIFERENCIAL', 'ARLA')),
  acumulado_registradora_inicial numeric,
  quantidade_inicial numeric NOT NULL DEFAULT 0,
  entrou numeric NOT NULL DEFAULT 0,
  saiu numeric NOT NULL DEFAULT 0,
  acumulado_registradora_final numeric,
  restou numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ficha_id, insumo_tipo)
);

-- Consumo detalhado por equipamento (grade de baixo da ficha de papel).
CREATE TABLE IF NOT EXISTS public.insumos_abastecimento_linhas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ficha_id uuid NOT NULL REFERENCES public.insumos_fichas_abastecimento(id) ON DELETE CASCADE,
  hora_inicial time,
  hora_final time,
  equipamento_id uuid REFERENCES public.equipamentos(id),
  equipamento_texto text,
  horimetro numeric,
  diesel_registradora numeric,
  diesel_litros numeric,
  preventiva boolean,
  motor numeric,
  corrente numeric,
  graxa numeric,
  transmissao numeric,
  fluido_radiador numeric,
  hidraulico numeric,
  diferencial numeric,
  arla numeric,
  matricula_operador text,
  assinatura_operador_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumos_abastecimento_linhas_ficha ON public.insumos_abastecimento_linhas(ficha_id);

-- ============================================================================
-- 4) FICHA DE RECARGA DE INSUMOS + ESTOQUE DO SKID
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insumos_fichas_recarga (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  numero_sequencial serial,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  modulo_id uuid REFERENCES public.insumos_modulos(id),
  turno text CHECK (turno IN ('1', '2', '3')),
  data date NOT NULL,
  hora time,
  motorista_nome text,
  motorista_matricula text,
  observacao text,
  origem_tipo text NOT NULL CHECK (origem_tipo IN ('SKID', 'ALMOXARIFADO', 'FORNECEDOR', 'OUTRO')),
  origem_skid_id uuid REFERENCES public.equipamentos(id),
  origem_deposito text,
  origem_outro_texto text,
  local_recarga text,
  responsavel_nome text,
  responsavel_matricula text,
  responsavel_assinatura_url text,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'FINALIZADA')),
  aplicado_em_ficha_id uuid REFERENCES public.insumos_fichas_abastecimento(id),
  criado_por uuid,
  criado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumos_recarga_equipamento ON public.insumos_fichas_recarga(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_insumos_recarga_data ON public.insumos_fichas_recarga(data);

CREATE TABLE IF NOT EXISTS public.insumos_recarga_itens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  recarga_id uuid NOT NULL REFERENCES public.insumos_fichas_recarga(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.insumos_materiais(id),
  quantidade numeric NOT NULL,
  req_nf text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Livro-razão append-only do estoque de cada skid móvel — o saldo é sempre a soma desta
-- tabela (nunca um valor solto gravado em outro lugar), pra nunca ficar com saldo "stale".
CREATE TABLE IF NOT EXISTS public.insumos_skid_movimentos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  material_id uuid NOT NULL REFERENCES public.insumos_materiais(id),
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA', 'SAIDA')),
  quantidade numeric NOT NULL,
  origem_recarga_id uuid REFERENCES public.insumos_fichas_recarga(id),
  req_nf text,
  responsavel_nome text,
  responsavel_matricula text,
  foto_url text,
  observacao text,
  data date NOT NULL,
  criado_por uuid,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumos_skid_mov_equip_material ON public.insumos_skid_movimentos(equipamento_id, material_id);

CREATE TABLE IF NOT EXISTS public.insumos_skid_regua_medicoes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  equipamento_id uuid NOT NULL REFERENCES public.equipamentos(id),
  material_id uuid NOT NULL REFERENCES public.insumos_materiais(id),
  data date NOT NULL,
  regua_cm numeric,
  litros_calculados numeric,
  observacao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5) HISTÓRICO DE ALTERAÇÕES (mesmo padrão diff JSON->tabela legível do Custos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.insumos_ficha_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_ficha text NOT NULL CHECK (tipo_ficha IN ('ABASTECIMENTO', 'RECARGA')),
  ficha_id uuid NOT NULL,
  acao text NOT NULL,
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_insumos_ficha_historico_ficha ON public.insumos_ficha_historico(tipo_ficha, ficha_id);

-- ============================================================================
-- 6) ROW LEVEL SECURITY
--    Tabelas com filial_id própria: isolamento por filial (mesmo padrão do resto do app).
--    Catálogos e tabelas-filha (sem filial_id própria): acesso liberado a qualquer
--    autenticado — o controle de negócio já acontece via a ficha "pai".
-- ============================================================================
ALTER TABLE public.insumos_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_materiais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_modulo_material ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_impedimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_fichas_abastecimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_ficha_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_abastecimento_linhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_fichas_recarga ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_recarga_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_skid_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_skid_regua_medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insumos_ficha_historico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_modulos' AND policyname = 'insumos_modulos_all') THEN
    CREATE POLICY "insumos_modulos_all" ON public.insumos_modulos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_materiais' AND policyname = 'insumos_materiais_all') THEN
    CREATE POLICY "insumos_materiais_all" ON public.insumos_materiais FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_modulo_material' AND policyname = 'insumos_modulo_material_all') THEN
    CREATE POLICY "insumos_modulo_material_all" ON public.insumos_modulo_material FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_impedimentos' AND policyname = 'insumos_impedimentos_all') THEN
    CREATE POLICY "insumos_impedimentos_all" ON public.insumos_impedimentos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_fichas_abastecimento' AND policyname = 'filial_isolation_insumos_fichas_abastecimento') THEN
    CREATE POLICY "filial_isolation_insumos_fichas_abastecimento" ON public.insumos_fichas_abastecimento
      FOR ALL TO authenticated USING (public.is_admin_user() OR filial_id = public.get_user_filial());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_ficha_insumos' AND policyname = 'insumos_ficha_insumos_all') THEN
    CREATE POLICY "insumos_ficha_insumos_all" ON public.insumos_ficha_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_abastecimento_linhas' AND policyname = 'insumos_abastecimento_linhas_all') THEN
    CREATE POLICY "insumos_abastecimento_linhas_all" ON public.insumos_abastecimento_linhas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_fichas_recarga' AND policyname = 'filial_isolation_insumos_fichas_recarga') THEN
    CREATE POLICY "filial_isolation_insumos_fichas_recarga" ON public.insumos_fichas_recarga
      FOR ALL TO authenticated USING (public.is_admin_user() OR filial_id = public.get_user_filial());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_recarga_itens' AND policyname = 'insumos_recarga_itens_all') THEN
    CREATE POLICY "insumos_recarga_itens_all" ON public.insumos_recarga_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_skid_movimentos' AND policyname = 'filial_isolation_insumos_skid_movimentos') THEN
    CREATE POLICY "filial_isolation_insumos_skid_movimentos" ON public.insumos_skid_movimentos
      FOR ALL TO authenticated USING (public.is_admin_user() OR filial_id = public.get_user_filial());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_skid_regua_medicoes' AND policyname = 'insumos_skid_regua_medicoes_all') THEN
    CREATE POLICY "insumos_skid_regua_medicoes_all" ON public.insumos_skid_regua_medicoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'insumos_ficha_historico' AND policyname = 'insumos_ficha_historico_all') THEN
    CREATE POLICY "insumos_ficha_historico_all" ON public.insumos_ficha_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================================
-- 7) SEEDS
-- ============================================================================

-- Módulos — os 4 "Carregamento" vêm confirmados da planilha Suzano anexada (Centro 1358).
-- Os 5 módulos HV/FW ficam sem Centro/Depósito/Controle por enquanto: os prints enviados
-- trazem códigos de depósito conflitantes pra eles (ex: CB57/CB91/CB92 aparecem em mais
-- de um contexto) — preencha pela tela Cadastros > Módulos quando confirmar com a Suzano.
INSERT INTO public.insumos_modulos (codigo, nome, centro, deposito, controle) VALUES
  ('MOD02_HV', 'Módulo 02 – HV', NULL, NULL, NULL),
  ('MOD05_HV', 'Módulo 05 – HV', NULL, NULL, NULL),
  ('MOD05_FW', 'Módulo 05 – FW', NULL, NULL, NULL),
  ('MOD07_HV', 'Módulo 07 – HV', NULL, NULL, NULL),
  ('MOD07_FW', 'Módulo 07 – FW', NULL, NULL, NULL),
  ('CARREG_I', 'Carregamento I', '1358', 'CB10', NULL),
  ('CARREG_II', 'Carregamento II', '1358', 'CB58', NULL),
  ('CARREG_III', 'Carregamento III', '1358', 'CB91', NULL),
  ('CARREG_TERCEIRO', 'Carregamento Terceiro', '1358', 'CB44', NULL)
ON CONFLICT (codigo) DO NOTHING;

-- Materiais — exatamente os 9 itens que o usuário pediu pra já popular.
INSERT INTO public.insumos_materiais (codigo, ni, referencia, material, unidade, aplicacao) VALUES
  (27, '25193696', 'OLEO DIESEL 10PPM GRAN', 'DIESEL S10', 'L', 'DIESEL'),
  (28, '25194206', 'REAGENTE P/RED CATALIT SEL LIQ ARLA3220L', 'ARLA', 'UN', 'ADITIVO'),
  (22, '25372124', 'GRAXA OLEO MIN ITW/TURMALINE2S170KG', 'GRAXA', 'KG', 'GRAXA'),
  (13, '25068068', 'OLEO DELVAC MX CI-4 SAE15W40 A GRANEL', '15W40', 'L', 'HIDRAULICO_MOTOR'),
  (11, '27189937', 'FLUIDO P/RAD WYNNS/049050001370020', 'LÍQUIDO DE ARREFECIMENTO', 'L', 'FLUIDO'),
  (10, '25171500', 'OLEO LUBR MIN ADIT MOBILUBEHD85W140200L', 'ÓLEO 85W140', 'L', 'TRANSMISSAO'),
  (8, '25068067', 'OLEO CORRENTE HARVES TUTELA LC-01', 'TUTELA CORRENTE', 'L', 'CORRENTE'),
  (17, '25247476', 'OLEO LUBRIF LUBRAX GL5 LS SAE 85W140 20L', '85W140 LS', 'L', 'DIFERENCIAL'),
  (20, '25068232', 'OLEO BIODIESEL B S500 PETROBRAS', 'DIESEL S500', 'L', 'DIESEL')
ON CONFLICT DO NOTHING;

-- Impedimentos
INSERT INTO public.insumos_impedimentos (codigo, descricao) VALUES
  ('405', 'Priorizando outra máquina'),
  (NULL, 'Tempo de deslocamento'),
  (NULL, 'Aguardando diesel')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8) PERMISSÕES — libera a aba só pro admin por enquanto (mesmo padrão de
--    outras aberturas de módulo); outros cargos via tela de permissões existente.
-- ============================================================================
UPDATE public.role_permissions
SET allowed_tabs = array_append(allowed_tabs, '/insumos')
WHERE role = 'admin' AND NOT ('/insumos' = ANY(allowed_tabs));

NOTIFY pgrst, 'reload schema';
