-- Item de recarga de diesel também precisa dizer pra qual tanque do comboio foi (só
-- relevante quando o comboio tem 2 tanques — mesmo campo já existe em
-- insumos_abastecimento_linhas pelo mesmo motivo).
ALTER TABLE public.insumos_recarga_itens
  ADD COLUMN IF NOT EXISTS tanque_diesel smallint CHECK (tanque_diesel IN (1, 2));

NOTIFY pgrst, 'reload schema';
