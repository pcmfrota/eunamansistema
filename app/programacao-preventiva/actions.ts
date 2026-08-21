"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { calcISOWeek as calcISOWeekUtil, mondayOfISOWeek, sundayOfISOWeek } from "./week-utils"
import { registrarExclusao, registrarExclusoesEmLote } from "@/lib/audit-log"

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

  let progSnapshot: any = null
  try {
    const { data } = await supabase
      .from("prev_prog_semanal")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    progSnapshot = data
  } catch (snapshotError) {
    console.warn(`Falha ao capturar snapshot da programação ${id} antes da exclusão:`, snapshotError)
  }

  const { error } = await supabase.from("prev_prog_semanal").delete().eq("id", id)
  if (error) return { error: error.message }

  await registrarExclusao({
    supabase,
    modulo: "Programação Preventiva",
    tabelaOrigem: "prev_prog_semanal",
    registroId: id,
    descricao: progSnapshot ? `${progSnapshot.placa} — Semana ${progSnapshot.semana_iso}/${progSnapshot.ano} (${progSnapshot.tipo})` : null,
    dados: progSnapshot,
  })

  revalidatePath("/programacao-preventiva")
}

// ─── IMPORT (Excel) ─────────────────────────────────────────────────────────
// Formato esperado (mesmas colunas da planilha externa já usada pela equipe):
// ANO, MÊS ("4° ABRIL"), SEM. ("S18"), PLACA, MÓDULO, TIPO (C.O: COMBOIO/PIPA/...),
// DT. INICIAL, DT. FINAL, QTD DIA, HORAS, STATUS, %, HORÍMETRO DO DIA, TIPO DE MANUTENÇÃO

const MESES_PT = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
]

function getVal(row: Record<string, any>, aliases: string[]): any {
  for (const alias of aliases) {
    const val = row[alias]
    if (val !== undefined && val !== null && val !== "") return val
  }
  const keys = Object.keys(row)
  for (const alias of aliases) {
    const key = keys.find(k => k.toLowerCase().trim() === alias.toLowerCase().trim())
    if (key && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key]
  }
  return null
}

function mesNumeroFromLabel(label: string): number | null {
  const upper = String(label || "").toUpperCase()
  for (let i = 0; i < MESES_PT.length; i++) {
    if (upper.includes(MESES_PT[i])) return i + 1
  }
  return null
}

function parseDateFlexible(raw: any): string | null {
  if (raw == null || raw === "") return null
  if (typeof raw === "number") {
    // Data serial do Excel (epoch 30/12/1899)
    const date = new Date(Math.round((raw - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  const str = String(raw).trim()
  if (!str) return null
  if (str.includes("/")) {
    const parts = str.split("/")
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
    }
  }
  if (str.includes("-")) return str.slice(0, 10)
  return null
}

function parsePercentual(raw: any): number | null {
  if (raw == null || raw === "") return null
  if (typeof raw === "number") return raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
  const str = String(raw).replace("%", "").replace(",", ".").trim()
  const n = parseFloat(str)
  return isNaN(n) ? null : Math.round(n)
}

function normalizeStatus(raw: any): string {
  const s = String(raw || "").toUpperCase().trim()
  if (s.startsWith("CONCLU")) return "CONCLUÍDO"
  if (s.startsWith("REPROGRAMA")) return "REPROGRAMADO"
  if (s.startsWith("EM ANDAMENTO")) return "EM ANDAMENTO"
  if (s.startsWith("CANCELAD")) return "CANCELADO"
  if (s.startsWith("PROGRAMAD")) return "PROGRAMADO"
  return s || "PROGRAMADO"
}

export async function importarProgSemanal(rows: any[]) {
  try {
    const supabase = createClient()
    const { cookies } = await import("next/headers")
    const filialId = cookies().get("x-user-filial")?.value || "MATRIZ"

    const mapped = rows.map(row => {
      const placa = String(getVal(row, ["placa", "Placa", "PLACA"]) || "").toUpperCase().trim()
      if (!placa) return null // ignora linhas de cabeçalho de semana ("Semana 18: ...") e linhas em branco

      const anoRaw = getVal(row, ["ano", "Ano", "ANO"])
      const ano = anoRaw ? parseInt(String(anoRaw)) : new Date().getFullYear()

      const mesLabel = String(getVal(row, ["mes", "Mês", "MÊS", "mês"]) || "")
      const mesNumero = mesNumeroFromLabel(mesLabel) || 1
      const semanaNumeroMatch = mesLabel.match(/^(\d+)/)
      const semanaNumero = semanaNumeroMatch ? parseInt(semanaNumeroMatch[1]) : 1

      const semanaRaw = getVal(row, ["sem", "Sem.", "SEM.", "semana", "Semana", "SEMANA"])
      const semanaIso = semanaRaw ? parseInt(String(semanaRaw).replace(/[^0-9]/g, "")) || null : null

      const dataInicio = semanaIso ? mondayOfISOWeek(semanaIso, ano) : null
      const dataFim = semanaIso ? sundayOfISOWeek(semanaIso, ano) : null

      const modulo = String(getVal(row, ["modulo", "Módulo", "MÓDULO", "Modulo"]) || "").trim() || null
      const categoriaOperacional = String(getVal(row, ["tipo", "Tipo", "TIPO", "categoria", "C.O", "co"]) || "").toUpperCase().trim() || null

      const dataInicioExec = parseDateFlexible(getVal(row, ["dt. inicial", "DT. INICIAL", "data inicial", "Data Inicial", "DATA INICIAL"]))
      const dataFimExec = parseDateFlexible(getVal(row, ["dt. final", "DT. FINAL", "data final", "Data Final", "DATA FINAL"]))

      const diasRaw = getVal(row, ["qtd dia", "QTD DIA", "dias", "Dias"])
      const dias = diasRaw != null && diasRaw !== "" ? parseInt(String(diasRaw)) || null : null

      const mpbtRaw = getVal(row, ["horas", "Horas", "HORAS", "horas (mpbt)", "mpbt", "MPBT"])
      const mpbt = mpbtRaw != null ? String(mpbtRaw).trim() : null

      const status = normalizeStatus(getVal(row, ["status", "Status", "STATUS"]))
      const percentual = parsePercentual(getVal(row, ["%", "percentual", "Percentual"]))

      const horimetroRaw = getVal(row, ["horimetro do dia", "HORIMETRO DO DIA", "horímetro do dia", "HORÍMETRO DO DIA", "horimetro", "horímetro"])
      const horimetroDia = horimetroRaw != null ? String(horimetroRaw).trim() : null

      const tipo = String(getVal(row, ["tipo de manutencao", "TIPO DE MANUTENÇÃO", "tipo de manutenção", "Tipo de Manutenção"]) || "").toUpperCase().trim() || "PREVENTIVA"

      const obsRaw = getVal(row, ["obs", "OBS", "obs.", "OBS.", "obs:", "OBS:", "observacoes", "Observações", "OBSERVAÇÕES", "observações"])
      const observacoes = obsRaw != null ? String(obsRaw).trim() || null : null

      return {
        ano,
        mes_numero: mesNumero,
        semana_numero: semanaNumero,
        semana_iso: semanaIso,
        semana_global: semanaIso,
        data_inicio: dataInicio,
        data_fim: dataFim,
        modulo,
        categoria_operacional: categoriaOperacional,
        placa,
        mpbt,
        tipo,
        status,
        data_inicio_exec: dataInicioExec,
        data_fim_exec: dataFimExec,
        termino: dataFimExec,
        dias,
        percentual,
        observacoes,
        horimetro_dia: horimetroDia,
        filial_id: filialId,
      }
    }).filter(Boolean) as any[]

    if (mapped.length === 0) {
      return { error: "Nenhum registro válido encontrado na planilha (verifique se a coluna Placa está preenchida)." }
    }

    const anos = Array.from(new Set(mapped.map(m => m.ano)))

    // Substitui os lançamentos existentes do(s) ano(s) importado(s) desta filial: a planilha
    // externa é a fonte da verdade, então o que já existe é removido (com snapshot para o
    // Histórico de Exclusões) antes de inserir os dados novos.
    const { data: existentes } = await supabase
      .from("prev_prog_semanal")
      .select("*")
      .eq("filial_id", filialId)
      .in("ano", anos)

    if (existentes && existentes.length > 0) {
      const { error: deleteError } = await supabase
        .from("prev_prog_semanal")
        .delete()
        .eq("filial_id", filialId)
        .in("ano", anos)
      if (deleteError) return { error: deleteError.message }

      await registrarExclusoesEmLote(
        supabase,
        "Programação Preventiva",
        "prev_prog_semanal",
        existentes.map((r: any) => ({
          registroId: r.id,
          descricao: `${r.placa} — Semana ${r.semana_iso}/${r.ano} (${r.tipo})`,
          dados: r,
        }))
      )
    }

    const { error: insertError } = await supabase.from("prev_prog_semanal").insert(mapped)
    if (insertError) return { error: insertError.message }

    revalidatePath("/programacao-preventiva")
    return { success: true, count: mapped.length, anos }
  } catch (error: any) {
    return { error: error.message || "Erro ao importar planilha." }
  }
}
