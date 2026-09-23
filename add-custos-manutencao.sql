-- Módulo "Controle de Custos" (Controle Financeiro de Manutenção) — rota /custos
-- Rodar manualmente no SQL Editor do Supabase (mesmo padrão dos demais add-*.sql deste repo).

CREATE TABLE IF NOT EXISTS public.custos_manutencao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data date NOT NULL,
  placa text NOT NULL,
  tipo_manutencao text NOT NULL DEFAULT 'CORRETIVA'
    CHECK (tipo_manutencao IN ('CORRETIVA', 'PREVENTIVA', 'PREDITIVA')),
  descricao text NOT NULL,
  fornecedor text,
  pecas numeric NOT NULL DEFAULT 0,
  mao_obra numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'AG_PAGAMENTO'
    CHECK (status IN ('PAGO', 'AG_PAGAMENTO', 'FATURADO')),
  observacoes text,
  anexo_url text,
  registrado_por uuid,
  registrado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custos_manutencao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'custos_manutencao' AND policyname = 'filial_isolation_custos_manutencao') THEN
    CREATE POLICY "filial_isolation_custos_manutencao" ON public.custos_manutencao
      FOR ALL TO authenticated
      USING (public.is_admin_user() OR filial_id = public.get_user_filial());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_custos_manutencao_filial ON public.custos_manutencao(filial_id);
CREATE INDEX IF NOT EXISTS idx_custos_manutencao_placa ON public.custos_manutencao(placa);
CREATE INDEX IF NOT EXISTS idx_custos_manutencao_data ON public.custos_manutencao(data);

-- Bucket de Storage pros comprovantes (nota fiscal / O.S. anexada ao lançamento)
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovantes-financeiro', 'comprovantes-financeiro', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'comprovantes_financeiro_read') THEN
    CREATE POLICY "comprovantes_financeiro_read" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'comprovantes-financeiro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'comprovantes_financeiro_write') THEN
    CREATE POLICY "comprovantes_financeiro_write" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovantes-financeiro');
  END IF;
END $$;

-- Libera a nova aba só pro admin por enquanto (mesmo padrão de outras aberturas de módulo);
-- outros cargos podem ser liberados depois pela tela de permissões existente.
-- Usa array_append (não SET allowed_tabs = ARRAY[...]) de propósito, pra não apagar
-- as permissões de outros módulos já concedidas em migrations anteriores.
UPDATE public.role_permissions
SET allowed_tabs = array_append(allowed_tabs, '/custos')
WHERE role = 'admin' AND NOT ('/custos' = ANY(allowed_tabs));

-- Força o PostgREST a recarregar o cache de schema imediatamente (sem isso, a API às vezes
-- só "enxerga" a tabela nova depois de alguns segundos/minutos, e as chamadas do app
-- retornam "Could not find the table 'public.custos_manutencao' in the schema cache").
NOTIFY pgrst, 'reload schema';
