-- Campos do novo layout do Checklist Comboio (igual ao protótipo testado em campo pelo
-- usuário) — mantém as colunas antigas (mes, turno, motorista, etc.) sem uso, por
-- simplicidade/segurança, em vez de remover uma tabela recém-criada.
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS frota text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS horimetro numeric;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS registradora_diesel numeric;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS registradora_insumo numeric;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS saldo_tanque numeric;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS local text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS hora text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS mecanico text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS matricula_mecanico text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS responsavel_recebe text;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS fotos_gerais jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS avarias jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS assinaturas jsonb DEFAULT '{}'::jsonb NOT NULL;
ALTER TABLE public.checklist_comboio ADD COLUMN IF NOT EXISTS observacoes_gerais text;
