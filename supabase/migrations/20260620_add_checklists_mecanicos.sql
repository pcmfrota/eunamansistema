-- ============================================================
-- SCRIPT PARA CRIAR A TABELA checklists_mecanicos NO SUPABASE
-- Execute este SQL no painel do Supabase: SQL Editor
-- ============================================================

-- Criar a tabela com referência correta para auth.users
CREATE TABLE IF NOT EXISTS public.checklists_mecanicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_caminhao VARCHAR(50) NOT NULL,
    placa VARCHAR(50) NOT NULL,
    local VARCHAR(100),
    co VARCHAR(100),
    motorista VARCHAR(255),
    matricula VARCHAR(100),
    km NUMERIC,
    turno VARCHAR(50),
    horimetro NUMERIC,
    data_checklist DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(50) DEFAULT 'Fechado',
    respostas JSONB NOT NULL DEFAULT '{}',
    pendencias_adicionais TEXT,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.checklists_mecanicos ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir
DROP POLICY IF EXISTS auth_all ON public.checklists_mecanicos;

-- Criar política de acesso para usuários autenticados
CREATE POLICY auth_all ON public.checklists_mecanicos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_checklists_mecanicos_placa ON public.checklists_mecanicos(placa);
CREATE INDEX IF NOT EXISTS idx_checklists_mecanicos_tipo ON public.checklists_mecanicos(tipo_caminhao);
CREATE INDEX IF NOT EXISTS idx_checklists_mecanicos_criado_em ON public.checklists_mecanicos(criado_em DESC);
