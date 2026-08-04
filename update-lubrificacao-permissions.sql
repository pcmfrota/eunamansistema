-- Script SQL para atualizar permissões do Módulo de Lubrificação no Supabase

UPDATE public.role_permissions 
SET allowed_tabs = array_append(allowed_tabs, '/lubrificacao')
WHERE role IN ('admin', 'pcm', 'gestao', 'mecanico', 'tecnico', 'gestor')
  AND NOT ('/lubrificacao' = ANY(allowed_tabs));
