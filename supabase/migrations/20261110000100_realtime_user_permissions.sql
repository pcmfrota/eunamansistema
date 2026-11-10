-- Habilita Realtime em user_module_permissions e profiles — usado por
-- components/auth-context.tsx para revogar acesso de sessões já abertas na
-- hora quando um admin bloqueia um usuário ou retira um módulo (item 5 do
-- pedido de segurança: sincronização entre computadores).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'user_module_permissions'
  ) then
    alter publication supabase_realtime add table public.user_module_permissions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end $$;
