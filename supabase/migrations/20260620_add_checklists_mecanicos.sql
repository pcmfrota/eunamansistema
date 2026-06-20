-- Migration: Criação das tabelas para o Checklist Mecânicos

CREATE TABLE IF NOT EXISTS public.checklists_mecanicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_caminhao VARCHAR(50) NOT NULL, -- 'Multifuncional', 'Comboio', 'Pipa', 'Munck'
    placa VARCHAR(50) NOT NULL,
    local VARCHAR(100),
    co VARCHAR(100),
    motorista VARCHAR(255),
    matricula VARCHAR(100),
    km NUMERIC,
    turno VARCHAR(50),
    data_checklist DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'Fechado', -- 'Aberto', 'Em Andamento', 'Fechado'
    respostas JSONB NOT NULL, -- Armazena { "1.1": "C", "1.2": "NC", "2.1": "NA" }
    pendencias_adicionais TEXT,
    criado_por UUID REFERENCES public.users(id),
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.checklists_mecanicos ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='checklists_mecanicos' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON public.checklists_mecanicos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
