-- Criar bucket de avatares se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Remover políticas existentes se houver (para evitar conflito ao rodar novamente)
DROP POLICY IF EXISTS "Permitir leitura pública de avatares" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de avatares para usuários autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização de avatares para usuários autenticados" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusão de avatares para usuários autenticados" ON storage.objects;

-- Criar políticas de segurança RLS para o bucket 'avatars'
CREATE POLICY "Permitir leitura pública de avatares"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Permitir upload de avatares para usuários autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Permitir atualização de avatares para usuários autenticados"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Permitir exclusão de avatares para usuários autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
