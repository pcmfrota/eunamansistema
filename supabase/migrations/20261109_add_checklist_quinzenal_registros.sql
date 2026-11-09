-- ============================================================
-- Tabela de registros do Calendário Quinzenal de Checklist
-- (stamp rápido por placa/dia: colaborador, horímetro e km),
-- separada da checklists_mecanicos (inspeção completa).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.checklist_quinzenal_registros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE SET NULL,
    placa VARCHAR(50) NOT NULL,
    tipo_caminhao VARCHAR(50),
    data_checklist DATE NOT NULL,
    colaborador VARCHAR(255) NOT NULL,
    horimetro NUMERIC,
    km NUMERIC,
    criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    criado_por_nome VARCHAR(255),
    filial_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (placa, data_checklist)
);

ALTER TABLE public.checklist_quinzenal_registros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all ON public.checklist_quinzenal_registros;
CREATE POLICY auth_all ON public.checklist_quinzenal_registros
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_checklist_quinzenal_placa ON public.checklist_quinzenal_registros(placa);
CREATE INDEX IF NOT EXISTS idx_checklist_quinzenal_data ON public.checklist_quinzenal_registros(data_checklist DESC);
