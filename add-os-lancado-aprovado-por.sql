-- Aplicar manualmente no SQL Editor do Supabase
--
-- Controle de OS: rastreia quem lançou cada ordem de serviço (created_by/created_by_nome,
-- gravado só na criação) e quem/quando aprovou (aprovado_por/aprovado_por_nome/aprovado_em) —
-- alimenta a nova aba "Validação" (admin/PCM) e a coluna "Lançado por" na Lista de OS.

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS created_by_nome TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_por UUID,
  ADD COLUMN IF NOT EXISTS aprovado_por_nome TEXT,
  ADD COLUMN IF NOT EXISTS aprovado_em TIMESTAMPTZ;
