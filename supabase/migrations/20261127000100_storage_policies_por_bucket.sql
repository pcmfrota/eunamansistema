-- Segurança do Storage: remove as regras que liberavam TODOS os buckets pra qualquer um
-- (inclusive sem login) e deixa cada bucket só com o que o código usa, pra usuário logado.
--
-- Antes:
--   "Acesso Total Lavagens 1c18l4z_0..3" → SELECT/INSERT/UPDATE/DELETE com `true` pra anon e
--   authenticated, em qualquer bucket (o bucket lavagens nem é usado pelo código);
--   documentos → "Public Insert/Update/Delete/Access" pro papel public (inclui anon).
--
-- Leitura das imagens/arquivos pelos links públicos (getPublicUrl) não depende destas
-- regras — buckets public=true continuam servindo os arquivos pela URL pública.

-- 1. Regra global aberta
DROP POLICY IF EXISTS "Acesso Total Lavagens 1c18l4z_0" ON storage.objects;
DROP POLICY IF EXISTS "Acesso Total Lavagens 1c18l4z_1" ON storage.objects;
DROP POLICY IF EXISTS "Acesso Total Lavagens 1c18l4z_2" ON storage.objects;
DROP POLICY IF EXISTS "Acesso Total Lavagens 1c18l4z_3" ON storage.objects;

-- 2. documentos: só usuário logado envia/altera/apaga (Documentos da Frota e Controladoria)
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert" ON storage.objects;
DROP POLICY IF EXISTS "Public Update" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete" ON storage.objects;
DROP POLICY IF EXISTS "documentos_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_delete" ON storage.objects;
CREATE POLICY "documentos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "documentos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
CREATE POLICY "documentos_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos');
CREATE POLICY "documentos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos');

-- 3. insumos-fotos-maquinas: a fila offline (lib/offline-media.ts) envia com upsert,
--    que precisa de UPDATE além do INSERT/SELECT que já existiam.
DROP POLICY IF EXISTS "insumos_fotos_maquinas_update" ON storage.objects;
CREATE POLICY "insumos_fotos_maquinas_update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'insumos-fotos-maquinas');

NOTIFY pgrst, 'reload schema';
