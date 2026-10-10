-- Bucket pra foto/NF opcional anexada numa Entrada no Skid (reabastecimento vindo do
-- almoxarifado/fornecedor) — mesmo padrão dos outros buckets deste módulo.
INSERT INTO storage.buckets (id, name, public)
VALUES ('insumos-fotos-entradas', 'insumos-fotos-entradas', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'insumos_fotos_entradas_read') THEN
    CREATE POLICY "insumos_fotos_entradas_read" ON storage.objects
      FOR SELECT TO authenticated USING (bucket_id = 'insumos-fotos-entradas');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'insumos_fotos_entradas_write') THEN
    CREATE POLICY "insumos_fotos_entradas_write" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'insumos-fotos-entradas');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
