-- Criação das tabelas de CRLVE
CREATE TABLE IF NOT EXISTS docs_crlve_pesados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filial_id TEXT DEFAULT 'MATRIZ',
  local TEXT NOT NULL,
  co TEXT NOT NULL,
  placa TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  ano TEXT,
  observacoes TEXT,
  anexo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS docs_crlve_leve (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filial_id TEXT DEFAULT 'MATRIZ',
  local TEXT NOT NULL,
  co TEXT NOT NULL,
  placa TEXT NOT NULL,
  data_vencimento DATE NOT NULL,
  ano TEXT,
  observacoes TEXT,
  anexo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar coluna de anexo nas tabelas existentes
ALTER TABLE docs_tacografo ADD COLUMN IF NOT EXISTS anexo_url TEXT;
ALTER TABLE docs_civ_cipp ADD COLUMN IF NOT EXISTS anexo_url TEXT;
ALTER TABLE docs_laudo_eletromecanico ADD COLUMN IF NOT EXISTS anexo_url TEXT;
ALTER TABLE docs_laudo_implemento ADD COLUMN IF NOT EXISTS anexo_url TEXT;

-- Criação do Bucket de Storage para Documentos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', true) 
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage (público para ler, inserir, atualizar)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'documentos');

CREATE POLICY "Public Insert" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Public Update" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'documentos');

CREATE POLICY "Public Delete" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'documentos');
