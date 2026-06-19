-- Adicionando novas colunas à tabela colaboradores
ALTER TABLE public.colaboradores 
ADD COLUMN IF NOT EXISTS matricula TEXT,
ADD COLUMN IF NOT EXISTS cargo TEXT,
ADD COLUMN IF NOT EXISTS local TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo',
ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'MECÂNICO';

-- Atualizar registros existentes para garantir que o tipo seja preenchido corretamente
UPDATE public.colaboradores
SET tipo = 'MECÂNICO'
WHERE tipo IS NULL;

-- Atualizar status nulos
UPDATE public.colaboradores
SET status = 'Ativo'
WHERE status IS NULL;
