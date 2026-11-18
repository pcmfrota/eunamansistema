-- Controle de Horímetro e KM
-- Passa a registrar o KM junto com o horímetro (modal "Atualizar Horímetro e KM") e a data
-- da leitura, que alimenta a aba "Calendário de Leituras" (placa x dia).
-- Só adiciona colunas (nullable); nenhum dado existente é alterado.

ALTER TABLE public.preventivas
  ADD COLUMN IF NOT EXISTS km_atual numeric,
  ADD COLUMN IF NOT EXISTS ultimo_km numeric;

ALTER TABLE public.historico_horimetros
  ADD COLUMN IF NOT EXISTS km_anterior numeric,
  ADD COLUMN IF NOT EXISTS km_novo numeric,
  ADD COLUMN IF NOT EXISTS data_referencia date;

-- O calendário busca as leituras por período (data_referencia) e placa.
CREATE INDEX IF NOT EXISTS historico_horimetros_data_referencia_idx
  ON public.historico_horimetros (data_referencia);
