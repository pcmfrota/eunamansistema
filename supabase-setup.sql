-- Schema Initial Setup & Triggers para Gestão de Frota e PCM

-- 1. Equipamentos
CREATE TABLE IF NOT EXISTS public.equipamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa VARCHAR(50) UNIQUE NOT NULL,
    modelo VARCHAR(100),
    categoria VARCHAR(50),
    modulo VARCHAR(50) DEFAULT 'BASE',
    horimetro_limite_preventiva NUMERIC DEFAULT 500,
    ultimoHist NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Horímetros
CREATE TABLE IF NOT EXISTS public.horimetros (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    horimetro_inicial NUMERIC NOT NULL,
    horimetro_final NUMERIC NOT NULL,
    observacoes TEXT,
    criado_por UUID REFERENCES auth.users(id), -- Referência direta ao Auth
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (horimetro_final >= horimetro_inicial)
);

-- 3. Programações (PCM)
CREATE TABLE IF NOT EXISTS public.programacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    status TEXT CHECK(status IN ('pendente', 'em_andamento', 'concluida')),
    tipo TEXT,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Ordens de Serviço (Tabela Principal)
CREATE TABLE IF NOT EXISTS public.ordens_servico (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_os TEXT UNIQUE NOT NULL,
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    placa TEXT NOT NULL,
    modulo TEXT,
    status TEXT DEFAULT 'Aberta',
    data_abertura TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    data_fechamento TIMESTAMP WITH TIME ZONE,
    horimetro NUMERIC,
    operacao_tipo TEXT,
    local TEXT,
    classe TEXT DEFAULT 'CORRETIVA',
    foi_enviado_reserva BOOLEAN DEFAULT FALSE,
    descricao TEXT,
    motivo TEXT,
    sistema TEXT,
    sub_sistema TEXT,
    horas_manutencao NUMERIC,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Backlog
CREATE TABLE IF NOT EXISTS public.backlog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    falha TEXT,
    prioridade VARCHAR(20),
    relatado_por UUID REFERENCES auth.users(id), -- Referência direta ao Auth
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Pneus
CREATE TABLE IF NOT EXISTS public.pneus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE,
    eixo VARCHAR(50),
    sulco_mm NUMERIC,
    status VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Triggers e Funções - Lógica Crítica Automática
CREATE OR REPLACE FUNCTION public.update_equipamento_status()
RETURNS TRIGGER AS $$
DECLARE
    horas_acumuladas NUMERIC;
    limite_preventiva NUMERIC;
    percentual NUMERIC;
BEGIN
    SELECT horimetro_limite_preventiva INTO limite_preventiva 
    FROM public.equipamentos WHERE id = NEW.equipamento_id;

    horas_acumuladas := NEW.horimetro_final;
    
    IF limite_preventiva > 0 THEN
        percentual := (horas_acumuladas / limite_preventiva) * 100;
        
        IF percentual >= 100 THEN
            INSERT INTO public.programacoes (equipamento_id, status, tipo, descricao)
            VALUES (NEW.equipamento_id, 'pendente', 'preventiva', 'Manutenção Programada Atingida (>100%)')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;

    -- Atualiza o último horímetro no equipamento
    UPDATE public.equipamentos 
    SET ultimoHist = NEW.horimetro_final 
    WHERE id = NEW.equipamento_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Garantir que o trigger seja recriado sem erros
DROP TRIGGER IF EXISTS tr_check_preventiva ON public.horimetros;
CREATE TRIGGER tr_check_preventiva
AFTER INSERT ON public.horimetros
FOR EACH ROW EXECUTE FUNCTION public.update_equipamento_status();

-- 8. RLS Básico (Será refinado pelo consolidate-security.sql)
ALTER TABLE public.horimetros ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Operadores podem ver e inserir, mas não deletar" ON public.horimetros;
CREATE POLICY "Operadores podem ver e inserir, mas não deletar" 
ON public.horimetros FOR ALL USING (true) WITH CHECK (true);
