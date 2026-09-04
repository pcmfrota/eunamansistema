-- SQL Migration for Fichas de Lubrificação (EUNAMAN SISTEMA)

CREATE TABLE IF NOT EXISTS public.fichas_lubrificacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    data_registro TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
    placa TEXT NOT NULL,
    modulo TEXT NOT NULL DEFAULT 'BASE',
    local_servico TEXT NOT NULL DEFAULT 'OFICINA BASE',
    cliente TEXT NOT NULL DEFAULT 'SUZANO',
    horimetro_inicio NUMERIC,
    horimetro_fim NUMERIC,
    mecanico_responsavel TEXT NOT NULL,
    ajudante TEXT,
    checklist_lubrificacao JSONB NOT NULL DEFAULT '[]'::jsonb,
    checklist_geral JSONB NOT NULL DEFAULT '[]'::jsonb,
    calibragem JSONB NOT NULL DEFAULT '[]'::jsonb,
    reapertos JSONB NOT NULL DEFAULT '[]'::jsonb,
    fotos_antes TEXT[] DEFAULT ARRAY[]::TEXT[],
    fotos_depois TEXT[] DEFAULT ARRAY[]::TEXT[],
    gps_lat NUMERIC,
    gps_lng NUMERIC,
    observacoes TEXT,
    assinatura_mecanico TEXT NOT NULL,
    assinatura_lider TEXT,
    status TEXT NOT NULL DEFAULT 'CONCLUÍDO',
    filial_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- RLS (padrão do sistema: acesso liberado pra usuários autenticados, controle fica na app)
ALTER TABLE public.fichas_lubrificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir acesso total temporário" ON public.fichas_lubrificacao FOR ALL USING (true) WITH CHECK (true);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_fichas_lubrificacao_equipamento ON public.fichas_lubrificacao(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_fichas_lubrificacao_placa ON public.fichas_lubrificacao(placa);
CREATE INDEX IF NOT EXISTS idx_fichas_lubrificacao_data ON public.fichas_lubrificacao(data_registro);
CREATE INDEX IF NOT EXISTS idx_fichas_lubrificacao_modulo ON public.fichas_lubrificacao(modulo);
CREATE INDEX IF NOT EXISTS idx_fichas_lubrificacao_mecanico ON public.fichas_lubrificacao(mecanico_responsavel);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_fichas_lubrificacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_fichas_lubrificacao_updated_at ON public.fichas_lubrificacao;
CREATE TRIGGER trg_update_fichas_lubrificacao_updated_at
BEFORE UPDATE ON public.fichas_lubrificacao
FOR EACH ROW EXECUTE FUNCTION update_fichas_lubrificacao_updated_at();
