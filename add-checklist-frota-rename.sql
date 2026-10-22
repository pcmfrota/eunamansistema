-- Generaliza o Checklist Comboio pra cobrir todas as frotas (Comboio, Pipa,
-- Multifuncional, Munck) — renomeia a tabela e adiciona frota/resultado.
ALTER TABLE public.checklist_comboio RENAME TO checklist_frota;
ALTER TABLE public.checklist_frota ADD COLUMN IF NOT EXISTS frota_tipo text NOT NULL DEFAULT 'comboio';
ALTER TABLE public.checklist_frota ADD COLUMN IF NOT EXISTS resultado text;

ALTER INDEX IF EXISTS idx_checklist_comboio_filial RENAME TO idx_checklist_frota_filial;
ALTER INDEX IF EXISTS idx_checklist_comboio_placa RENAME TO idx_checklist_frota_placa;
ALTER INDEX IF EXISTS idx_checklist_comboio_data RENAME TO idx_checklist_frota_data;

DROP POLICY IF EXISTS "filial_isolation_checklist_comboio" ON public.checklist_frota;
CREATE POLICY "filial_isolation_checklist_frota" ON public.checklist_frota
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );
