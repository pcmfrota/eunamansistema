-- Classificação técnica (Sistema/Subsistema/Componente) e Mão de Obra — campos novos
-- pedidos a partir do prompt de backlog do cliente, reaproveitando só a parte que ainda
-- não existia no sistema atual (base de frotas, módulos e critério de prioridade A/B
-- continuam exatamente como já estavam).
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS sistema_cod INTEGER;
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS subsistema_cod INTEGER;
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS componente_cod INTEGER;
ALTER TABLE public.backlog ADD COLUMN IF NOT EXISTS mao_obra TEXT;

-- previsao_material e previsao_conclusao já existiam como DATE, mas o prompt pede que
-- aceitem também um rótulo (ex: "SEM PREVISÃO", "AGUARDANDO PROGRAMAÇÃO") quando ainda
-- não há uma data definida — TEXT aceita os dois formatos sem perder o que já tinha.
ALTER TABLE public.backlog ALTER COLUMN previsao_material TYPE TEXT;
ALTER TABLE public.backlog ALTER COLUMN previsao_conclusao TYPE TEXT;

NOTIFY pgrst, 'reload schema';
