-- Script para migrar as permissões existentes e substituir o Dashboard antigo ('/') pelo caminho correto ('/dashboard')
UPDATE public.role_permissions 
SET allowed_tabs = array_replace(allowed_tabs, '/', '/dashboard');
