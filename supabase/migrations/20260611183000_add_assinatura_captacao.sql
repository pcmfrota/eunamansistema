-- Adiciona a coluna para armazenar a assinatura digital do Supervisor Suzano (em formato base64 TEXT)
ALTER TABLE public.fichas_captacao ADD COLUMN IF NOT EXISTS assinatura_supervisor TEXT;
