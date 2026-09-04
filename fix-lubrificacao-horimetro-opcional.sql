-- Torna o Horímetro Inicial/Final da Ficha de Lubrificação opcional (não bloqueia mais o lançamento).
ALTER TABLE public.fichas_lubrificacao
  ALTER COLUMN horimetro_inicio DROP NOT NULL,
  ALTER COLUMN horimetro_fim DROP NOT NULL;
