-- Adiciona a coluna para armazenar a assinatura digital do mecânico (em formato base64 TEXT)
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS assinatura_mecanico TEXT;
