-- Aplicar manualmente no SQL Editor do Supabase
--
-- Notificações in-app por cargo — usadas primeiro pelo Controle de OS pra avisar admin e
-- supervisor_manutencao assim que uma OS lançada/editada por um mecânico entra pendente de
-- validação (mesmo evento que já alimenta a aba "Validação"). Genérico o suficiente pra
-- outros módulos reaproveitarem no futuro (campo "tipo" identifica a origem).
--
-- O "lida" é por linha (compartilhado entre todo mundo que tem aquele cargo) — se o time
-- de admins for grande e cada um precisar de leitura individual, isso pode evoluir depois
-- pra uma tabela de junção por usuário; pra hoje, simples resolve.

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  mensagem TEXT,
  link TEXT,
  destinatario_role TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_destinatario_lida_idx ON public.notificacoes (destinatario_role, lida);
CREATE INDEX IF NOT EXISTS notificacoes_criado_em_idx ON public.notificacoes (criado_em DESC);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Inserção sempre via service role (server action com a chave de serviço) — quem cria uma
-- OS pendente de validação normalmente é o próprio mecânico, que não tem (nem deveria ter)
-- permissão de escrever nessa tabela diretamente.
DROP POLICY IF EXISTS "Usuarios veem notificacoes do proprio cargo" ON public.notificacoes;
CREATE POLICY "Usuarios veem notificacoes do proprio cargo"
  ON public.notificacoes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = notificacoes.destinatario_role
    )
  );

DROP POLICY IF EXISTS "Usuarios marcam como lida notificacoes do proprio cargo" ON public.notificacoes;
CREATE POLICY "Usuarios marcam como lida notificacoes do proprio cargo"
  ON public.notificacoes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = notificacoes.destinatario_role
    )
  );
