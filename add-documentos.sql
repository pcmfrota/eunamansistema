-- ── 1. Criar Tabelas ────────────────────────────────────────────────────────────

CREATE TABLE public.docs_tacografo (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  data_vencimento date NOT NULL,
  filial_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.docs_civ_cipp (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  data_vencimento date NOT NULL,
  filial_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.docs_laudo_eletromecanico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  periodo text NOT NULL,
  data_expedicao date NOT NULL,
  data_vencimento date NOT NULL,
  observacoes text,
  filial_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.docs_laudo_implemento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  local text NOT NULL,
  co text NOT NULL,
  placa text NOT NULL,
  periodo text NOT NULL,
  data_expedicao date NOT NULL,
  data_vencimento date NOT NULL,
  observacoes text,
  filial_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 2. Habilitar RLS (Row Level Security) ─────────────────────────────────────

ALTER TABLE public.docs_tacografo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_civ_cipp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_laudo_eletromecanico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_laudo_implemento ENABLE ROW LEVEL SECURITY;

-- ── 3. Criar Políticas de Isolamento ──────────────────────────────────────────

-- docs_tacografo
CREATE POLICY "filial_isolation_docs_tacografo" ON public.docs_tacografo
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- docs_civ_cipp
CREATE POLICY "filial_isolation_docs_civ_cipp" ON public.docs_civ_cipp
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- docs_laudo_eletromecanico
CREATE POLICY "filial_isolation_docs_laudo_eletromecanico" ON public.docs_laudo_eletromecanico
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- docs_laudo_implemento
CREATE POLICY "filial_isolation_docs_laudo_implemento" ON public.docs_laudo_implemento
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- ── 4. Criar Índices de Performance ───────────────────────────────────────────

CREATE INDEX idx_docs_tacografo_filial ON public.docs_tacografo(filial_id);
CREATE INDEX idx_docs_civ_cipp_filial ON public.docs_civ_cipp(filial_id);
CREATE INDEX idx_docs_laudo_eletro_filial ON public.docs_laudo_eletromecanico(filial_id);
CREATE INDEX idx_docs_laudo_impl_filial ON public.docs_laudo_implemento(filial_id);
