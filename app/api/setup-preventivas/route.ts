import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()

  const queries = [
    `CREATE TABLE IF NOT EXISTS prev_metas_mensais (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ano INTEGER NOT NULL,
      mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
      meta NUMERIC(5,2) NOT NULL DEFAULT 100,
      realizado NUMERIC(5,2),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(ano, mes)
    )`,
    `CREATE TABLE IF NOT EXISTS prev_semanais (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ano INTEGER NOT NULL,
      mes_operacional TEXT NOT NULL,
      mes_numero INTEGER NOT NULL,
      semana_numero INTEGER NOT NULL CHECK (semana_numero BETWEEN 1 AND 5),
      semana_label TEXT NOT NULL,
      data_inicio DATE,
      data_fim DATE,
      meta NUMERIC(5,2) NOT NULL DEFAULT 25,
      realizado NUMERIC(5,2),
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS prev_provisionamento (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ano INTEGER NOT NULL,
      mes_operacional TEXT NOT NULL,
      mes_numero INTEGER NOT NULL,
      categoria_operacional TEXT NOT NULL,
      placa TEXT,
      mpbt TEXT,
      status TEXT NOT NULL DEFAULT 'EM ANDAMENTO',
      data_inicial DATE,
      data_final DATE,
      observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS prev_prog_semanal (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ano INTEGER NOT NULL,
      mes_numero INTEGER NOT NULL,
      semana_numero INTEGER NOT NULL,
      semana_global INTEGER,
      data_inicio DATE,
      data_fim DATE,
      modulo TEXT,
      categoria_operacional TEXT,
      placa TEXT,
      mpbt TEXT,
      tipo TEXT NOT NULL DEFAULT 'PREVENTIVA',
      status TEXT NOT NULL DEFAULT 'PROGRAMADO',
      data_inicio_exec DATE,
      data_fim_exec DATE,
      dias INTEGER,
      percentual NUMERIC(5,2),
      observacoes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `ALTER TABLE prev_metas_mensais ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE prev_semanais ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE prev_provisionamento ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE prev_prog_semanal ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_metas_mensais' AND policyname='auth_all') THEN CREATE POLICY auth_all ON prev_metas_mensais FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_semanais' AND policyname='auth_all') THEN CREATE POLICY auth_all ON prev_semanais FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_provisionamento' AND policyname='auth_all') THEN CREATE POLICY auth_all ON prev_provisionamento FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF; END $$`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='prev_prog_semanal' AND policyname='auth_all') THEN CREATE POLICY auth_all ON prev_prog_semanal FOR ALL TO authenticated USING (true) WITH CHECK (true); END IF; END $$`,
  ]

  const results: any[] = []
  for (const q of queries) {
    try {
      const { error } = await supabase.rpc('exec_sql', { query: q })
      results.push({ ok: !error, error: error?.message })
    } catch (e) {
      results.push({ ok: false, error: String(e) })
    }
  }

  // Verifica se as tabelas existem
  const checks = await Promise.all([
    supabase.from('prev_metas_mensais').select('id').limit(1),
    supabase.from('prev_semanais').select('id').limit(1),
    supabase.from('prev_provisionamento').select('id').limit(1),
    supabase.from('prev_prog_semanal').select('id').limit(1),
  ])

  const tablesOk = checks.every(c => !c.error)

  return NextResponse.json({
    tablesOk,
    message: tablesOk ? '✅ Todas as tabelas OK!' : '❌ Erro — execute o SQL manualmente no Supabase.',
    sqlFile: '/supabase/migrations/20260416_programacao_preventiva.sql',
    results,
  })
}
