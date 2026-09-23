-- Cadastro de Fornecedores do Controle Financeiro (rota /custos, aba "Fornecedores")
-- Rodar manualmente no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS public.custos_fornecedores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_fantasia text NOT NULL,
  razao_social text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (filial_id, nome_fantasia)
);

ALTER TABLE public.custos_fornecedores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custos_fornecedores' AND policyname = 'filial_isolation_custos_fornecedores') THEN
    CREATE POLICY "filial_isolation_custos_fornecedores" ON public.custos_fornecedores
      FOR ALL TO authenticated
      USING (public.is_admin_user() OR filial_id = public.get_user_filial());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custos_fornecedores_filial ON public.custos_fornecedores(filial_id);

-- Semeia o cadastro com os fornecedores que já aparecem nos lançamentos de Agosto/Setembro
-- importados, pra não começar a lista vazia (nome_fantasia = valor já usado em custos_manutencao;
-- razao_social fica em branco pra o usuário completar depois).
INSERT INTO public.custos_fornecedores (nome_fantasia, filial_id)
SELECT DISTINCT fornecedor, filial_id
FROM public.custos_manutencao
WHERE fornecedor IS NOT NULL AND fornecedor <> ''
ON CONFLICT (filial_id, nome_fantasia) DO NOTHING;

NOTIFY pgrst, 'reload schema';
