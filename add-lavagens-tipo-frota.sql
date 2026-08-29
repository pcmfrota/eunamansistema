-- Aplicar manualmente no SQL Editor do Supabase
--
-- Controle de Lavagens: separa o lançamento (e o Painel/Calendário) entre frota pesada
-- (caminhões) e frota leve (carros) — cada uma com seu próprio formulário/checklist.
-- Guardamos o tipo escolhido no momento do lançamento (em vez de só olhar a categoria
-- atual do equipamento) pra manter o histórico correto mesmo se a categoria do
-- equipamento mudar depois.

ALTER TABLE public.lavagens
  ADD COLUMN IF NOT EXISTS tipo_frota TEXT;
