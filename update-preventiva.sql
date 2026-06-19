-- ================================================================
-- UPDATE: Adicionar campos para refatoração de Programação Preventiva
-- ================================================================

-- 1. Adicionar colunas caso não existam
ALTER TABLE public.prev_prog_semanal 
  ADD COLUMN IF NOT EXISTS horimetro_dia TEXT,
  ADD COLUMN IF NOT EXISTS filial_id TEXT DEFAULT 'MATRIZ';

-- 2. Atualizar todos os registros existentes para MATRIZ (caso filial_id esteja nulo)
UPDATE public.prev_prog_semanal 
SET filial_id = 'MATRIZ' 
WHERE filial_id IS NULL;

-- 3. Remover default e tornar NOT NULL para futuros registros
ALTER TABLE public.prev_prog_semanal 
  ALTER COLUMN filial_id DROP DEFAULT,
  ALTER COLUMN filial_id SET NOT NULL;

-- 4. Recriar RLS Policy para aplicar o filtro de Filial
DROP POLICY IF EXISTS "auth_all" ON public.prev_prog_semanal;
DROP POLICY IF EXISTS "filial_isolation_prev_prog_semanal" ON public.prev_prog_semanal;

CREATE POLICY "filial_isolation_prev_prog_semanal" ON public.prev_prog_semanal
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

-- 5. Criar índice de performance para filial
CREATE INDEX IF NOT EXISTS idx_prev_prog_semanal_filial ON public.prev_prog_semanal(filial_id);
