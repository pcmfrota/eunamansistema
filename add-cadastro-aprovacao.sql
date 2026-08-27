-- Autocadastro de usuários com aprovação do admin.
--
-- O usuário se cadastra sozinho (nome, sobrenome, e-mail, senha, cargo desejado) e a
-- conta já existe no Supabase Auth (login funciona tecnicamente), mas fica travada até
-- um admin aprovar: `status` começa em 'pendente' e o `role` real fica em 'visitante'
-- (o cargo pedido só é gravado em `cargo_solicitado`, nunca aplicado direto). A tela de
-- login verifica `status` e desloga na hora se não estiver aprovado.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aprovado';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_status_check CHECK (status IN ('pendente', 'aprovado', 'rejeitado'));

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo_solicitado TEXT;

-- E-mail denormalizado (só existe em auth.users por padrão) — evita ter que chamar a
-- Admin API só pra listar e-mails na tela de Usuários/Aprovações.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE public.profiles p SET email = au.email
  FROM auth.users au WHERE au.id = p.id AND p.email IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles (status);

-- ── Trava de segurança: só admin (ou o backend via service role) pode mudar role/status/
-- cargo_solicitado/filial_id de um perfil ──
--
-- A policy "Users can update own profile" (USING auth.uid() = id, sem WITH CHECK) permite
-- hoje que QUALQUER usuário logado altere QUALQUER coluna do próprio perfil — inclusive
-- setar role='admin' e status='aprovado' direto pelo console do navegador, pulando a
-- aprovação inteira. Isso sempre foi possível, mas só passa a ser um risco real agora que
-- qualquer pessoa pode criar a própria conta (antes só quem já era admin criava contas).
-- Este gatilho fecha essa brecha: reverte essas colunas pro valor antigo sempre que quem
-- está alterando não é admin. Chamadas via service role (Server Actions administrativas,
-- ex: aprovarUsuario) não passam pelo RLS e não têm auth.uid() — continuam funcionando.
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
    NEW.cargo_solicitado := OLD.cargo_solicitado;
    NEW.filial_id := OLD.filial_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.prevent_self_role_escalation();
