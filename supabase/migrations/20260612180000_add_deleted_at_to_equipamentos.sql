-- Adiciona a coluna deleted_at se não existir
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Remove a restrição única antiga da coluna placa
ALTER TABLE public.equipamentos DROP CONSTRAINT IF EXISTS equipamentos_placa_key;

-- Adiciona a nova restrição única combinada que trata múltiplos nulos como iguais, permitindo apenas um ativo por placa
ALTER TABLE public.equipamentos ADD CONSTRAINT unique_placa_active UNIQUE NULLS NOT DISTINCT (placa, deleted_at);
