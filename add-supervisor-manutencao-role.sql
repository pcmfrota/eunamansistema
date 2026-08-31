-- Aplicar manualmente no SQL Editor do Supabase
--
-- Novo cargo "Supervisor Manutenção" — mesmo padrão usado quando o cargo "afiador" foi
-- adicionado (supabase/migrations/20260707_add_afiador_role.sql): amplia os CHECK
-- constraints de profiles.role e role_permissions.role, e semeia uma linha inicial de
-- permissões (copiando o conjunto de abas do "mecanico" como ponto de partida — ajuste
-- livremente depois em Gestão de Usuários → Configuração de Acesso por Cargo).

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador', 'supervisor_manutencao'));

ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador', 'supervisor_manutencao'));

INSERT INTO public.role_permissions (role, allowed_tabs) VALUES
('supervisor_manutencao', ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/afiacao', '/checklist-mecanicos', '/mao-de-obra'])
ON CONFLICT (role) DO UPDATE SET allowed_tabs = EXCLUDED.allowed_tabs;
