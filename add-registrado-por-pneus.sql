-- Aplicar manualmente no SQL Editor do Supabase
--
-- Guarda quem registrou cada boletim de pneus, pra exibir no Histórico e
-- restringir a visualização por usuário (mecânico/motorista só vê o que ele
-- mesmo lançou; admin continua vendo tudo — regra aplicada no app).

ALTER TABLE public.inspecoes_pneus
  ADD COLUMN IF NOT EXISTS registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS registrado_por_nome TEXT;
