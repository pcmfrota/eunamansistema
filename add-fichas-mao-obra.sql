-- SCRIPT DE CRIAÇÃO DA TABELA DE FICHAS DIÁRIAS DE MÃO DE OBRA DO MECÂNICO

CREATE TABLE IF NOT EXISTS public.fichas_mao_obra (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_ficha TEXT UNIQUE NOT NULL,
    mecanico_nome TEXT NOT NULL,
    mecanico_matricula TEXT,
    equipe TEXT,
    supervisor TEXT,
    modulo TEXT,
    frente_trabalho TEXT,
    equipamento_id UUID,
    placa TEXT NOT NULL,
    equipamento TEXT,
    modelo TEXT,
    cliente TEXT,
    horimetro NUMERIC,
    km NUMERIC,
    tipo_manutencao TEXT NOT NULL,
    descricao_servico TEXT NOT NULL,
    atividades JSONB DEFAULT '[]'::jsonb,
    tempo_total_horas NUMERIC DEFAULT 0,
    pecas JSONB DEFAULT '[]'::jsonb,
    fotos_antes JSONB DEFAULT '[]'::jsonb,
    fotos_depois JSONB DEFAULT '[]'::jsonb,
    observacoes TEXT,
    assinatura_mecanico TEXT,
    assinatura_supervisor TEXT,
    latitude NUMERIC,
    longitude NUMERIC,
    status TEXT DEFAULT 'Em andamento',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    versao INT DEFAULT 1
);

-- Habilitar RLS
ALTER TABLE public.fichas_mao_obra ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Leitura pública autenticada de fichas de mão de obra"
    ON public.fichas_mao_obra FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Inserção autenticada de fichas de mão de obra"
    ON public.fichas_mao_obra FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Atualização autenticada de fichas de mão de obra"
    ON public.fichas_mao_obra FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Exclusão autorizada de fichas de mão de obra"
    ON public.fichas_mao_obra FOR DELETE
    TO authenticated
    USING (true);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_fichas_mao_obra_placa ON public.fichas_mao_obra (placa);
CREATE INDEX IF NOT EXISTS idx_fichas_mao_obra_mecanico ON public.fichas_mao_obra (mecanico_nome);
CREATE INDEX IF NOT EXISTS idx_fichas_mao_obra_created_at ON public.fichas_mao_obra (created_at DESC);
