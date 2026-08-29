-- Aplicar manualmente no SQL Editor do Supabase
--
-- Controle de Lavagens: registra quem lançou cada lavagem (mesmo padrão já usado no
-- Boletim de Pneus) e a lista de itens que foram lavados no caminhão (checklist simples
-- do formulário de lançamento).

ALTER TABLE public.lavagens
  ADD COLUMN IF NOT EXISTS registrado_por UUID,
  ADD COLUMN IF NOT EXISTS registrado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS itens_lavados JSONB;
