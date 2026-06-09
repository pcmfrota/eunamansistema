-- Criar tabela de colaboradores
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar política de acesso total temporária
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.colaboradores;
CREATE POLICY "Permitir acesso total temporário" ON public.colaboradores FOR ALL USING (true) WITH CHECK (true);

-- Adicionar coluna colaborador à tabela de backlog
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS colaborador TEXT;
