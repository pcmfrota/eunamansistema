-- Tabela para gerenciar quais abas cada cargo pode acessar
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role TEXT PRIMARY KEY CHECK (role IN ('admin', 'pcm', 'gestao', 'visitante', 'mecanico', 'motorista', 'gestor', 'tecnico')),
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
('admin', ARRAY['/', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos', '/admin/usuarios']),
('pcm', ARRAY['/', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos']),
('gestao', ARRAY['/', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/documentos', '/checklist-mecanicos']),
('visitante', ARRAY['/', '/preventivas', '/backlog', '/calendario', '/documentos']),
('mecanico', ARRAY['/', '/os', '/preventivas', '/pneus', '/afiacao', '/backlog', '/programacao-preventiva', '/calendario', '/captacao', '/documentos', '/checklist-mecanicos']),
('motorista', ARRAY['/', '/pneus', '/calendario', '/lavagens', '/captacao', '/documentos'])
ON CONFLICT (role) DO UPDATE SET allowed_tabs = EXCLUDED.allowed_tabs;
