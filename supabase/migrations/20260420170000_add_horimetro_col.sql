ALTER TABLE IF EXISTS public.inspecoes_pneus 
ADD COLUMN IF NOT EXISTS horimetro_registro NUMERIC;
