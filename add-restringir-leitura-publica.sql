-- ════════════════════════════════════════════════════════════════════════════
-- ENDURECIMENTO: contas, cargos e permissões só para usuários logados
-- Hoje "profiles", "role_permissions" e "filiais" têm SELECT com USING (true)
-- sem "TO authenticated" — ou seja, qualquer requisição não autenticada na API
-- REST do Supabase (usando só a chave anon, que é pública no bundle do site)
-- consegue ler nome/e-mail/cargo de todo mundo, o mapa de permissões por cargo
-- e a lista de filiais. As escritas nessas 3 tabelas já são restritas a admin
-- (via trigger prevent_self_role_escalation em profiles, e via is_admin_user()
-- em role_permissions/filiais) — este script fecha o lado da LEITURA.
-- ════════════════════════════════════════════════════════════════════════════

-- PROFILES
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles são visíveis para autenticados" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- ROLE_PERMISSIONS
DROP POLICY IF EXISTS "Role permissions are viewable by everyone" ON public.role_permissions;
CREATE POLICY "Role permissions visíveis para autenticados" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- FILIAIS
DROP POLICY IF EXISTS "filiais_select_all" ON public.filiais;
CREATE POLICY "filiais_select_all" ON public.filiais
  FOR SELECT TO authenticated USING (true);
