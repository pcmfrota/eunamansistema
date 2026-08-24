-- Aplicar manualmente no SQL Editor do Supabase (mesmo padrão dos outros add-*.sql deste projeto).
-- Guarda o print/imagem (base64, já comprimido no client) usado para lançar o item via IA.

ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS evidencia_imagem TEXT;
