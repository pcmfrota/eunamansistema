-- Histórico/auditoria do Controle de Custos: registra criação, edição e exclusão
-- de lançamentos, fornecedores e parcelas de cartão — o que foi feito e por quem.

CREATE TABLE IF NOT EXISTS public.custos_historico (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  acao text NOT NULL CHECK (acao IN ('CRIACAO', 'EDICAO', 'EXCLUSAO')),
  tabela_origem text NOT NULL CHECK (tabela_origem IN ('custos_manutencao', 'custos_fornecedores', 'custos_parcelas')),
  registro_id text,
  descricao text,
  dados_antes jsonb,
  dados_depois jsonb,
  usuario_id uuid,
  usuario_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.custos_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "filial_isolation_custos_historico" ON public.custos_historico;
CREATE POLICY "filial_isolation_custos_historico" ON public.custos_historico
  FOR ALL TO authenticated
  USING (public.is_admin_user() OR filial_id = public.get_user_filial());

CREATE INDEX IF NOT EXISTS idx_custos_historico_created ON public.custos_historico(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_custos_historico_filial ON public.custos_historico(filial_id);

NOTIFY pgrst, 'reload schema';
