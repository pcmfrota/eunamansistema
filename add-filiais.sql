-- ════════════════════════════════════════════════════════════════════════════
-- MIGRAÇÃO MULTI-FILIAIS — PCM EUNAMAN
-- Execute este script UMA VEZ no Supabase SQL Editor
-- Todos os dados existentes serão vinculados à MATRIZ automaticamente
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabela de Filiais ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.filiais (
  id   TEXT PRIMARY KEY,          -- 'MATRIZ', 'ACAILANDIA', 'DOM_ELISEU', 'IMPERATRIZ'
  nome TEXT NOT NULL,             -- Nome exibido na UI
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilita RLS na tabela de filiais (qualquer autenticado pode ler)
ALTER TABLE public.filiais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filiais_select_all" ON public.filiais;
CREATE POLICY "filiais_select_all" ON public.filiais
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "filiais_admin_only" ON public.filiais;
CREATE POLICY "filiais_admin_only" ON public.filiais
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ── 2. Inserir as Filiais ────────────────────────────────────────────
INSERT INTO public.filiais (id, nome) VALUES
  ('MATRIZ',          'Matriz'),
  ('MALUT_SERVICOS',  'Filial Malut/serviços'),
  ('MALUT_LOCALIZA',  'Filial Malut/localiza'),
  ('MALUT_PNEUS',     'Filial Malut Pneus')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome;

-- ── 3. Adicionar filial_id em todas as tabelas operacionais ──────────────────
-- DEFAULT 'MATRIZ' garante migração automática de todos os dados históricos
ALTER TABLE public.equipamentos    ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.horimetros      ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.ordens_servico  ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.backlog         ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.pneus           ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.fichas_captacao ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
ALTER TABLE public.programacoes    ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);

-- Tabelas extras (descomente conforme existirem no seu banco)
-- ALTER TABLE public.lavagens       ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
-- ALTER TABLE public.calibragem     ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
-- ALTER TABLE public.lubrificacao   ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
-- ALTER TABLE public.checklist      ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);
-- ALTER TABLE public.disponibilidade ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);

-- ── 4. Adicionar filial_id na tabela de perfis (filial do usuário) ────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ' REFERENCES public.filiais(id);

-- ── 5. Migrar dados existentes (garantia de NOT NULL) ────────────────────────
UPDATE public.equipamentos    SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.horimetros      SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.ordens_servico  SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.backlog         SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.pneus           SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.fichas_captacao SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.programacoes    SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;
UPDATE public.profiles        SET filial_id = 'MATRIZ' WHERE filial_id IS NULL;

-- ── 6. Funções helper para RLS ────────────────────────────────────────────────
-- Retorna a filial_id do usuário logado (usa SECURITY DEFINER para acesso seguro)
CREATE OR REPLACE FUNCTION public.get_user_filial()
RETURNS TEXT AS $$
  SELECT COALESCE(filial_id, 'MATRIZ') 
  FROM public.profiles 
  WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Retorna TRUE se o usuário logado é admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ── 7. Políticas RLS de Isolamento por Filial ─────────────────────────────────

-- EQUIPAMENTOS
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filial_isolation_equipamentos" ON public.equipamentos;
CREATE POLICY "filial_isolation_equipamentos" ON public.equipamentos
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- HORIMETROS
ALTER TABLE public.horimetros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Operadores podem ver e inserir, mas não deletar" ON public.horimetros;
DROP POLICY IF EXISTS "filial_isolation_horimetros" ON public.horimetros;
CREATE POLICY "filial_isolation_horimetros" ON public.horimetros
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- ORDENS DE SERVIÇO
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filial_isolation_os" ON public.ordens_servico;
CREATE POLICY "filial_isolation_os" ON public.ordens_servico
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- BACKLOG
ALTER TABLE public.backlog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filial_isolation_backlog" ON public.backlog;
CREATE POLICY "filial_isolation_backlog" ON public.backlog
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- PNEUS
ALTER TABLE public.pneus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filial_isolation_pneus" ON public.pneus;
CREATE POLICY "filial_isolation_pneus" ON public.pneus
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- FICHAS CAPTAÇÃO
ALTER TABLE public.fichas_captacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.fichas_captacao;
DROP POLICY IF EXISTS "filial_isolation_captacao" ON public.fichas_captacao;
CREATE POLICY "filial_isolation_captacao" ON public.fichas_captacao
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- LANCAMENTOS CAPTAÇÃO (herda via ficha)
ALTER TABLE public.lancamentos_captacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir acesso total temporário" ON public.lancamentos_captacao;
DROP POLICY IF EXISTS "filial_isolation_lancamentos_captacao" ON public.lancamentos_captacao;
CREATE POLICY "filial_isolation_lancamentos_captacao" ON public.lancamentos_captacao
  FOR ALL USING (
    public.is_admin_user() OR EXISTS (
      SELECT 1 FROM public.fichas_captacao fc 
      WHERE fc.id = ficha_id 
        AND (fc.filial_id = public.get_user_filial())
    )
  )
  WITH CHECK (
    public.is_admin_user() OR EXISTS (
      SELECT 1 FROM public.fichas_captacao fc 
      WHERE fc.id = ficha_id 
        AND (fc.filial_id = public.get_user_filial())
    )
  );

-- PROGRAMAÇÕES
ALTER TABLE public.programacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "filial_isolation_programacoes" ON public.programacoes;
CREATE POLICY "filial_isolation_programacoes" ON public.programacoes
  FOR ALL USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  )
  WITH CHECK (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- ── 8. Índices de Performance ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_equipamentos_filial    ON public.equipamentos(filial_id);
CREATE INDEX IF NOT EXISTS idx_horimetros_filial      ON public.horimetros(filial_id);
CREATE INDEX IF NOT EXISTS idx_ordens_servico_filial  ON public.ordens_servico(filial_id);
CREATE INDEX IF NOT EXISTS idx_backlog_filial         ON public.backlog(filial_id);
CREATE INDEX IF NOT EXISTS idx_pneus_filial           ON public.pneus(filial_id);
CREATE INDEX IF NOT EXISTS idx_fichas_captacao_filial ON public.fichas_captacao(filial_id);
CREATE INDEX IF NOT EXISTS idx_profiles_filial        ON public.profiles(filial_id);

-- ── VERIFICAÇÃO FINAL ─────────────────────────────────────────────────────────
-- Execute para confirmar que a migração funcionou:
-- SELECT 'filiais' as tabela, COUNT(*) FROM public.filiais
-- UNION ALL SELECT 'equipamentos s/ filial', COUNT(*) FROM public.equipamentos WHERE filial_id IS NULL
-- UNION ALL SELECT 'ordens_servico s/ filial', COUNT(*) FROM public.ordens_servico WHERE filial_id IS NULL
-- UNION ALL SELECT 'profiles s/ filial', COUNT(*) FROM public.profiles WHERE filial_id IS NULL;
