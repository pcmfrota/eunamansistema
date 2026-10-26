CREATE TABLE public.controle_filtros_implemento (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  placa text NOT NULL,
  tipo_equipamento text,
  data_troca date NOT NULL,
  evidencias jsonb DEFAULT '[]'::jsonb NOT NULL,
  observacoes text,
  criado_por uuid,
  criado_por_nome text,
  filial_id text NOT NULL DEFAULT 'MATRIZ',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.controle_filtros_implemento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "filial_isolation_controle_filtros_implemento" ON public.controle_filtros_implemento
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_user() OR filial_id = public.get_user_filial()
  );

CREATE INDEX idx_controle_filtros_implemento_filial ON public.controle_filtros_implemento(filial_id);
CREATE INDEX idx_controle_filtros_implemento_placa ON public.controle_filtros_implemento(placa);
CREATE INDEX idx_controle_filtros_implemento_data ON public.controle_filtros_implemento(data_troca DESC);
