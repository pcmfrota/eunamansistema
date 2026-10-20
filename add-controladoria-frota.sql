-- ── 1. Criar Tabela ────────────────────────────────────────────────────────────

CREATE TABLE public.controladoria_frota (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  matricula text,
  nome text NOT NULL,
  cargo text,
  local text,
  data_admissao date,
  numero_cartao text,
  cartao_ativo boolean,
  termo_assinado_cartao boolean,
  data_entrega_cartao date,
  termo_ciencia_monitoramento boolean,
  politica_frotas boolean,
  cartao_devolvido boolean,
  cnh_numero text,
  cnh_categoria text,
  cnh_validade date,
  cnh_anexo_url text,
  observacoes text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ── 2. Habilitar RLS (Row Level Security) ─────────────────────────────────────

ALTER TABLE public.controladoria_frota ENABLE ROW LEVEL SECURITY;

-- ── 3. Política de Isolamento por Filial ──────────────────────────────────────

CREATE POLICY "filial_isolation_controladoria_frota" ON public.controladoria_frota
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- ── 4. Índices de Performance ──────────────────────────────────────────────────

CREATE INDEX idx_controladoria_frota_filial ON public.controladoria_frota(filial_id);
CREATE INDEX idx_controladoria_frota_cnh_validade ON public.controladoria_frota(cnh_validade);
CREATE INDEX idx_controladoria_frota_matricula ON public.controladoria_frota(matricula);
