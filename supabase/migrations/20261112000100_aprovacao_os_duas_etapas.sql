-- Aprovação de O.S. em duas etapas (PCM + Supervisor de Manutenção) e assinatura
-- individual do mecânico por bloco de "Descrição da Atividade".
--
-- Regra de negócio (confirmada com o usuário):
--   - O.S. aberta por qualquer mecânico (via APK ou site) precisa de aprovação do PCM
--     E do Supervisor de Manutenção (duas etapas obrigatórias).
--   - O.S. aberta pelo PCM precisa só da aprovação do Supervisor de Manutenção.
--   - O.S. aberta por admin ou pelo próprio Supervisor de Manutenção é considerada
--     auto-aprovada nas etapas que já correspondem ao autor (sem loop de autoaprovação).
--
-- `aprovado` (coluna já existente) continua sendo o resultado final: true somente quando
-- todas as etapas exigidas para aquela O.S. estiverem aprovadas. Mantido por
-- compatibilidade com código/relatórios que já filtram por ele.

alter table public.ordens_servico
  add column if not exists aprovado_pcm boolean,
  add column if not exists aprovado_pcm_por uuid,
  add column if not exists aprovado_pcm_por_nome text,
  add column if not exists aprovado_pcm_em timestamptz,
  add column if not exists aprovado_supervisor boolean,
  add column if not exists aprovado_supervisor_por uuid,
  add column if not exists aprovado_supervisor_por_nome text,
  add column if not exists aprovado_supervisor_em timestamptz;

-- Backfill: toda O.S. já existente foi aberta e aprovada sob a regra antiga (single-stage).
-- Pra não reabrir pendências de aprovação que já estavam resolvidas, tratamos qualquer OS
-- com `aprovado = true` hoje como já aprovada em ambas as etapas (carimbo herdado do campo
-- antigo `aprovado_por`/`aprovado_por_nome`/`aprovado_em`, já que não há histórico de qual
-- etapa cada aprovação antiga representava).
update public.ordens_servico
set
  aprovado_pcm = true,
  aprovado_pcm_por = aprovado_por,
  aprovado_pcm_por_nome = aprovado_por_nome,
  aprovado_pcm_em = aprovado_em,
  aprovado_supervisor = true,
  aprovado_supervisor_por = aprovado_por,
  aprovado_supervisor_por_nome = aprovado_por_nome,
  aprovado_supervisor_em = aprovado_em
where aprovado = true;

-- O.S. ainda pendente (aprovado = false) sob a regra antiga vira pendente nas DUAS etapas,
-- exceto quando o autor já É o PCM (nesse caso a etapa do PCM é dispensada, igual à regra
-- nova) — usamos o papel atual do autor em `profiles` como melhor aproximação disponível.
update public.ordens_servico os
set
  aprovado_pcm = case when p.role = 'pcm' then true else false end,
  aprovado_supervisor = false
from public.profiles p
where os.created_by is not null
  and os.created_by ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and os.created_by::uuid = p.id
  and (os.aprovado is distinct from true);

-- O.S. pendente sem `created_by` rastreável (dado legado) vira pendente nas duas etapas,
-- igual à regra padrão (mecânico desconhecido = trata como mecânico).
update public.ordens_servico
set
  aprovado_pcm = coalesce(aprovado_pcm, false),
  aprovado_supervisor = coalesce(aprovado_supervisor, false)
where aprovado is distinct from true;
