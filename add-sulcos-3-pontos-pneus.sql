-- Aplicar manualmente no SQL Editor do Supabase
--
-- Cada posição de pneu passa a ter 3 medições de sulco em vez de 1: lado direito,
-- meio e lado esquerdo — ajuda a identificar desgaste irregular de um lado só.
--
-- A coluna que já existe pra cada posição (de, dd, tei, ...) continua sendo o
-- Sulco 2 (meio) — é o valor que já alimenta o Dashboard/gráficos principais,
-- então nada nessas telas precisa mudar. Só adicionamos Sulco 1 (lado direito,
-- sufixo _s1) e Sulco 3 (lado esquerdo, sufixo _s3) como colunas novas.

ALTER TABLE public.inspecoes_pneus
  ADD COLUMN IF NOT EXISTS de_s1 NUMERIC,   ADD COLUMN IF NOT EXISTS de_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS dd_s1 NUMERIC,   ADD COLUMN IF NOT EXISTS dd_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tei_s1 NUMERIC,  ADD COLUMN IF NOT EXISTS tei_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tee_s1 NUMERIC,  ADD COLUMN IF NOT EXISTS tee_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tdi_s1 NUMERIC,  ADD COLUMN IF NOT EXISTS tdi_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tde_s1 NUMERIC,  ADD COLUMN IF NOT EXISTS tde_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tei1_s1 NUMERIC, ADD COLUMN IF NOT EXISTS tei1_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tee1_s1 NUMERIC, ADD COLUMN IF NOT EXISTS tee1_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tdi1_s1 NUMERIC, ADD COLUMN IF NOT EXISTS tdi1_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS tde1_s1 NUMERIC, ADD COLUMN IF NOT EXISTS tde1_s3 NUMERIC,
  ADD COLUMN IF NOT EXISTS estepe_s1 NUMERIC, ADD COLUMN IF NOT EXISTS estepe_s3 NUMERIC;
