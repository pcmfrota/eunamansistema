CREATE TABLE public.checklist_comboio (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_checklist text NOT NULL CHECK (tipo_checklist IN ('RECEBIMENTO', 'DEVOLUCAO')),
  empresa text,
  placa text NOT NULL,
  nucleo text,
  mes text,
  turno text,
  marca_modelo text,
  motorista text,
  matricula_motorista text,
  km numeric,
  data_checklist date NOT NULL,
  respostas jsonb DEFAULT '{}'::jsonb NOT NULL,
  fotos jsonb DEFAULT '{}'::jsonb NOT NULL,
  pendencias_adicionais text,
  executante_nome text,
  executante_mt text,
  supervisor_nome text,
  supervisor_mt text,
  status text DEFAULT 'Fechado' NOT NULL,
  criado_por uuid,
  criado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.checklist_comboio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filial_isolation_checklist_comboio" ON public.checklist_comboio
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

CREATE INDEX idx_checklist_comboio_filial ON public.checklist_comboio(filial_id);
CREATE INDEX idx_checklist_comboio_placa ON public.checklist_comboio(placa);
CREATE INDEX idx_checklist_comboio_data ON public.checklist_comboio(data_checklist DESC);
