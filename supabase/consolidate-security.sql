-- ─── 1. Consolidação da Tabela de Perfis ───────────────────────────────────
-- Garantir que usamos public.profiles (padrão Supabase/Auth)
DO $$ 
BEGIN
    -- Migrar dados de public.users para public.profiles se public.users existir
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        INSERT INTO public.profiles (id, full_name, role, created_at)
        SELECT id, nome, 
               CASE 
                 WHEN perfil = 'ADM' THEN 'admin'
                 WHEN perfil = 'PCM' THEN 'gestor'
                 WHEN perfil = 'OPERADOR' THEN 'tecnico'
                 ELSE 'visitante'
               END,
               created_at
        FROM public.users
        ON CONFLICT (id) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role;
            
        -- Remover tabela redundante
        DROP TABLE public.users CASCADE;
    END IF;
END $$;

-- ─── 2. Padronização de Roles ──────────────────────────────────────────────
-- Garantir que a constraint de role esteja atualizada
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'gestor', 'tecnico', 'visitante'));

-- ─── 3. Auditoria de RLS (Segurança Blueprint) ──────────────────────────────
-- Ativar RLS em todas as tabelas críticas
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pneus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preventivas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horimetros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backlog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_logs ENABLE ROW LEVEL SECURITY;

-- ─── 4. Políticas de Acesso Global (Exemplo: Admin vê tudo) ────────────────
-- Admin: Acesso total
CREATE POLICY "Admins have full access" ON public.ordens_servico FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
CREATE POLICY "Admins have full access" ON public.equipamentos FOR ALL USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
-- ... (repetir para outras tabelas se necessário, ou usar políticas mais granulares)

-- Gestor/Técnico/Visitante: Ver tudo (Leitura)
CREATE POLICY "Everyone can read" ON public.ordens_servico FOR SELECT USING (true);
CREATE POLICY "Everyone can read" ON public.equipamentos FOR SELECT USING (true);

-- ─── 5. Logs do Sistema ───────────────────────────────────────────────────
-- Garantir que a tabela de logs existe e é segura
CREATE TABLE IF NOT EXISTS public.sistema_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id UUID REFERENCES auth.users(id),
    acao TEXT NOT NULL,
    modulo TEXT NOT NULL,
    detalhes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Somente Admins podem ver logs
CREATE POLICY "Only admins can view logs" ON public.sistema_logs FOR SELECT USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
