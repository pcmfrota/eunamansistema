-- Aplicar manualmente no SQL Editor do Supabase
--
-- Novo cargo "Financeiro" — mesmo padrão usado pros cargos anteriores (ver
-- add-supervisor-manutencao-role.sql / supabase/migrations/20260707_add_afiador_role.sql):
-- amplia os CHECK constraints de profiles.role e role_permissions.role, e semeia uma linha
-- inicial de permissões enxuta (Dashboard + Controle de Custos — o resto pode ser liberado
-- depois em Gestão de Usuários → Configuração de Acesso por Cargo).

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'pcm', 'gestao', 'financeiro', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador', 'supervisor_manutencao'));

ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('admin', 'pcm', 'gestao', 'financeiro', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador', 'supervisor_manutencao'));

INSERT INTO public.role_permissions (role, allowed_tabs) VALUES
('financeiro', ARRAY['/', '/custos'])
ON CONFLICT (role) DO UPDATE SET allowed_tabs = EXCLUDED.allowed_tabs;

NOTIFY pgrst, 'reload schema';
