ALTER TABLE public.controladoria_frota ADD COLUMN IF NOT EXISTS curso_direcao_segura_validade date;
ALTER TABLE public.controladoria_frota ADD COLUMN IF NOT EXISTS curso_direcao_segura_anexo_url text;
