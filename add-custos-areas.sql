-- Generaliza o Controle de Custos pra além de Manutenção: adiciona a área do lançamento
-- (Manutenção / Operação / Administrativo / Oficina-Base / Segurança) e uma categoria livre
-- por área (ex: Material, Serviços, Mão de Obra, EPIs...), com campo de texto livre quando a
-- categoria escolhida for "Outros". Placa deixa de ser obrigatória, já que nem todo custo das
-- novas áreas está ligado a um veículo específico.

ALTER TABLE public.custos_manutencao ALTER COLUMN placa DROP NOT NULL;

ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'MANUTENCAO'
  CHECK (area IN ('MANUTENCAO', 'OPERACAO', 'ADMINISTRATIVO', 'OFICINA_BASE', 'SEGURANCA'));

ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS categoria text;
ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS categoria_outros text;

CREATE INDEX IF NOT EXISTS idx_custos_manutencao_area ON public.custos_manutencao(area);

NOTIFY pgrst, 'reload schema';
