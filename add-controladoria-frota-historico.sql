-- Histórico/auditoria da Controladoria de Gestão de Frota — mesmo padrão de
-- backlog_historico e custos_historico: quem criou/editou/excluiu, com o
-- antes/depois completo pra exibir o diff.

CREATE TABLE public.controladoria_frota_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  acao text NOT NULL CHECK (acao IN ('CRIACAO', 'EDICAO', 'EXCLUSAO')),
  registro_id text,
  descricao text,
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.controladoria_frota_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filial_isolation_controladoria_frota_historico" ON public.controladoria_frota_historico
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

CREATE INDEX idx_controladoria_frota_historico_filial ON public.controladoria_frota_historico(filial_id);
CREATE INDEX idx_controladoria_frota_historico_created ON public.controladoria_frota_historico(created_at DESC);
