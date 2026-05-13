-- Tabela para gerenciar quais abas cada cargo pode acessar
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT PRIMARY KEY CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante')),
  allowed_tabs TEXT[] DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilita RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Permite que qualquer usuário autenticado leia as permissões
CREATE POLICY "Role permissions are viewable by everyone" ON public.role_permissions
  FOR SELECT USING (true);

-- Apenas admins podem alterar as permissões
CREATE POLICY "Only admins can update role permissions" ON public.role_permissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Inicializa as permissões padrão
INSERT INTO public.role_permissions (role, allowed_tabs) VALUES
('admin', ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/admin/usuarios']),
('pcm', ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens']),
('gestao', ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens']),
('visitante', ARRAY['/', '/preventivas', '/backlog'])
ON CONFLICT (role) DO UPDATE SET allowed_tabs = EXCLUDED.allowed_tabs;
