-- Aplicar manualmente no SQL Editor do Supabase
--
-- Controle de Lavagens: opção de assinar o lançamento (assinatura desenhada num canvas,
-- salva como imagem base64 igual às fotos) — aparece na ficha em PDF e no painel de
-- Detalhes.

ALTER TABLE public.lavagens
  ADD COLUMN IF NOT EXISTS assinatura_url TEXT;
