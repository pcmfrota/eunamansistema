-- Até 2 fotos de evidência por item de backlog, anexadas manualmente no formulário
-- (upload ou colar da área de transferência) — array de data URLs base64, mesmo
-- padrão já usado em ordens_servico.fotos. Não confundir com a coluna singular
-- "evidencia_imagem", usada pelo fluxo de importação via WhatsApp/IA.

ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS evidencia_imagens TEXT[] DEFAULT '{}'::text[];

NOTIFY pgrst, 'reload schema';
