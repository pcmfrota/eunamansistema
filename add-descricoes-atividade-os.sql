-- Adiciona campo descricoes_atividade (array JSON de blocos: descrição + horário
-- inicial/final + foto) na tabela ordens_servico. Permite registrar múltiplas
-- descrições de atividade na mesma OS, cada uma com seu próprio intervalo de
-- horário e evidência fotográfica — quantidade livre, sem limite fixo.
-- A coluna "descricao" (texto livre) é mantida como está, recebendo um resumo
-- concatenado das descrições de cada bloco, pra continuar compatível com o que
-- já lê/filtra por ela (site, listagens, etc.).
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS descricoes_atividade jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ordens_servico.descricoes_atividade IS
  'Array de blocos de descrição da atividade: [{descricao, hora_inicio, hora_fim, foto}], quantidade livre. descricao (coluna de texto) continua com o resumo concatenado.';
