-- Controle de Baterias: cadastro de baterias da frota com garantia e certificado anexado.
-- Acesso: módulo '/controle-baterias' (user_module_permissions) + isolamento por filial,
-- mesmo padrão das tabelas de custos (migration 20261110000000_user_module_permissions.sql).

CREATE TABLE IF NOT EXISTS public.controle_baterias (
  -- id gerado no cliente (crypto.randomUUID) pra o reenvio da fila offline nunca duplicar.
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  modelo text NOT NULL CHECK (btrim(modelo) <> ''),
  numero_serie text NOT NULL CHECK (btrim(numero_serie) <> ''),
  fornecedor text NOT NULL CHECK (btrim(fornecedor) <> ''),
  data_venda date NOT NULL,
  data_vencimento_garantia date NOT NULL,
  -- Período de garantia (venda → vencimento), calculado pelo banco; nunca editável.
  garantia_dias integer GENERATED ALWAYS AS (data_vencimento_garantia - data_venda) STORED,
  -- Certificado no bucket privado 'baterias-certificados' (caminho do objeto, não URL pública).
  certificado_path text,
  certificado_nome text,
  certificado_tipo text,
  observacoes text,
  criado_por uuid REFERENCES auth.users(id),
  criado_por_nome text,
  atualizado_por uuid REFERENCES auth.users(id),
  atualizado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT controle_baterias_vencimento_apos_venda CHECK (data_vencimento_garantia > data_venda)
);

-- Número de série único (ignora maiúsculas/minúsculas e espaços nas pontas).
CREATE UNIQUE INDEX IF NOT EXISTS controle_baterias_numero_serie_unico
  ON public.controle_baterias (upper(btrim(numero_serie)));
CREATE INDEX IF NOT EXISTS idx_controle_baterias_filial ON public.controle_baterias (filial_id);
CREATE INDEX IF NOT EXISTS idx_controle_baterias_vencimento ON public.controle_baterias (data_vencimento_garantia);

ALTER TABLE public.controle_baterias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "controle_baterias_module_filial_access" ON public.controle_baterias;
CREATE POLICY "controle_baterias_module_filial_access" ON public.controle_baterias
  FOR ALL TO authenticated
  USING (public.user_has_module('/controle-baterias') AND (public.is_admin_user() OR filial_id = public.get_user_filial()))
  WITH CHECK (public.user_has_module('/controle-baterias') AND (public.is_admin_user() OR filial_id = public.get_user_filial()));

-- Bucket PRIVADO: certificados só abrem por URL assinada (expira), nunca por link público.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('baterias-certificados', 'baterias-certificados', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "baterias_certificados_select" ON storage.objects;
DROP POLICY IF EXISTS "baterias_certificados_insert" ON storage.objects;
DROP POLICY IF EXISTS "baterias_certificados_update" ON storage.objects;
DROP POLICY IF EXISTS "baterias_certificados_delete" ON storage.objects;
CREATE POLICY "baterias_certificados_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'baterias-certificados' AND public.user_has_module('/controle-baterias'));
CREATE POLICY "baterias_certificados_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'baterias-certificados' AND public.user_has_module('/controle-baterias'));
CREATE POLICY "baterias_certificados_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'baterias-certificados' AND public.user_has_module('/controle-baterias'));
CREATE POLICY "baterias_certificados_delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'baterias-certificados' AND public.user_has_module('/controle-baterias'));

NOTIFY pgrst, 'reload schema';
