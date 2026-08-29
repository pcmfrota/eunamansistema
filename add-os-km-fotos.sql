-- Aplicar manualmente no SQL Editor do Supabase
--
-- Controle de OS: adiciona o campo KM (além do horímetro já existente) e as fotos
-- obrigatórias de horímetro e KM, cada uma em sua própria coluna (igual ao padrão já usado
-- em imagem_horimetro_url no Controle de Lavagens).

ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS km NUMERIC,
  ADD COLUMN IF NOT EXISTS foto_horimetro TEXT,
  ADD COLUMN IF NOT EXISTS foto_km TEXT;
