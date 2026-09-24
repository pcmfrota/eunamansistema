-- Novo status "Pago via Cartão" (à vista ou parcelado) no Controle de Custos,
-- com tabela de parcelas pra monitorar quantas vezes foi parcelado, os meses
-- de vencimento, valor de cada parcela, fornecedor e qual cartão foi usado.

ALTER TABLE public.custos_manutencao DROP CONSTRAINT IF EXISTS custos_manutencao_status_check;
ALTER TABLE public.custos_manutencao ADD CONSTRAINT custos_manutencao_status_check
  CHECK (status IN ('PAGO', 'AG_PAGAMENTO', 'FATURADO', 'PAGO_CARTAO'));

ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS forma_pagamento_cartao text
  CHECK (forma_pagamento_cartao IN ('AVISTA', 'PARCELADO'));
ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS cartao text;
ALTER TABLE public.custos_manutencao ADD COLUMN IF NOT EXISTS parcelas_total integer;

CREATE TABLE IF NOT EXISTS public.custos_parcelas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  custo_id uuid NOT NULL REFERENCES public.custos_manutencao(id) ON DELETE CASCADE,
  numero integer NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  mes_vencimento date NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO')),
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.custos_parcelas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "filial_isolation_custos_parcelas" ON public.custos_parcelas;
CREATE POLICY "filial_isolation_custos_parcelas" ON public.custos_parcelas
  FOR ALL TO authenticated
  USING (public.is_admin_user() OR filial_id = public.get_user_filial());

CREATE INDEX IF NOT EXISTS idx_custos_parcelas_custo ON public.custos_parcelas(custo_id);
CREATE INDEX IF NOT EXISTS idx_custos_parcelas_filial ON public.custos_parcelas(filial_id);

NOTIFY pgrst, 'reload schema';
