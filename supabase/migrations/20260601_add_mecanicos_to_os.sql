-- Adiciona campo mecanicos (array de texto, até 5 nomes) na tabela ordens_servico
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS mecanicos text[] DEFAULT '{}';

COMMENT ON COLUMN public.ordens_servico.mecanicos IS 'Lista de mecânicos que executaram o serviço (máximo 5)';
