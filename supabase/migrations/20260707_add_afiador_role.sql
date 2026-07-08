-- 1. Alterar check constraint na tabela profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador'));

-- 2. Alterar check constraint na tabela role_permissions
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_check;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check 
  CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico', 'afiador'));

-- 3. Inserir permissões padrão para o novo cargo 'afiador'
INSERT INTO public.role_permissions (role, allowed_tabs) VALUES
('afiador', ARRAY['/', '/afiacao'])
ON CONFLICT (role) DO UPDATE SET allowed_tabs = EXCLUDED.allowed_tabs;
