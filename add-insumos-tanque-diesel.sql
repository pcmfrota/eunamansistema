-- Cada linha de abastecimento de equipamento pode ter sido feita a partir do Tanque 1 ou
-- Tanque 2 do comboio (a maioria das fichas só usa o Tanque 1, mas o Tanque 2 existe e
-- precisa ser rastreado separadamente pro "saiu"/"restou" de cada tanque bater certo).
ALTER TABLE public.insumos_abastecimento_linhas
  ADD COLUMN IF NOT EXISTS tanque_diesel smallint DEFAULT 1 CHECK (tanque_diesel IN (1, 2));

NOTIFY pgrst, 'reload schema';
