-- Aplicar manualmente no SQL Editor do Supabase
--
-- Permite reabrir uma ficha de Captação de Água mesmo depois que o mês operacional
-- (calendario_suzano) virou. O app trava automaticamente qualquer ficha cujo mes/ano
-- fique no passado, mesmo que o status ainda esteja "Aberta" — sem uma marca própria,
-- só voltar o status pra "Aberta" não adianta, porque a trava por período re-bloqueia
-- na mesma hora. Esta coluna guarda quando a ficha foi reaberta manualmente, e o app
-- passa a respeitar essa reabertura mesmo com o período já tendo avançado.

ALTER TABLE public.fichas_captacao
  ADD COLUMN IF NOT EXISTS reaberta_em TIMESTAMP WITHOUT TIME ZONE;
