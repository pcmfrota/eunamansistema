-- ============================================================
-- Módulo PROGRAMAÇÃO MECÂNICA: tabela unificada das 4 programações
-- (Inspeção quinzenal, Lubrificação/Reapertos, Calibragem de Pneus,
-- Lavagem — todas semanais exceto Inspeção) + bucket de evidências.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.programacao_mecanica_execucoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
    placa VARCHAR(50) NOT NULL,
    tipo_programacao VARCHAR(20) NOT NULL CHECK (tipo_programacao IN ('inspecao','lubrificacao','calibragem','lavagem')),
    periodicidade VARCHAR(20) NOT NULL CHECK (periodicidade IN ('quinzenal','semanal')),
    data_programada DATE NOT NULL,
    data_execucao TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'programado' CHECK (status IN ('programado','em_andamento','executado')),
    km NUMERIC,
    horimetro NUMERIC,
    responsavel_execucao VARCHAR(255),
    responsavel_acompanhamento VARCHAR(255),
    observacoes TEXT,
    -- Evidências fotográficas: array de { path, url } no bucket programacao-mecanica-fotos (máx. 10, validado no app).
    fotos JSONB NOT NULL DEFAULT '[]',
    -- Campos específicos por tipo de programação (ex.: pressão por posição de pneu na calibragem,
    -- itens sim/não da ficha de lubrificação) — evita colunas esparsas só usadas por 1 dos 4 tipos.
    dados_extra JSONB NOT NULL DEFAULT '{}',
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_por_nome VARCHAR(255),
    filial_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (placa, tipo_programacao, data_programada)
);

ALTER TABLE public.programacao_mecanica_execucoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all ON public.programacao_mecanica_execucoes;
CREATE POLICY auth_all ON public.programacao_mecanica_execucoes
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_prog_mec_placa ON public.programacao_mecanica_execucoes(placa);
CREATE INDEX IF NOT EXISTS idx_prog_mec_tipo ON public.programacao_mecanica_execucoes(tipo_programacao);
CREATE INDEX IF NOT EXISTS idx_prog_mec_data_prog ON public.programacao_mecanica_execucoes(data_programada DESC);
CREATE INDEX IF NOT EXISTS idx_prog_mec_status ON public.programacao_mecanica_execucoes(status);

-- ─── Bucket de evidências fotográficas ───
INSERT INTO storage.buckets (id, name, public)
VALUES ('programacao-mecanica-fotos', 'programacao-mecanica-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Leitura pública fotos programação mecânica" ON storage.objects;
DROP POLICY IF EXISTS "Upload fotos programação mecânica" ON storage.objects;
DROP POLICY IF EXISTS "Exclusão fotos programação mecânica" ON storage.objects;

CREATE POLICY "Leitura pública fotos programação mecânica"
ON storage.objects FOR SELECT
USING (bucket_id = 'programacao-mecanica-fotos');

CREATE POLICY "Upload fotos programação mecânica"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'programacao-mecanica-fotos');

CREATE POLICY "Exclusão fotos programação mecânica"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'programacao-mecanica-fotos');
