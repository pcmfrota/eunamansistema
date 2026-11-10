-- ============================================================================
-- CONTROLE DE ACESSO EM 3 CAMADAS — permissões por INDIVÍDUO
-- ============================================================================
-- Substitui o modelo anterior (role_permissions, por CARGO) por permissões
-- individuais por usuário. role_permissions deixa de ser fonte de autorização
-- (fica só como preset opcional ao criar um usuário novo).
--
-- Reversível: toda policy antiga é removida via _drop_all_policies() (não
-- apagada manualmente por nome), então o rollback é "recriar a policy antiga
-- com USING(true)" por tabela — trivial de reverter tabela a tabela se algo
-- quebrar. A tabela user_module_permissions é aditiva (não remove nada).
-- ============================================================================

-- ─── 0. Helper de migration: remove TODAS as policies existentes de uma tabela ───
-- Evita o risco de "policy nova + policy antiga permissiva convivendo" (Postgres
-- combina policies permissivas do mesmo comando com OR — uma policy antiga
-- esquecida tornaria a nova inútil). Removida no final deste arquivo.
create or replace function public._drop_all_policies(p_table text)
returns void language plpgsql as $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = p_table loop
    execute format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  end loop;
end;
$$;

-- ─── 1. Tabela de permissões individuais ───────────────────────────────────
-- id próprio (em vez de PK composta) por convenção do projeto: todo store do
-- IndexedDB usado no modo offline espera keyPath 'id' (ver lib/offline-db.ts).
create table if not exists public.user_module_permissions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  modulo     text not null,
  granted_at timestamptz not null default now(),
  granted_by uuid references public.profiles(id),
  unique (user_id, modulo)
);
create index if not exists idx_user_module_permissions_user on public.user_module_permissions(user_id);

alter table public.user_module_permissions enable row level security;

select public._drop_all_policies('user_module_permissions');

create policy "ump_select_own_or_admin" on public.user_module_permissions
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin_user());

create policy "ump_admin_write" on public.user_module_permissions
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- ─── 1.5 Novo status 'bloqueado' (Cenário F do pedido — bloquear/desbloquear
-- usuário). Hoje só existiam pendente/aprovado/rejeitado.
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status = any (array['pendente', 'aprovado', 'rejeitado', 'bloqueado']));

-- ─── 2. Funções centrais de autorização (mesmo padrão SECURITY DEFINER já
--        usado por is_admin_user()/get_user_filial() — evita recursão de RLS,
--        pois a função roda com privilégio do dono, ignorando a própria RLS
--        da tabela que consulta) ───────────────────────────────────────────
create or replace function public.user_is_active()
returns boolean
language sql stable security definer
as $$
  select coalesce(
    (select status from public.profiles where id = auth.uid()) = 'aprovado',
    false
  )
$$;

create or replace function public.user_has_module(p_modulo text)
returns boolean
language sql stable security definer
as $$
  select public.user_is_active() and (
    public.is_admin_user()
    or exists (
      select 1 from public.user_module_permissions ump
      where ump.user_id = auth.uid() and ump.modulo = p_modulo
    )
  )
$$;

-- ─── 3. Seed: migra o acesso efetivo atual (via cargo) para linhas individuais ───
-- Ninguém perde acesso no momento do corte — o admin passa a ajustar pessoa a
-- pessoa a partir daqui. '/' em allowed_tabs mapeia para '/dashboard' (mesma
-- regra já usada no middleware/auth-context atuais).
insert into public.user_module_permissions (user_id, modulo)
select p.id, case when t.tab = '/' then '/dashboard' else t.tab end
from public.profiles p
join public.role_permissions rp on rp.role = p.role
cross join lateral unnest(rp.allowed_tabs) as t(tab)
where p.status = 'aprovado'
on conflict (user_id, modulo) do nothing;

-- Admin sempre vê tudo, independente de linha gravada aqui (user_has_module já
-- faz esse bypass) — mas gravamos as linhas também para a tela de Gestão de
-- Usuários exibir os checkboxes marcados corretamente.
insert into public.user_module_permissions (user_id, modulo)
select p.id, m.modulo
from public.profiles p
cross join (select unnest(array[
  '/dashboard','/mao-de-obra','/os','/checklist-mecanicos','/programacao-mecanica',
  '/preventivas','/horimetro','/pneus','/backlog','/programacao-preventiva',
  '/base-frotas','/base-dados','/calendario','/lavagens','/lubrificacao','/captacao',
  '/documentos','/controladoria-frota','/checklist-frota','/controle-filtros','/afiacao',
  '/custos','/insumos','/indicadores','/pcm','/semanal','/historico-exclusoes',
  '/tentativas-acesso','/admin/usuarios'
]) as modulo) m
where p.role = 'admin' and p.status = 'aprovado'
on conflict (user_id, modulo) do nothing;

-- (Seção removida: auto-escalonamento de filial já é bloqueado pelo gatilho
-- existente trg_prevent_self_role_escalation / prevent_self_role_escalation(),
-- que reverte role/status/cargo_solicitado/filial_id silenciosamente sempre
-- que quem edita não é admin — confirmado direto no banco antes de mexer,
-- não precisava de gatilho novo.)

-- ─── 5. Reescrita das políticas de RLS por módulo ──────────────────────────

-- 5.1 — Tabelas de um módulo só
do $$
declare
  t text;
  single_module_tables text[][] := array[
    array['afiacao', '/afiacao'],
    array['aux_afiacao', '/afiacao'],
    array['apontamentos_mao_obra', '/mao-de-obra'],
    array['fichas_mao_obra', '/mao-de-obra'],
    array['mao_obra_apontamentos_catalogo', '/mao-de-obra'],
    array['mao_obra_catalogos', '/mao-de-obra'],
    array['backlog_delete_requests', '/backlog'],
    array['backlog_historico', '/backlog'],
    array['checklist_frota', '/checklist-frota'],
    array['checklists_mecanicos', '/checklist-mecanicos'],
    array['controladoria_frota', '/controladoria-frota'],
    array['controladoria_frota_historico', '/controladoria-frota'],
    array['controle_filtros_implemento', '/controle-filtros'],
    array['docs_civ_cipp', '/documentos'],
    array['docs_crlve_leve', '/documentos'],
    array['docs_crlve_pesados', '/documentos'],
    array['docs_laudo_eletromecanico', '/documentos'],
    array['docs_laudo_implemento', '/documentos'],
    array['docs_tacografo', '/documentos'],
    array['fichas_captacao', '/captacao'],
    array['lancamentos_captacao', '/captacao'],
    array['fichas_lubrificacao', '/lubrificacao'],
    array['insumos_abastecimento_linhas', '/insumos'],
    array['insumos_ficha_historico', '/insumos'],
    array['insumos_ficha_insumos', '/insumos'],
    array['insumos_fichas_abastecimento', '/insumos'],
    array['insumos_fichas_recarga', '/insumos'],
    array['insumos_impedimentos', '/insumos'],
    array['insumos_maquinas_suzano', '/insumos'],
    array['insumos_materiais', '/insumos'],
    array['insumos_modulo_material', '/insumos'],
    array['insumos_modulos', '/insumos'],
    array['insumos_recarga_itens', '/insumos'],
    array['insumos_skid_movimentos', '/insumos'],
    array['insumos_skid_regua_medicoes', '/insumos'],
    array['inspecoes_pneus', '/pneus'],
    array['pneus', '/pneus'],
    array['lavagens', '/lavagens'],
    array['programacao_mecanica_execucoes', '/programacao-mecanica'],
    array['prev_prog_semanal', '/programacao-preventiva']
  ];
begin
  for i in 1 .. array_length(single_module_tables, 1) loop
    t := single_module_tables[i][1];
    perform public._drop_all_policies(t);
    execute format(
      'create policy "%s_module_access" on public.%I for all to authenticated using (public.user_has_module(%L)) with check (public.user_has_module(%L))',
      t, t, single_module_tables[i][2], single_module_tables[i][2]
    );
  end loop;
end $$;

-- 5.2 — catalogo_manutencao: só leitura (nunca teve policy de escrita), agora
-- restrita a quem tem o módulo de OS (reference data usada só lá).
select public._drop_all_policies('catalogo_manutencao');
create policy "catalogo_manutencao_select" on public.catalogo_manutencao
  for select to authenticated using (public.user_has_module('/os'));

-- 5.3 — custos_*: mantém o isolamento por filial já existente, mas agora TAMBÉM
-- exige permissão do módulo (hoje bastava estar na mesma filial, sem checar
-- se a pessoa tinha ou não o módulo "Controle de Custos").
do $$
declare
  t text;
  custos_tables text[] := array['custos_fornecedores', 'custos_historico', 'custos_manutencao', 'custos_parcelas'];
begin
  foreach t in array custos_tables loop
    perform public._drop_all_policies(t);
    execute format(
      'create policy "%s_module_filial_access" on public.%I for all to authenticated using (public.user_has_module(%L) and (public.is_admin_user() or filial_id = public.get_user_filial())) with check (public.user_has_module(%L) and (public.is_admin_user() or filial_id = public.get_user_filial()))',
      t, t, '/custos', '/custos'
    );
  end loop;
end $$;

-- 5.4 — Tabelas usadas por mais de um módulo legítimo: leitura mais ampla
-- (inclui quem só consome em dashboards/indicadores), escrita restrita aos
-- módulos que de fato gravam.
select public._drop_all_policies('backlog');
create policy "backlog_select" on public.backlog
  for select to authenticated
  using (public.user_has_module('/backlog') or public.user_has_module('/os') or public.user_has_module('/checklist-mecanicos') or public.user_has_module('/dashboard') or public.user_has_module('/indicadores'));
create policy "backlog_insert" on public.backlog
  for insert to authenticated
  with check (public.user_has_module('/backlog') or public.user_has_module('/os') or public.user_has_module('/checklist-mecanicos'));
create policy "backlog_update" on public.backlog
  for update to authenticated
  using (public.user_has_module('/backlog') or public.user_has_module('/os') or public.user_has_module('/checklist-mecanicos'))
  with check (public.user_has_module('/backlog') or public.user_has_module('/os') or public.user_has_module('/checklist-mecanicos'));
create policy "backlog_delete" on public.backlog
  for delete to authenticated
  using (public.user_has_module('/backlog') or public.user_has_module('/os') or public.user_has_module('/checklist-mecanicos'));

select public._drop_all_policies('ordens_servico');
create policy "ordens_servico_select" on public.ordens_servico
  for select to authenticated
  using (public.user_has_module('/os') or public.user_has_module('/dashboard') or public.user_has_module('/indicadores'));
create policy "ordens_servico_insert" on public.ordens_servico
  for insert to authenticated with check (public.user_has_module('/os'));
create policy "ordens_servico_update" on public.ordens_servico
  for update to authenticated using (public.user_has_module('/os')) with check (public.user_has_module('/os'));
create policy "ordens_servico_delete" on public.ordens_servico
  for delete to authenticated using (public.user_has_module('/os'));

select public._drop_all_policies('preventivas');
create policy "preventivas_select" on public.preventivas
  for select to authenticated
  using (public.user_has_module('/preventivas') or public.user_has_module('/insumos') or public.user_has_module('/dashboard'));
create policy "preventivas_insert" on public.preventivas
  for insert to authenticated with check (public.user_has_module('/preventivas'));
create policy "preventivas_update" on public.preventivas
  for update to authenticated using (public.user_has_module('/preventivas')) with check (public.user_has_module('/preventivas'));
create policy "preventivas_delete" on public.preventivas
  for delete to authenticated using (public.user_has_module('/preventivas'));

select public._drop_all_policies('historico_horimetros');
create policy "historico_horimetros_select" on public.historico_horimetros
  for select to authenticated
  using (public.user_has_module('/preventivas') or public.user_has_module('/insumos'));
create policy "historico_horimetros_insert" on public.historico_horimetros
  for insert to authenticated with check (public.user_has_module('/preventivas'));

select public._drop_all_policies('escala_frota');
create policy "escala_frota_select" on public.escala_frota
  for select to authenticated
  using (public.user_has_module('/base-frotas') or public.user_has_module('/dashboard') or public.user_has_module('/os'));
create policy "escala_frota_insert" on public.escala_frota
  for insert to authenticated with check (public.user_has_module('/base-frotas'));
create policy "escala_frota_update" on public.escala_frota
  for update to authenticated using (public.user_has_module('/base-frotas')) with check (public.user_has_module('/base-frotas'));
create policy "escala_frota_delete" on public.escala_frota
  for delete to authenticated using (public.user_has_module('/base-frotas'));

-- 5.5 — horimetros: lido pela consulta /horimetro, escrito só por /base-frotas.
select public._drop_all_policies('horimetros');
create policy "horimetros_select" on public.horimetros
  for select to authenticated
  using (public.user_has_module('/horimetro') or public.user_has_module('/base-frotas'));
create policy "horimetros_insert" on public.horimetros
  for insert to authenticated with check (public.user_has_module('/base-frotas'));
create policy "horimetros_update" on public.horimetros
  for update to authenticated using (public.user_has_module('/base-frotas')) with check (public.user_has_module('/base-frotas'));
create policy "horimetros_delete" on public.horimetros
  for delete to authenticated using (public.user_has_module('/base-frotas'));

-- 5.6 — Dados de referência globais: lidos em dropdowns/atribuição por quase
-- todo módulo do sistema (bloquear a leitura quebraria o sistema inteiro) —
-- liberados para qualquer usuário ATIVO, sem exigir módulo específico. Escrita
-- (criar/editar/excluir) continua restrita ao módulo dono.
select public._drop_all_policies('equipamentos');
create policy "equipamentos_select_ativos" on public.equipamentos
  for select to authenticated using (public.user_is_active());
create policy "equipamentos_insert" on public.equipamentos
  for insert to authenticated with check (public.user_has_module('/base-frotas'));
create policy "equipamentos_update" on public.equipamentos
  for update to authenticated using (public.user_has_module('/base-frotas')) with check (public.user_has_module('/base-frotas'));
create policy "equipamentos_delete" on public.equipamentos
  for delete to authenticated using (public.user_has_module('/base-frotas'));

select public._drop_all_policies('colaboradores');
create policy "colaboradores_select_ativos" on public.colaboradores
  for select to authenticated using (public.user_is_active());
create policy "colaboradores_insert" on public.colaboradores
  for insert to authenticated with check (public.user_has_module('/base-frotas'));
create policy "colaboradores_update" on public.colaboradores
  for update to authenticated using (public.user_has_module('/base-frotas')) with check (public.user_has_module('/base-frotas'));
create policy "colaboradores_delete" on public.colaboradores
  for delete to authenticated using (public.user_has_module('/base-frotas'));

select public._drop_all_policies('calendario_suzano');
create policy "calendario_suzano_select_ativos" on public.calendario_suzano
  for select to authenticated using (public.user_is_active());
create policy "calendario_suzano_insert" on public.calendario_suzano
  for insert to authenticated with check (public.user_has_module('/calendario'));
create policy "calendario_suzano_update" on public.calendario_suzano
  for update to authenticated using (public.user_has_module('/calendario')) with check (public.user_has_module('/calendario'));
create policy "calendario_suzano_delete" on public.calendario_suzano
  for delete to authenticated using (public.user_has_module('/calendario'));

-- 5.7 — profiles: leitura (nomes/avatares usados em atribuição em quase todo
-- módulo) exige só estar ativo, não um módulo específico. UPDATE continua
-- "só o próprio perfil" (já existia) — a trava de role/filial agora é o
-- trigger da seção 4, não a policy.
select public._drop_all_policies('profiles');
create policy "profiles_select_ativos" on public.profiles
  for select to authenticated using (public.user_is_active() or auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_admin_all" on public.profiles
  for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());

-- 5.8 — historico_exclusoes: INSERT fica aberto a qualquer usuário ativo (toda
-- exclusão de qualquer módulo grava aqui via lib/audit-log.ts), SELECT exige
-- o módulo "Histórico de Exclusões".
select public._drop_all_policies('historico_exclusoes');
create policy "historico_exclusoes_select" on public.historico_exclusoes
  for select to authenticated using (public.user_has_module('/historico-exclusoes'));
create policy "historico_exclusoes_insert" on public.historico_exclusoes
  for insert to authenticated with check (public.user_is_active());

-- 5.9 — Tabelas órfãs (sem nenhum uso real no código hoje) — travadas para
-- admin apenas. Zero impacto funcional (nada no app as lê/escreve).
do $$
declare
  t text;
  orphan_tables text[] := array['checklist_quinzenal_registros', 'manutencoes', 'programacoes', 'prev_metas_mensais', 'prev_provisionamento', 'prev_semanais'];
begin
  foreach t in array orphan_tables loop
    perform public._drop_all_policies(t);
    execute format(
      'create policy "%s_admin_only" on public.%I for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user())',
      t, t
    );
  end loop;
end $$;

-- ─── 6. Limpeza do helper de migration ─────────────────────────────────────
drop function public._drop_all_policies(text);
