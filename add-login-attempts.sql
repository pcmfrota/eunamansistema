-- Aplicar manualmente no SQL Editor do Supabase
--
-- Histórico de Tentativas de Acesso: registra toda tentativa de login (sucesso ou falha)
-- pra o admin conseguir ver quem tentou entrar, quando e por que falhou (ex.: senha errada,
-- e-mail inexistente, cadastro ainda não aprovado). Uma tentativa falha não gera sessão
-- autenticada, então o insert é feito pelo servidor com a service role key (bypassa RLS) —
-- por isso não existe policy de INSERT aqui, só de SELECT restrita a administradores.

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  sucesso BOOLEAN NOT NULL,
  motivo TEXT,
  user_id UUID,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS login_attempts_created_at_idx ON public.login_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON public.login_attempts (email);

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins veem tentativas de login" ON public.login_attempts;
CREATE POLICY "Admins veem tentativas de login"
  ON public.login_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
