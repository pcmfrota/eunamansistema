-- Adiciona a coluna aprovado na tabela de ordens_servico (Default true para não afetar registros existentes)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.ordens_servico.aprovado IS 'Indica se a OS lançada por mecânicos foi aprovada pela gestão';
