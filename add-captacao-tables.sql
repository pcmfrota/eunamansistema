-- Criar tabela de Fichas de Captação
CREATE TABLE IF NOT EXISTS public.fichas_captacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano INTEGER NOT NULL,
  mes INTEGER NOT NULL,
  placa TEXT NOT NULL,
  motorista TEXT NOT NULL,
  processo TEXT NOT NULL,
  nucleo TEXT NOT NULL,
  supervisor_suzano TEXT,
  codigo TEXT,
  revisao TEXT,
  status TEXT DEFAULT 'Aberta' CHECK (status IN ('Aberta', 'Fechada')),
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Criar tabela de Lançamentos de Captação
CREATE TABLE IF NOT EXISTS public.lancamentos_captacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ficha_id UUID NOT NULL REFERENCES public.fichas_captacao(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  id_ponto TEXT NOT NULL,
  hora_inicial TEXT NOT NULL,
  hora_final TEXT NOT NULL,
  volume_captado NUMERIC NOT NULL,
  fazenda_captada TEXT NOT NULL,
  up_captacao TEXT NOT NULL,
  atividade TEXT NOT NULL,
  fazenda_atividade TEXT NOT NULL,
  up_atividade TEXT NOT NULL,
  foto_ponto TEXT, -- Base64 string do ponto captado
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS e Criar políticas
ALTER TABLE public.fichas_captacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos_captacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.fichas_captacao;
CREATE POLICY "Permitir acesso total temporário" ON public.fichas_captacao FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.lancamentos_captacao;
CREATE POLICY "Permitir acesso total temporário" ON public.lancamentos_captacao FOR ALL USING (true) WITH CHECK (true);

-- Atualiza permissões das abas existentes para incluir /captacao para os cargos relevantes
UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao', '/admin/usuarios']
WHERE role = 'admin';

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/base-frotas', '/base-dados', '/calendario', '/lavagens', '/captacao']
WHERE role IN ('pcm', 'gestao');

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/os', '/preventivas', '/pneus', '/backlog', '/programacao-preventiva', '/calendario', '/captacao']
WHERE role = 'mecanico';

UPDATE public.role_permissions 
SET allowed_tabs = ARRAY['/', '/pneus', '/calendario', '/lavagens', '/captacao']
WHERE role = 'motorista';
