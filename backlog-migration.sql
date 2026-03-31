-- Migração: Expansão da tabela de Backlog para suportar todos os campos do Wizard
-- Copie e cole este código no SQL Editor do seu painel Supabase

ALTER TABLE public.backlog 
ADD COLUMN IF NOT EXISTS semana INTEGER,
ADD COLUMN IF NOT EXISTS mes INTEGER,
ADD COLUMN IF NOT EXISTS ano INTEGER,
ADD COLUMN IF NOT EXISTS data_evidencia DATE,
ADD COLUMN IF NOT EXISTS modulo TEXT,
ADD COLUMN IF NOT EXISTS regiao_programa TEXT,
ADD COLUMN IF NOT EXISTS frota TEXT,
ADD COLUMN IF NOT EXISTS tag TEXT,
ADD COLUMN IF NOT EXISTS tipo TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT,
ADD COLUMN IF NOT EXISTS origem TEXT,
ADD COLUMN IF NOT EXISTS criticidade TEXT,
ADD COLUMN IF NOT EXISTS tempo_execucao TEXT,
ADD COLUMN IF NOT EXISTS campo_base TEXT,
ADD COLUMN IF NOT EXISTS os TEXT,
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS nr_rc TEXT,
ADD COLUMN IF NOT EXISTS nr_ordem TEXT,
ADD COLUMN IF NOT EXISTS fornecedor TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Aberta';

-- Opcional: Adicionar RLS global para testes
ALTER TABLE public.backlog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.backlog;
CREATE POLICY "Permitir acesso total temporário" ON public.backlog FOR ALL USING (true) WITH CHECK (true);
