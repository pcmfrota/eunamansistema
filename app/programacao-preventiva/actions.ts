"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { calcISOWeek as calcISOWeekUtil, mondayOfISOWeek, sundayOfISOWeek } from "./week-utils"

// ─── Types ───────────────────────────────────────────────────────────────────
export type ProgSemanal = {
  id: string
  ano: number
  mes_numero: number
  semana_numero: number  // ordinal within month: 1,2,3,4
  semana_iso: number | null  // ISO 8601 week: 1-53
  semana_global: number | null
  data_inicio: string | null  // week Monday (ISO date)
  data_fim: string | null     // week Sunday (ISO date)
  modulo: string | null
  categoria_operacional: string | null
  placa: string | null
  mpbt: string | null
  tipo: string
  status: string
  data_inicio_exec: string | null  // INÍCIO in table
  data_fim_exec: string | null     // TÉRMINO in table
  termino: string | null           // alias for data_fim_exec
  dias: number | null
  percentual: number | null
  observacoes: string | null
  horimetro_dia: string | null
  filial_id: string
  created_at: string
}

// ─── ISO Week Helpers (local, private) ───────────────────────────────────────
function calcISOWeek(dateStr: string): number { return calcISOWeekUtil(dateStr) }

function pctFromStatus(status: string, pct?: number | null): number {
  if (status === "CONCLUÍDO") return pct ?? 100
  return 0
}

// ─── READ ────────────────────────────────────────────────────────────────────
export async function getProgPrevData(ano?: number) {
  const supabase = createClient()
  const anoRef = ano ?? new Date().getFullYear()

  // Precisamos da filial do usuário ativo via cookie
  const { cookies } = await import('next/headers')
  const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ'

  const [progRes, calRes] = await Promise.all([
    supabase
      .from("prev_prog_semanal")
      .select("*")
      .eq("ano", anoRef)
      .eq("filial_id", filialId)
      .order("semana_iso", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("calendario_suzano")
      .select("mes,ano,data_inicio,data_fim")
      .eq("ano", anoRef)
      .order("mes"),
  ])

  return {
    progSemanais: (progRes.data ?? []) as ProgSemanal[],
    calendario:   (calRes.data  ?? []) as { mes: number; ano: number; data_inicio: string; data_fim: string }[],
  }
}

// ─── CREATE ──────────────────────────────────────────────────────────────────
export async function criarProgSemanal(
  data: Omit<ProgSemanal, "id" | "created_at">
) {
  const supabase = createClient()

  // Auto semana_iso
  let semanaIso = data.semana_iso
  if (!semanaIso && data.data_inicio) semanaIso = calcISOWeek(data.data_inicio)

  // Auto percentual
  const percentual = pctFromStatus(data.status, data.percentual)

  // Auto dias
  let dias = data.dias
  if (!dias && data.data_inicio_exec && data.data_fim_exec) {
    const d1 = new Date(data.data_inicio_exec + "T12:00:00")
    const d2 = new Date(data.data_fim_exec + "T12:00:00")
    dias = Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
  }

  const { cookies } = await import('next/headers')
  const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ'

  const { error } = await supabase.from("prev_prog_semanal").insert({
    ...data,
    semana_iso: semanaIso,
    percentual,
    dias,
    termino: data.data_fim_exec ?? data.termino ?? null,
    filial_id: filialId
  })

  if (error) return { error: error.message }
  revalidatePath("/programacao-preventiva")
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export async function atualizarProgSemanal(
  id: string,
  data: Partial<Omit<ProgSemanal, "id" | "created_at">>
) {
  const supabase = createClient()

  if (data.data_inicio && !data.semana_iso)
    data.semana_iso = calcISOWeek(data.data_inicio)

  if (data.status && data.percentual == null)
    data.percentual = pctFromStatus(data.status, null)

  if (!data.dias && data.data_inicio_exec && data.data_fim_exec) {
    const d1 = new Date(data.data_inicio_exec + "T12:00:00")
    const d2 = new Date(data.data_fim_exec + "T12:00:00")
    data.dias = Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
  }

  if (data.data_fim_exec) data.termino = data.data_fim_exec

  const { error } = await supabase.from("prev_prog_semanal").update(data).eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/programacao-preventiva")
}

// ─── STATUS TOGGLE ───────────────────────────────────────────────────────────
export async function atualizarStatusProgSemanal(
  id: string,
  status: string,
  extras?: { data_inicio_exec?: string; data_fim_exec?: string; dias?: number; percentual?: number }
) {
  const supabase = createClient()
  const percentual = extras?.percentual ?? pctFromStatus(status, null)
  const termino = extras?.data_fim_exec ?? null
  const { error } = await supabase
    .from("prev_prog_semanal")
    .update({ status, percentual, ...(extras ?? {}), ...(termino ? { termino } : {}) })
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/programacao-preventiva")
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
export async function excluirProgSemanal(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from("prev_prog_semanal").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/programacao-preventiva")
}
