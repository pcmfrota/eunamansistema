-- Até 2 fotos de evidência registradas DEPOIS da conclusão do backlog (ex: comprovar o
-- reparo feito), separado das fotos de evidência do problema original (evidencia_imagens).
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS evidencia_imagens_conclusao TEXT[] DEFAULT '{}'::text[];

NOTIFY pgrst, 'reload schema';
