-- 1. Create the escala_frota table
CREATE TABLE IF NOT EXISTS public.escala_frota (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    placa TEXT UNIQUE NOT NULL,
    categoria TEXT,
    modelo TEXT,
    modulo TEXT,
    tipo TEXT,
    carga_horaria NUMERIC NOT NULL, -- Ex: 16, 8, 24
    periodo_inicio TIME NOT NULL, -- Ex: '08:00:00'
    periodo_fim TIME NOT NULL,    -- Ex: '00:00:00'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Populate with data from the image provided
-- NOTE: If a vehicle is not in this list, the system will default to 24h/day.
INSERT INTO public.escala_frota (placa, categoria, modelo, modulo, tipo, carga_horaria, periodo_inicio, periodo_fim)
VALUES
('ROG1I38', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG1I39', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG1I40', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F71', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F72', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F73', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F74', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F75', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F76', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4F78', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4I88', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4I89', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4I90', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROG4I91', 'CAVALO MECÂNICO', 'G 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G41', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G42', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G43', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G45', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G46', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G47', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G48', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G49', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G50', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00'),
('ROD1G51', 'CAVALO MECÂNICO', 'R 540', 'BASE 44', 'MADEIREIRO', 16, '08:00:00', '00:00:00')
ON CONFLICT (placa) DO UPDATE SET
    carga_horaria = EXCLUDED.carga_horaria,
    periodo_inicio = EXCLUDED.periodo_inicio,
    periodo_fim = EXCLUDED.periodo_fim;

-- 3. RLS Policies
ALTER TABLE public.escala_frota ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública para usuários autenticados" ON public.escala_frota
    FOR SELECT USING (auth.role() IS NOT NULL);

CREATE POLICY "Escrita para admin e pcm" ON public.escala_frota
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'pcm')
        )
    );
