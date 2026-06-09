-- Adiciona a coluna para armazenar até 5 fotos do serviço (em formato array de base64 TEXT)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS fotos TEXT[] DEFAULT '{}'::text[];
