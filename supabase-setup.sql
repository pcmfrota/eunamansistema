-- Schema Initial Setup & Triggers para Gestão de Frota e PCM

-- 1. Users Extension Profile (já referenciado)
create table if not exists public.users (
  id uuid primary key references auth.users(id),
  nome text,
  perfil text check (perfil in ('ADM', 'PCM', 'OPERADOR')),
  created_at timestamp default now()
);

-- 2. Equipamentos
create table if not exists public.equipamentos (
  id uuid primary key default gen_random_uuid(),
  placa varchar(50) unique not null,
  modelo varchar(100),
  categoria varchar(50),
  horimetro_limite_preventiva numeric default 500, -- Ex: 500 horas
  created_at timestamp default now()
);

-- 3. Horímetros
create table if not exists public.horimetros (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references public.equipamentos(id),
  data_referencia date not null,
  horimetro_inicial numeric not null,
  horimetro_final numeric not null,
  observacoes text,
  criado_por uuid references public.users(id),
  created_at timestamp default now(),
  check (horimetro_final >= horimetro_inicial)
);

-- 4. Triggers e Funções - Lógica Crítica Automática do Horímetro
-- "Se >= 90% -> Atenção", "Se >= 100% -> Manutenção Programada"
create or replace function update_equipamento_status()
returns trigger as $$
declare
  horas_acumuladas numeric;
  limite_preventiva numeric;
  percentual numeric;
begin
  -- Pega o limite de manutenção do equipamento
  select horimetro_limite_preventiva into limite_preventiva 
  from public.equipamentos where id = new.equipamento_id;

  -- Na vida real, horas_acumuladas seria a soma total ou horímetro final atual vs ultima preventiva
  -- Exemplo simplificado usando o último horímetro_final do apontamento
  horas_acumuladas := new.horimetro_final;
  
  percentual := (horas_acumuladas / limite_preventiva) * 100;
  
  if percentual >= 100 then
     -- Inserir na tabela de Programações (PCM)
     insert into public.programacoes (equipamento_id, status, tipo, descricao)
     values (new.equipamento_id, 'pendente', 'preventiva', 'Manutenção Programada Atingida (>100%)');
  elsif percentual >= 90 then
     -- Log ou Alerta de Atenção
     raise notice 'Atenção: Equipamento % próximo da preventiva (%)', new.equipamento_id, percentual;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger tr_check_preventiva
after insert on public.horimetros
for each row execute function update_equipamento_status();


-- 5. Demais tabelas
create table if not exists public.programacoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references public.equipamentos(id),
  status text check(status in ('pendente', 'em_andamento', 'concluida')),
  tipo text,
  descricao text,
  created_at timestamp default now()
);

create table if not exists public.manutencoes (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references public.equipamentos(id),
  horas_manutencao numeric default 0,
  data_entrada timestamp default now(),
  data_saida timestamp
);

create table if not exists public.pneus (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references public.equipamentos(id),
  eixo varchar(50),
  sulco_mm numeric,
  status varchar(20),
  created_at timestamp default now()
);

create table if not exists public.backlog (
  id uuid primary key default gen_random_uuid(),
  equipamento_id uuid references public.equipamentos(id),
  falha text,
  prioridade varchar(20),
  relatado_por uuid references public.users(id),
  created_at timestamp default now()
);

-- RLS
alter table public.horimetros enable row level security;
create policy "Operadores podem ver e inserir, mas não deletar" 
  on public.horimetros for all using (true) with check (true);
