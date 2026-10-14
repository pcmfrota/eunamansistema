-- Histórico/auditoria do Backlog: registra criação, edição e exclusão de itens —
-- o que foi feito e por quem. Mesmo padrão já usado em custos_historico.

CREATE TABLE IF NOT EXISTS public.backlog_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  acao text NOT NULL CHECK (acao IN ('CRIACAO', 'EDICAO', 'EXCLUSAO')),
  registro_id text,
  descricao text,
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.backlog_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "filial_isolation_backlog_historico" ON public.backlog_historico;
CREATE POLICY "filial_isolation_backlog_historico" ON public.backlog_historico
  FOR ALL TO authenticated
  USING (public.is_admin_user() OR filial_id = public.get_user_filial());

CREATE INDEX IF NOT EXISTS idx_backlog_historico_created ON public.backlog_historico(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_backlog_historico_filial ON public.backlog_historico(filial_id);

NOTIFY pgrst, 'reload schema';
