-- Aplicar manualmente no SQL Editor do Supabase.
-- Remove definitivamente o armazenamento de senhas em texto puro.
-- Os dados já foram limpos (setados para NULL); isso apenas remove a coluna.
-- O login continua funcionando normalmente via Supabase Auth (hash), que nunca usou essa coluna.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS plain_password;
