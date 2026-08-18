-- Solicitações de exclusão de itens do Backlog
-- Usuários não-administradores passam a "solicitar" a exclusão de um item (com motivo).
-- O administrador (Marcos Rocha) revisa na aba "Solicitação de Exclusão" e aprova ou rejeita.

CREATE TABLE IF NOT EXISTS public.backlog_delete_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE SET NULL: quando a solicitação é aprovada, o item do backlog é excluído,
  -- mas o histórico da solicitação (e o snapshot abaixo) precisa continuar existindo.
  backlog_id UUID REFERENCES public.backlog(id) ON DELETE SET NULL,

  -- Snapshot dos dados do backlog no momento da solicitação (permanece mesmo após a exclusão)
  backlog_frota TEXT,
  backlog_modulo TEXT,
  backlog_criticidade TEXT,
  backlog_status TEXT,
  backlog_descricao TEXT,
  backlog_data_evidencia TEXT,
  backlog_tag TEXT,

  motivo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE', -- PENDENTE | APROVADO | REJEITADO

  solicitado_por UUID REFERENCES auth.users(id),
  solicitado_por_nome TEXT,
  solicitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),

  respondido_por UUID REFERENCES auth.users(id),
  respondido_em TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backlog_delete_requests_status ON public.backlog_delete_requests(status);
CREATE INDEX IF NOT EXISTS idx_backlog_delete_requests_backlog_id ON public.backlog_delete_requests(backlog_id);

ALTER TABLE public.backlog_delete_requests ENABLE ROW LEVEL SECURITY;

-- Mesma política de acesso já usada na tabela public.backlog (autorização é feita na camada da aplicação)
DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.backlog_delete_requests;
CREATE POLICY "Permitir acesso total temporário" ON public.backlog_delete_requests FOR ALL USING (true) WITH CHECK (true);
