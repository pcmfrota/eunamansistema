-- Histórico central de exclusões do sistema
-- Toda exclusão feita em qualquer módulo (OS, Backlog, Documentos, Preventivas, Pneus,
-- Captação, Lavagens, Programação Preventiva, Ficha Mão de Obra, Lubrificação,
-- Checklist Mecânicos, Afiação, Base de Frota, Calendário, Horímetro, etc.) é
-- registrada aqui: quando foi excluído, quem excluiu e uma cópia (snapshot) do
-- registro no momento da exclusão.

CREATE TABLE IF NOT EXISTS public.historico_exclusoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  modulo TEXT NOT NULL,          -- nome amigável do módulo/tipo de serviço (ex: 'Ordem de Serviço', 'Backlog', 'CIV/CIPP')
  tabela_origem TEXT NOT NULL,   -- tabela real do Supabase (ex: 'ordens_servico')
  registro_id TEXT,              -- id do registro excluído (texto para suportar qualquer formato de id)

  descricao TEXT,                -- resumo legível do que foi excluído
  dados JSONB,                   -- snapshot completo do registro no momento da exclusão

  origem TEXT NOT NULL DEFAULT 'DIRETO', -- DIRETO | SOLICITACAO_APROVADA

  excluido_por UUID REFERENCES auth.users(id),
  excluido_por_nome TEXT,
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_exclusoes_modulo ON public.historico_exclusoes(modulo);
CREATE INDEX IF NOT EXISTS idx_historico_exclusoes_excluido_em ON public.historico_exclusoes(excluido_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_exclusoes_excluido_por ON public.historico_exclusoes(excluido_por);

ALTER TABLE public.historico_exclusoes ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário autenticado pode inserir (é o próprio backend registrando a exclusão que ele fez).
DROP POLICY IF EXISTS "Permitir insercao autenticada" ON public.historico_exclusoes;
CREATE POLICY "Permitir insercao autenticada" ON public.historico_exclusoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Leitura liberada a autenticados na policy; a autorização real (somente admin)
-- é feita na camada da aplicação (server action), igual ao padrão já usado no projeto.
DROP POLICY IF EXISTS "Permitir leitura autenticada" ON public.historico_exclusoes;
CREATE POLICY "Permitir leitura autenticada" ON public.historico_exclusoes
  FOR SELECT TO authenticated USING (true);

-- Sem policy de UPDATE/DELETE: com RLS habilitado e nenhuma policy para essas
-- operações, ninguém (fora o service_role) altera ou apaga um registro de auditoria
-- pela chave anon/authenticated. Isso é intencional — é um histórico, não deve ser editável.
