-- Converte "fichas_mao_obra" de "1 ficha = 1 serviço em 1 placa" para
-- "1 ficha = 1 colaborador = 1 dia", com uma lista livre de atividades
-- (apontamento de tempo do dia inteiro, incluindo tempo ocioso).
-- Nenhuma coluna existente é removida — pecas/fotos_antes/fotos_depois/
-- assinatura_mecanico/assinatura_supervisor/equipamento_id/horimetro/km/
-- cliente/modelo/equipamento ficam na tabela sem uso pela UI nova, para
-- não arriscar perda de dado nas fichas já existentes.

ALTER TABLE public.fichas_mao_obra ALTER COLUMN placa DROP NOT NULL;
ALTER TABLE public.fichas_mao_obra ALTER COLUMN tipo_manutencao DROP NOT NULL;
ALTER TABLE public.fichas_mao_obra ALTER COLUMN descricao_servico DROP NOT NULL;

ALTER TABLE public.fichas_mao_obra ADD COLUMN IF NOT EXISTS data_jornada DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.fichas_mao_obra ADD COLUMN IF NOT EXISTS hora_inicio_jornada TEXT;
ALTER TABLE public.fichas_mao_obra ADD COLUMN IF NOT EXISTS hora_fim_jornada TEXT;
ALTER TABLE public.fichas_mao_obra ADD COLUMN IF NOT EXISTS tempo_produtivo_horas NUMERIC DEFAULT 0;
ALTER TABLE public.fichas_mao_obra ADD COLUMN IF NOT EXISTS tempo_ocioso_horas NUMERIC DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_fichas_mao_obra_data_jornada ON public.fichas_mao_obra (data_jornada);
