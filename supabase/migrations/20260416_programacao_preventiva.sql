-- ================================================================
-- PROGRAMAÇÃO PREVENTIVA — Migração completa
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- 1. METAS MENSAIS (% mensal: META vs REALIZADO)
CREATE TABLE IF NOT EXISTS prev_metas_mensais (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano        INTEGER NOT NULL,
  mes        INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  meta       NUMERIC(5,2) NOT NULL DEFAULT 100,
  realizado  NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ano, mes)
);

-- 2. METAS SEMANAIS (% semanal: META vs REALIZADO por semana do mês)
CREATE TABLE IF NOT EXISTS prev_semanais (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano             INTEGER NOT NULL,
  mes_operacional TEXT NOT NULL,
  mes_numero      INTEGER NOT NULL,
  semana_numero   INTEGER NOT NULL CHECK (semana_numero BETWEEN 1 AND 5),
  semana_label    TEXT NOT NULL,
  data_inicio     DATE,
  data_fim        DATE,
  meta            NUMERIC(5,2) NOT NULL DEFAULT 25,
  realizado       NUMERIC(5,2),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PROVISIONAMENTO DE PREVENTIVAS (lista de veículos programados por mês)
CREATE TABLE IF NOT EXISTS prev_provisionamento (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano                   INTEGER NOT NULL,
  mes_operacional       TEXT NOT NULL,
  mes_numero            INTEGER NOT NULL,
  categoria_operacional TEXT NOT NULL,
  placa                 TEXT,
  mpbt                  TEXT,
  status                TEXT NOT NULL DEFAULT 'EM ANDAMENTO',
  data_inicial          DATE,
  data_final            DATE,
  observacoes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PROGRAMAÇÃO SEMANAL — Itens detalhados por semana (planilha S01-S29)
CREATE TABLE IF NOT EXISTS prev_prog_semanal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ano                   INTEGER NOT NULL,
  mes_numero            INTEGER NOT NULL,
  semana_numero         INTEGER NOT NULL,  -- 1=S1, 2=S2...
  semana_global         INTEGER,           -- S01-S29 (numeração global no ano)
  data_inicio           DATE,
  data_fim              DATE,
  modulo                TEXT,              -- "RESERVA", "TITULAR", "MÓDULO 5", "2" etc.
  categoria_operacional TEXT,              -- COMBOIO, PIPA, MUNCK etc.
  placa                 TEXT,
  mpbt                  TEXT,             -- Descrição do plano
  tipo                  TEXT NOT NULL DEFAULT 'PREVENTIVA', -- PREVENTIVA ou DOCUMENTACAO
  status                TEXT NOT NULL DEFAULT 'PROGRAMADO', -- PROGRAMADO, CONCLUÍDO, EM ANDAMENTO
  data_inicio_exec      DATE,             -- data início execução
  data_fim_exec         DATE,             -- data término execução
  dias                  INTEGER,          -- dias para conclusão
  percentual            NUMERIC(5,2),     -- % de execução
  observacoes           TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE prev_metas_mensais   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prev_semanais        ENABLE ROW LEVEL SECURITY;
ALTER TABLE prev_provisionamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE prev_prog_semanal    ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_metas_mensais' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON prev_metas_mensais FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_semanais' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON prev_semanais FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_provisionamento' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON prev_provisionamento FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_prog_semanal' AND policyname='auth_all') THEN
    CREATE POLICY auth_all ON prev_prog_semanal FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
