-- Controla o que já foi lançado no SAP da Suzano a partir da planilha "Baixa de Diesel e
-- Lubrificantes" exportada. Granularidade por ficha (não por linha/insumo individual) —
-- simplificação deliberada: toda a ficha é baixada de uma vez, já que ela normalmente é
-- lançada no SAP inteira na mesma operação.
ALTER TABLE public.insumos_fichas_abastecimento
  ADD COLUMN IF NOT EXISTS status_baixa text NOT NULL DEFAULT 'PENDENTE' CHECK (status_baixa IN ('PENDENTE', 'BAIXADO'));

NOTIFY pgrst, 'reload schema';
