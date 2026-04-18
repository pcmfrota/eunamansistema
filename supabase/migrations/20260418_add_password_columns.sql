-- Migration: Add plain_password to profiles and users tables
-- Date: 2026-04-18

-- Adicionar na tabela de perfis principal
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plain_password TEXT;

-- Adicionar na tabela legado (PCM)
-- Se a tabela 'users' não existir (pois alguns scripts usam 'profiles'), este comando falhará silenciosamente ou pode ser ignorado
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS senha TEXT;
    END IF;
END $$;
