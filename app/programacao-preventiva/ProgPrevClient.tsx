"use client"

import { useState, useTransition, useMemo, useCallback } from "react"
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip, Legend, Cell, PieChart, Pie, BarChart, LabelList
} from "recharts"
import { SearchableSelect } from '@/components/SearchableSelect'
import { Plus, Pencil, Trash2, Check, X, Calendar, ChevronLeft, ChevronRight, RefreshCw, ShieldOff } from "lucide-react"
import { useAuth } from "@/components/auth-context"
import type { ProgSemanal } from "./actions"
import {
  criarProgSemanal, atualizarProgSemanal, excluirProgSemanal,
  atualizarStatusProgSemanal,
} from "./actions"
import { useOffline } from "@/components/offline-provider"
import { localDb } from "@/lib/offline-db"
import { mondayOfISOWeek, sundayOfISOWeek } from "./week-utils"

// ─── Constants ───────────────────────────────────────────────────────────────
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
const MESES_A = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"]
const ORDINAL = ["","1ª","2ª","3ª","4ª","5ª","6ª"]
const CATS = ["COMBOIO","MUNCK","PIPA","MULI","MULT","CARREGAMENTO","MALHA VIARIA","OUTROS"]
const STATUS_OPT = ["PROGRAMADO","EM ANDAMENTO","CONCLUÍDO","REPROGRAMADO","CANCELADO"]
const TIPO_OPT   = ["PREVENTIVA","DOCUMENTAÇÃO"]
const PIE_COLORS = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#8b5cf6"]

// ─── ISO Week Utilities (client side) ────────────────────────────────────────
function isoWeekClient(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00")
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function mondayClient(week: number, year: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayNum = jan4.getUTCDay() || 7
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - dayNum + 1 + (week - 1) * 7)
  return monday.toISOString().slice(0, 10)
}

function sundayClient(week: number, year: number): string {
  const mon = new Date(mondayClient(week, year) + "T12:00:00")
  mon.setUTCDate(mon.getUTCDate() + 6)
  return mon.toISOString().slice(0, 10)
}

function fmtBR(d: string | null | undefined): string {
  if (!d) return "—"
  const [y, m, dd] = d.split("-")
  return `${dd}/${m}/${y}`
}

function toDate(s: string): Date { return new Date(s + "T12:00:00") }

type WeekInfo = { semana_iso: number; data_inicio: string; data_fim: string; semana_numero: number }

function getSemanasDoMes(
  cal: { data_inicio: string; data_fim: string } | undefined,
  ano: number
): WeekInfo[] {
  if (!cal) return []
  const ini = toDate(cal.data_inicio)
  const fim = toDate(cal.data_fim)

  // Vai até a segunda-feira da semana que contém data_inicio
  const iniDay = ini.getDay()
  const monday = new Date(ini)
  monday.setDate(ini.getDate() - (iniDay === 0 ? 6 : iniDay - 1))

  const weeks: WeekInfo[] = []
  let cur = new Date(monday)
  let n = 1

  while (cur <= fim) {
    const sunday = new Date(cur)
    sunday.setDate(cur.getDate() + 6)
    weeks.push({
      semana_iso:    isoWeekClient(cur.toISOString().slice(0, 10)),
      data_inicio:   cur.toISOString().slice(0, 10),
      data_fim:      sunday.toISOString().slice(0, 10),
      semana_numero: n++,
    })
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

// ─── Shared UI ───────────────────────────────────────────────────────────────
const inp = "w-full px-3 py-2 text-sm rounded-lg border border-gray-300 bg-gray-50 text-gray-900 outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
const lbl = "text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 block"

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-xl">
      <p className="text-[10px] font-bold text-gray-500 mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? p.fill ?? "#22c55e" }} className="text-sm font-bold">
          {p.name}: <span className="text-gray-800">{p.value != null ? `${p.value}%` : "—"}</span>
        </p>
      ))}
    </div>
  )
}

const StatusBadge = ({ status }: { status: string }) => {
  const cl: Record<string, string> = {
    "CONCLUÍDO":    "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm",
    "PROGRAMADO":   "bg-gray-100 text-gray-700 border-gray-300 shadow-sm",
    "EM ANDAMENTO": "bg-blue-100 text-blue-700 border-blue-300 shadow-sm",
    "REPROGRAMADO": "bg-amber-100 text-amber-700 border-amber-300 shadow-sm",
    "CANCELADO":    "bg-red-100 text-red-700 border-red-300 shadow-sm",
  }
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${cl[status] ?? "bg-gray-100 text-gray-700 border-gray-300 shadow-sm"}`}>
      {status}
    </span>
  )
}

// ─── TABS ───────────────────────────────────────────────────────────────────
type Tab = "prog-semanal" | "planejamento" | "semanais" | "provisionamento"
const TABS: { id: Tab; label: string }[] = [
  { id: "prog-semanal",    label: "📅 Programação Semanal" },
  { id: "planejamento",    label: "📊 Planejamento Mensal" },
  { id: "semanais",        label: "📈 Metas Semanais" },
  { id: "provisionamento", label: "🔧 Provisionamento" },
]

const ISO_CALENDAR_2026 = [
  { mes: 1, data_inicio: "2025-12-29", data_fim: "2026-02-01" },
  { mes: 2, data_inicio: "2026-02-02", data_fim: "2026-03-01" },
  { mes: 3, data_inicio: "2026-03-02", data_fim: "2026-03-29" },
  { mes: 4, data_inicio: "2026-03-30", data_fim: "2026-05-03" },
  { mes: 5, data_inicio: "2026-05-04", data_fim: "2026-05-31" },
  { mes: 6, data_inicio: "2026-06-01", data_fim: "2026-06-28" },
  { mes: 7, data_inicio: "2026-06-29", data_fim: "2026-08-02" },
  { mes: 8, data_inicio: "2026-08-03", data_fim: "2026-08-30" },
  { mes: 9, data_inicio: "2026-08-31", data_fim: "2026-09-27" },
  { mes: 10, data_inicio: "2026-09-28", data_fim: "2026-11-01" },
  { mes: 11, data_inicio: "2026-11-02", data_fim: "2026-11-29" },
  { mes: 12, data_inicio: "2026-11-30", data_fim: "2027-01-03" },
]

// ════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════════
export default function ProgPrevClient({
  progSemanais, calendario, equipamentos, anoAtivo
}: {
  progSemanais: ProgSemanal[]
  calendario: { mes: number; ano: number; data_inicio: string; data_fim: string }[]
  equipamentos: { id: string; placa: string; categoria?: string }[]
  anoAtivo: number
}) {
  const { profile } = useAuth()
  const { isOnline } = useOffline()
  const isVisitante = profile?.role === 'visitante'
  const [tab, setTab] = useState<Tab>("prog-semanal")

  // Mes operacional ativo (auto detecta pelo dia atual usando ISO_CALENDAR para a preventiva)
  const [mesAtivo, setMesAtivo] = useState<number>(() => {
    const now = new Date()
    const targetCal = anoAtivo === 2026 ? ISO_CALENDAR_2026 : calendario
    const cal = targetCal.find(c => {
      const ini = toDate(c.data_inicio); const fim = toDate(c.data_fim + "T23:59:59")
      return now >= ini && now <= fim
    })
    return cal?.mes ?? (now.getMonth() + 1)
  })

  const calMes = useMemo(() => {
    if (anoAtivo === 2026) {
      const isoMonth = ISO_CALENDAR_2026.find(c => c.mes === mesAtivo)
      if (isoMonth) return { ...isoMonth, ano: anoAtivo }
    }
    return calendario.find(c => c.mes === mesAtivo)
  }, [calendario, mesAtivo, anoAtivo])
  
  const semanasDoMes = useMemo(() => getSemanasDoMes(calMes, anoAtivo), [calMes, anoAtivo])

  // Semana ativa (ISO week)
  const [semanaIsoAtiva, setSemanaIsoAtiva] = useState<number | null>(null)

  // Semana default: first week of month that has data, or first week of month
  const semanaIsoAtivaResolved = useMemo(() => {
    if (semanaIsoAtiva) return semanaIsoAtiva
    const itensMes = progSemanais.filter(p => p.mes_numero === mesAtivo)
    if (itensMes.length > 0) {
      const semanas = itensMes.map(p => p.semana_iso ?? 0).filter(Boolean).sort((a, b) => a - b)
      if (semanas.length > 0) return semanas[0]
    }
    return semanasDoMes[0]?.semana_iso ?? isoWeekClient(new Date().toISOString().slice(0, 10))
  }, [semanaIsoAtiva, progSemanais, mesAtivo, semanasDoMes])

  const weekInfo = useMemo(
    () => semanasDoMes.find(w => w.semana_iso === semanaIsoAtivaResolved) ?? semanasDoMes[0],
    [semanasDoMes, semanaIsoAtivaResolved]
  )

  // ── Computed derivations from progSemanais ──────────────────────────
  // 1. Planejamento mensal
  const mensaisComputado = useMemo(() => MESES.map((_, i) => {
    const mes = i + 1
    const itens = progSemanais.filter(p => p.mes_numero === mes)
    if (itens.length === 0) return { mes, mesAbr: MESES_A[i], meta: 100, realizado: null }
    const pct = Math.round(itens.filter(p => p.status === "CONCLUÍDO").length / itens.length * 100)
    return { mes, mesAbr: MESES_A[i], meta: 100, realizado: pct }
  }), [progSemanais])

  // 2. Metas semanais do mês ativo
  const semanaisComputado = useMemo(() => {
    const itens = progSemanais.filter(p => p.mes_numero === mesAtivo)
    const weekMap = new Map<number, ProgSemanal[]>()
    itens.forEach(p => {
      const w = p.semana_iso ?? 0
      if (w > 0) { if (!weekMap.has(w)) weekMap.set(w, []); weekMap.get(w)!.push(p) }
    })
    return Array.from(weekMap.entries()).sort(([a], [b]) => a - b).map(([w, rows], idx) => {
      const concl = rows.filter(r => r.status === "CONCLUÍDO").length
      const pct = Math.round(concl / rows.length * 100)
      const wi = semanasDoMes.find(s => s.semana_iso === w)
      return {
        semana_iso: w,
        semana_numero: wi?.semana_numero ?? (idx + 1),
        label: `${ORDINAL[wi?.semana_numero ?? idx + 1]} Sem`,
        fullLabel: `${ORDINAL[wi?.semana_numero ?? idx + 1]} SEMANA DE ${MESES[mesAtivo - 1].toUpperCase()} (S${w})`,
        data_inicio: wi?.data_inicio ?? rows[0]?.data_inicio ?? null,
        data_fim: wi?.data_fim ?? rows[0]?.data_fim ?? null,
        meta: 100,
        realizado: pct,
        total: rows.length,
        concluidos: concl,
      }
    })
  }, [progSemanais, mesAtivo, semanasDoMes])

  // 3. Provisionamento do mês
  const provComputado = useMemo(() => {
    return progSemanais
      .filter(p => p.mes_numero === mesAtivo)
      .sort((a, b) => (a.semana_iso ?? 0) - (b.semana_iso ?? 0))
  }, [progSemanais, mesAtivo])

  // 4. Itens da semana ativa
  const itensDaSemana = useMemo(() => {
    return progSemanais.filter(p =>
      p.mes_numero === mesAtivo &&
      (p.semana_iso === semanaIsoAtivaResolved || p.semana_numero === (weekInfo?.semana_numero ?? 0))
    )
  }, [progSemanais, mesAtivo, semanaIsoAtivaResolved, weekInfo])

  const pctSemana = useMemo(() => {
    if (itensDaSemana.length === 0) return 0
    return Math.round(itensDaSemana.filter(p => p.status === "CONCLUÍDO").length / itensDaSemana.length * 100)
  }, [itensDaSemana])

  const handleMesChange = (mes: number) => {
    setMesAtivo(mes)
    setSemanaIsoAtiva(null)
  }

  return (
    <div className="flex flex-col w-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
              tab === t.id ? "border-green-600 text-green-700" : "border-transparent text-gray-700 hover:text-black"}`}>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 pr-4 shrink-0">
          <Calendar size={13} className="text-gray-500" />
          <select value={mesAtivo} onChange={e => handleMesChange(Number(e.target.value))}
            className="px-2 py-1.5 text-xs rounded-lg border border-gray-300 bg-gray-50 text-gray-700 outline-none">
            {MESES.map((m, i) => <option key={i + 1} value={i + 1}>Mês Op.: {m}</option>)}
          </select>
        </div>
      </div>

      <div className={`p-4 md:p-6 flex flex-col gap-6 ${tab !== "prog-semanal" ? "bg-gray-50" : "bg-gray-50"}`}>
        {tab === "prog-semanal" && (
          <TabProgSemanal
            itensDaSemana={itensDaSemana}
            pctSemana={pctSemana}
            semanasDoMes={semanasDoMes}
            semanaIsoAtiva={semanaIsoAtivaResolved}
            setSemanaIsoAtiva={setSemanaIsoAtiva}
            weekInfo={weekInfo}
            mesAtivo={mesAtivo}
            anoAtivo={anoAtivo}
            equipamentos={equipamentos}
            calendario={calendario}
            progSemanais={progSemanais}
            isVisitante={isVisitante}
          />
        )}
        {tab === "planejamento" && (
          <TabPlanejamento mensaisComputado={mensaisComputado} anoAtivo={anoAtivo} mesAtivo={mesAtivo} />
        )}
        {tab === "semanais" && (
          <TabSemanais semanaisComputado={semanaisComputado} anoAtivo={anoAtivo} mesAtivo={mesAtivo} />
        )}
        {tab === "provisionamento" && (
          <TabProvisionamento
            provComputado={provComputado}
            semanasDoMes={semanasDoMes}
            mesAtivo={mesAtivo}
            calMes={calMes}
          />
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TAB: PROGRAMAÇÃO SEMANAL (ENTRY POINT)
// ════════════════════════════════════════════════════════════════════════
function TabProgSemanal({
  itensDaSemana, pctSemana, semanasDoMes, semanaIsoAtiva, setSemanaIsoAtiva,
  weekInfo, mesAtivo, anoAtivo, equipamentos, calendario, progSemanais,
  isVisitante,
}: {
  itensDaSemana: ProgSemanal[]; pctSemana: number
  semanasDoMes: WeekInfo[]; semanaIsoAtiva: number
  setSemanaIsoAtiva: (w: number) => void
  weekInfo: WeekInfo | undefined
  mesAtivo: number; anoAtivo: number
  equipamentos: { id: string; placa: string; categoria?: string }[]
  calendario: { mes: number; ano: number; data_inicio: string; data_fim: string }[]
  progSemanais: ProgSemanal[]
  isVisitante: boolean
}) {
  const { isOnline } = useOffline()
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<ProgSemanal | null>(null)
  const [, startT] = useTransition()

  const [filtroStatus, setFiltroStatus] = useState("")
  const [filtroPlaca, setFiltroPlaca] = useState("")
  const [filtroModulo, setFiltroModulo] = useState("")

  const preventivasAll = itensDaSemana.filter(p => p.tipo !== "DOCUMENTAÇÃO")
  const documentosAll = itensDaSemana.filter(p => p.tipo === "DOCUMENTAÇÃO")

  const applyFilters = (list: ProgSemanal[]) => list.filter(p => 
    (filtroStatus ? p.status === filtroStatus : true) &&
    (filtroPlaca ? p.placa === filtroPlaca : true) &&
    (filtroModulo ? String(p.modulo) === filtroModulo : true)
  )

  const preventivas = applyFilters(preventivasAll)
  const documentos = applyFilters(documentosAll)

  const placasUnicas = Array.from(new Set(progSemanais.map(p => p.placa).filter(Boolean)))
  const modulosUnicos = Array.from(new Set(progSemanais.map(p => String(p.modulo)).filter(Boolean)))

  const pctColor = pctSemana >= 100 ? "#22c55e" : pctSemana >= 50 ? "#f59e0b" : "#ef4444"
  const ordLabel = weekInfo
    ? `${ORDINAL[weekInfo.semana_numero]} SEMANA DE ${MESES[mesAtivo - 1].toUpperCase()}`
    : ""

  // Count items per week for badges
  const countPerWeek = useMemo(() => {
    const map = new Map<number, number>()
    progSemanais.filter(p => p.mes_numero === mesAtivo).forEach(p => {
      const w = p.semana_iso ?? 0
      if (w) map.set(w, (map.get(w) ?? 0) + 1)
    })
    return map
  }, [progSemanais, mesAtivo])

  const StatusRow = ({ item }: { item: ProgSemanal }) => {
    const pct = item.status === "CONCLUÍDO" ? 100 : item.status === "PROGRAMADO" || item.status === "REPROGRAMADO" ? 0 : (item.percentual ?? 0)
    const pctCl = pct >= 100 ? "text-emerald-400" : pct > 0 ? "text-amber-400" : "text-red-400"

    return (
      <div className="flex flex-col md:grid text-[10px] border-b border-gray-100 hover:bg-gray-50/30 transition-colors group items-start md:items-center p-3 md:p-0 gap-2 md:gap-0 relative"
        style={{ gridTemplateColumns: "5% 6% 6% 7% 7% 8% 8% 8% 5% 1fr 10% 4% 8% 4%" }}>
        
        {/* Mobile Header: Placa, Módulo, Categoria */}
        <div className="flex md:hidden items-center justify-between w-full mb-1">
          <div className="flex items-center gap-2">
            <span className="font-black text-amber-600 text-sm">{item.placa ?? "—"}</span>
            <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-bold">{item.modulo ?? "—"}</span>
          </div>
          <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{item.categoria_operacional ?? "—"}</span>
        </div>

        <div className="hidden md:block px-2 py-2 text-black">{item.ano}</div>
        <div className="hidden md:block px-2 py-2 text-black">{MESES_A[item.mes_numero - 1]?.toUpperCase()}</div>
        <div className="hidden md:block px-2 py-2 font-bold text-black">S{String(item.semana_iso).padStart(2, "0")}</div>
        <div className="hidden md:block px-2 py-2 font-black text-amber-600">{item.placa ?? "—"}</div>
        <div className="hidden md:block px-2 py-2 text-black font-medium truncate">{item.modulo ?? "—"}</div>
        <div className="hidden md:block px-2 py-2 font-bold text-green-700 truncate">{item.categoria_operacional ?? "—"}</div>
        
        {/* Mobile Dates */}
        <div className="flex md:hidden w-full items-center justify-between bg-gray-50 rounded-lg p-2 text-[11px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-bold text-[9px]">INÍCIO</span>
            <span className="text-gray-700 font-mono">{fmtBR(item.data_inicio_exec)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-bold text-[9px]">FIM</span>
            <span className="text-gray-700 font-mono">{fmtBR(item.data_fim_exec ?? item.termino)}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-400 font-bold text-[9px]">DIAS</span>
            <span className="text-gray-700">{item.dias ?? "—"}</span>
          </div>
        </div>

        <div className="hidden md:block px-2 py-2 text-black font-mono">{fmtBR(item.data_inicio_exec)}</div>
        <div className="hidden md:block px-2 py-2 text-black font-mono">{fmtBR(item.data_fim_exec ?? item.termino)}</div>
        <div className="hidden md:block px-2 py-2 text-black text-center">{item.dias ?? "—"}</div>
        
        <div className="md:px-2 md:py-2 text-black truncate flex items-center w-full md:w-auto" title={item.mpbt ?? ""}>
          <span className="md:hidden font-bold text-gray-700 mr-2 w-16">MPBT:</span>
          <span className="truncate">{item.mpbt ?? "—"}</span>
        </div>
        
        <div className="md:px-2 md:py-2 flex items-center w-full md:w-auto mt-1 md:mt-0">
          <span className="md:hidden font-bold text-gray-400 mr-2 w-16">STATUS:</span>
          {!isVisitante ? (
            <button onClick={() => startT(async () => {
              const ns = item.status === "CONCLUÍDO" ? "PROGRAMADO" : "CONCLUÍDO"
              const today = new Date().toISOString().slice(0, 10)
              const extras = ns === "CONCLUÍDO"
                ? { percentual: 100, data_fim_exec: today }
                : { percentual: 0 }
              
              if (isOnline) {
                try {
                  const res = await atualizarStatusProgSemanal(item.id, ns, extras)
                  if (res?.error) {
                    alert("Erro ao atualizar status:\\n" + res.error)
                    return
                  }
                  window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
                } catch (err: any) {
                  alert("Erro ao atualizar status:\\n" + (err?.message || String(err)))
                }
              } else {
                const updated = { ...item, status: ns, ...extras, _isPendingSync: true }
                await localDb.put("prev_prog_semanal", updated)
                await localDb.addToQueue("prev_prog_semanal", "update_status_prog_semanal", { id: item.id, status: ns, extras })
                window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
                alert("✅ Status atualizado localmente! Será sincronizado assim que a conexão voltar.")
              }
            })} className="hover:opacity-80 transition-opacity">
              <StatusBadge status={item.status} />
              {(item as any)._isPendingSync && (
                <span className="ml-1 text-[8px] text-amber-500 font-black animate-pulse">(OFFLINE)</span>
              )}
            </button>
          ) : (
            <StatusBadge status={item.status} />
          )}
        </div>
        
        <div className={`md:px-2 md:py-2 font-black ${pctCl} md:text-center flex items-center w-full md:w-auto`}>
          <span className="md:hidden font-bold text-gray-400 mr-2 w-16">PROG:</span>
          {pct}%
        </div>
        
        <div className="md:px-2 md:py-2 text-black font-mono md:text-center flex items-center w-full md:w-auto">
          <span className="md:hidden font-bold text-gray-700 mr-2 w-16">HORÍM:</span>
          {item.horimetro_dia ?? "—"}
        </div>
        
        {!isVisitante && (
          <div className="md:px-2 md:py-2 flex gap-3 md:gap-1 justify-end md:opacity-0 group-hover:opacity-100 transition-opacity absolute md:relative top-3 right-3 md:top-auto md:right-auto">
            <button onClick={() => { setEditItem(item); setShowForm(true) }}
              className="p-1.5 md:p-1 bg-white md:bg-transparent shadow-sm md:shadow-none border border-gray-100 md:border-transparent rounded-md text-gray-400 hover:text-gray-800 transition-colors"><Pencil size={12} className="md:w-[11px] md:h-[11px]" /></button>
            <button onClick={() => {
              if (confirm("Excluir este item?")) {
                startT(async () => {
                  if (isOnline) {
                    try {
                      const res = await excluirProgSemanal(item.id)
                      if (res?.error) {
                        alert("Erro ao excluir:\\n" + res.error)
                        return
                      }
                      window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
                    } catch (err: any) {
                      alert("Erro ao excluir:\\n" + (err?.message || String(err)))
                    }
                  } else {
                    await localDb.delete("prev_prog_semanal", item.id)
                    await localDb.addToQueue("prev_prog_semanal", "delete", { id: item.id })
                    window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
                    alert("✅ Registro excluído localmente! Será sincronizado quando a conexão voltar.")
                  }
                })
              }
            }}
              className="p-1.5 md:p-1 bg-white md:bg-transparent shadow-sm md:shadow-none border border-gray-100 md:border-transparent rounded-md text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={12} className="md:w-[11px] md:h-[11px]" /></button>
          </div>
        )}
      </div>
    )
  }

  const TableHeader = ({ tipo }: { tipo: string }) => (
    <div className={`hidden md:grid text-[9px] font-black uppercase tracking-widest border-b ${
      tipo === "PREVENTIVA"
        ? "bg-green-50 border-green-200 text-black"
        : "bg-white border-gray-300 text-black"
    }`} style={{ gridTemplateColumns: "5% 6% 6% 7% 7% 8% 8% 8% 5% 1fr 10% 4% 8% 4%" }}>
      {["ANO","MÊS","SEM.","PLACA","MÓDULO","TIPO","DT. INICIAL","DT. FINAL","QTD DIA", tipo === "PREVENTIVA" ? "HORAS (MPBT)" : "DOCUMENTAÇÃO","STATUS","%","HORÍMETRO",""].map((h, i) => (
        <div key={i} className="px-2 py-2.5">{h}</div>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Week selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {semanasDoMes.map(w => {
            const count = countPerWeek.get(w.semana_iso) ?? 0
            const isActive = w.semana_iso === semanaIsoAtiva
            
            const itensW = progSemanais.filter(p => p.mes_numero === mesAtivo && (p.semana_iso === w.semana_iso || p.semana_numero === w.semana_numero))
            const conclW = itensW.filter(p => p.status === "CONCLUÍDO").length
            const pctW = itensW.length > 0 ? Math.round((conclW / itensW.length) * 100) : 0
            
            return (
              <button key={w.semana_iso} onClick={() => setSemanaIsoAtiva(w.semana_iso)}
                title={`${fmtBR(w.data_inicio)} À ${fmtBR(w.data_fim)} — SEMANA ${w.semana_iso}`}
                className={`relative flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  isActive
                    ? "bg-green-700 text-white border-green-600 shadow-lg shadow-green-900/30"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 hover:text-black"}`}>
                <div className="flex items-center gap-1.5">
                  <span>{ORDINAL[w.semana_numero]} Sem</span>
                  {itensW.length > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 font-black rounded-md ${
                      isActive 
                        ? "bg-white/30 text-white" 
                        : pctW >= 100 
                          ? "bg-emerald-100 text-emerald-800" 
                          : pctW >= 50 
                            ? "bg-amber-100 text-amber-700" 
                            : "bg-red-100 text-red-700"
                    }`}>
                      {pctW}%
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-bold mt-0.5 ${isActive ? "text-green-100" : "text-gray-500"}`}>S{w.semana_iso}</span>
                {count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${
                    isActive ? "bg-white text-green-700" : "bg-green-600 text-white"}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {!isVisitante ? (
          <button onClick={() => { setEditItem(null); setShowForm(true) }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-500 transition-colors shadow">
            <Plus size={15} /> Adicionar
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 text-[11px] font-bold">
            <ShieldOff size={14} /> Somente Leitura
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mr-2">Filtros</span>
        
        <div className="w-36">
          <select 
            value={filtroStatus} 
            onChange={e => setFiltroStatus(e.target.value)}
            className="w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-gray-200 bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-green-500/30 cursor-pointer"
          >
            <option value="">TODOS STATUS</option>
            {STATUS_OPT.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="w-40">
          <SearchableSelect 
            name="filtroPlaca"
            value={filtroPlaca} 
            onChange={setFiltroPlaca}
            options={placasUnicas.map(p => ({ value: p, label: p }))}
            placeholder="TODAS PLACAS"
          />
        </div>

        <div className="w-36">
          <select 
            value={filtroModulo} 
            onChange={e => setFiltroModulo(e.target.value)}
            className="w-full px-3 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg border border-gray-200 bg-gray-50 text-gray-700 outline-none focus:ring-2 focus:ring-green-500/30 cursor-pointer"
          >
            <option value="">TODOS MÓDULOS</option>
            {modulosUnicos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {(filtroStatus || filtroPlaca || filtroModulo) && (
          <button 
            onClick={() => { setFiltroStatus(""); setFiltroPlaca(""); setFiltroModulo("") }}
            className="ml-auto text-[10px] font-bold text-red-500 uppercase tracking-widest hover:bg-red-50 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1"
          >
            <X size={12} /> Limpar
          </button>
        )}
      </div>

      {/* Week card — matches Excel layout */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-200">
          <div className="flex flex-col md:flex-row items-start justify-between px-4 md:px-6 py-4 bg-white gap-4 md:gap-0">
            {/* Left: % + period */}
            <div>
              <div className="flex flex-wrap md:flex-nowrap items-center gap-2 md:gap-3 mb-1">
                <span className="text-[10px] font-bold text-black uppercase tracking-widest">% Programação</span>
                {weekInfo && (
                  <span className="text-red-500 font-black text-sm">
                    {fmtBR(weekInfo.data_inicio)} À {fmtBR(weekInfo.data_fim)}
                    <span className="ml-2 text-black font-normal text-[11px]">— SEMANA {semanaIsoAtiva}</span>
                  </span>
                )}
              </div>
              <p className="text-4xl md:text-5xl font-black leading-none" style={{ color: pctColor }}>
                {pctSemana}%
              </p>
            </div>
            {/* Right: title */}
            <div className="text-left md:text-right w-full md:w-auto pt-3 md:pt-0 border-t border-gray-100 md:border-0 mt-1 md:mt-0">
              <p className="text-lg md:text-xl font-black text-black uppercase tracking-wider leading-tight">
                PROGRAMAÇÃO SEMANAL ({ordLabel})
              </p>
              <p className="text-xs text-black mt-1">
                {ORDINAL[mesAtivo]?.replace("ª","°")} {MESES[mesAtivo - 1]} — {anoAtivo} &nbsp;·&nbsp; SEMANA {semanaIsoAtiva}
              </p>
            </div>
          </div>
        </div>

        {/* Table PREVENTIVAS */}
        <div className="p-4 flex flex-col gap-3">
          <TableHeader tipo="PREVENTIVA" />
          {preventivas.length > 0
            ? preventivas.map(item => <StatusRow key={item.id} item={item} />)
            : <div className="py-6 text-center text-zinc-700 text-xs">Nenhuma preventiva nesta semana. Clique em "+ Adicionar".</div>
          }

          {/* Documentação section */}
          {documentos.length > 0 && (
            <>
              <div className="h-px bg-white mt-1" />
              <TableHeader tipo="DOCUMENTAÇÃO" />
              {documentos.map(item => <StatusRow key={item.id} item={item} />)}
            </>
          )}
        </div>
      </div>

      {showForm && (
        <ProgSemanalForm
          item={editItem}
          equipamentos={equipamentos}
          mesAtivo={mesAtivo}
          anoAtivo={anoAtivo}
          semanaIso={semanaIsoAtiva}
          weekInfo={weekInfo}
          semanasDoMes={semanasDoMes}
          calendario={calendario}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TAB: PLANEJAMENTO MENSAL (computed read-only)
// ════════════════════════════════════════════════════════════════════════
function TabPlanejamento({ mensaisComputado, anoAtivo, mesAtivo }: {
  mensaisComputado: { mes: number; mesAbr: string; meta: number; realizado: number | null }[]
  anoAtivo: number; mesAtivo: number
}) {
  const chartData = mensaisComputado.map(m => ({ mes: m.mesAbr, META: m.meta, REALIZADO: m.realizado }))
  const mesAtual = mensaisComputado.find(m => m.mes === mesAtivo)

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xl font-black text-gray-900 uppercase text-center tracking-widest">
        KPI de Manutenção — {anoAtivo}
      </p>
      <p className="text-xs text-gray-500 text-center -mt-4">
        Calculado automaticamente a partir dos lançamentos da Programação Semanal
      </p>

      {/* Chart */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mb-4 text-center">
          Resultado Mensal de Programação Preventiva
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} />
            <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" domain={[0, 110]} />
            <ReTooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
            <Line type="monotone" dataKey="META" stroke="#1e4d2b" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4, fill: "#1e4d2b", strokeWidth: 0 }}>
              <LabelList dataKey="META" position="top" formatter={(val: any) => val != null ? `${val}%` : ""} fill="#1e4d2b" fontSize={11} fontWeight="bold" />
            </Line>
            <Line type="monotone" dataKey="REALIZADO" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 5, fill: "#ef4444", strokeWidth: 0 }} connectNulls={false}>
              <LabelList dataKey="REALIZADO" position="bottom" formatter={(val: any) => val != null ? `${val}%` : ""} fill="#ef4444" fontSize={11} fontWeight="bold" />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Metas Mensais</p>
          <span className="text-[10px] text-gray-400">Calculado dos lançamentos semanais</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px] md:min-w-0">
            <thead>
              <tr className="border-b border-gray-200">
                {["Mês Operacional","Total OS","Concluídas","% Realizado","Status"].map(h => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-500 uppercase ${h === "Mês Operacional" ? "text-left" : "text-center"}`}>{h}</th>
                ))}
              </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {mensaisComputado.map(m => {
              const ok = m.realizado != null && m.realizado >= m.meta
              return (
                <tr key={m.mes} className={`transition-colors ${m.mes === mesAtivo ? "bg-green-900/10" : "hover:bg-gray-50/40"}`}>
                  <td className="px-4 py-3 font-semibold text-gray-700">{ORDINAL[m.mes]} {MESES[m.mes - 1]}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{m.realizado != null ? "—" : "—"}</td>
                  <td className="px-4 py-3 text-center text-gray-600">—</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-bold text-sm px-3 py-0.5 rounded-full ${
                      m.realizado == null ? "text-gray-400"
                        : ok ? "text-emerald-400 bg-emerald-900/20"
                          : "text-red-400 bg-red-900/20"}`}>
                      {m.realizado != null ? `${m.realizado}%` : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-[10px] font-bold">
                    {m.realizado == null ? <span className="text-gray-400">SEM DADOS</span>
                      : ok ? <span className="text-emerald-400">✅ ATINGIU</span>
                           : <span className="text-red-400">❌ NÃO ATINGIU</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TAB: METAS SEMANAIS (computed read-only)
// ════════════════════════════════════════════════════════════════════════
function TabSemanais({ semanaisComputado, anoAtivo, mesAtivo }: {
  semanaisComputado: {
    semana_iso: number; semana_numero: number; label: string; fullLabel: string
    data_inicio: string | null; data_fim: string | null
    meta: number; realizado: number; total: number; concluidos: number
  }[]
  anoAtivo: number; mesAtivo: number
}) {
  const chartData = semanaisComputado.map(s => ({
    semana: s.label, META: s.meta, REALIZADO: s.realizado,
    periodo: s.data_inicio ? `${fmtBR(s.data_inicio)} À ${fmtBR(s.data_fim)}` : "—",
  }))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xl font-black text-gray-900 uppercase text-center tracking-widest">
        Acompanhamento Semanal — {MESES[mesAtivo - 1]} {anoAtivo}
      </p>

      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 24, right: 16, left: -20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" vertical={false} />
              <XAxis dataKey="semana" tick={{ fill: "#64748b", fontSize: 11 }} angle={-15} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" domain={[0, 110]} />
              <ReTooltip content={({ active, payload, label }: any) => {
                if (!active || !payload?.length) return null
                const d = payload[0]?.payload
                return (
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-xl">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">{label}</p>
                    <p className="text-[10px] text-gray-500 mb-2">{d?.periodo}</p>
                    {payload.map((p: any, i: number) => (
                      <p key={i} style={{ color: p.fill ?? p.color }} className="text-sm font-bold">
                        {p.name}: {p.value}%
                      </p>
                    ))}
                  </div>
                )
              }} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              <Bar dataKey="META" fill="#1e4d2b" radius={[3, 3, 0, 0]}
                label={{ position: "top", fill: "#94a3b8", fontSize: 10, formatter: (v: any) => `${v}%` }} />
              <Bar dataKey="REALIZADO" radius={[3, 3, 0, 0]}
                label={{ position: "top", fill: "#60a5fa", fontSize: 11, fontWeight: 700, formatter: (v: any) => v != null ? `${v}%` : "" }}>
                {chartData.map((_, i) => <Cell key={i} fill={_ .REALIZADO >= 100 ? "#22c55e" : _.REALIZADO >= 50 ? "#f59e0b" : "#ef4444"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            Nenhum lançamento em {MESES[mesAtivo - 1]}. Use a aba Programação Semanal para lançar.
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Resumo por Semana</p>
        </div>
        {semanaisComputado.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">Sem dados para {MESES[mesAtivo - 1]}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px] md:min-w-0">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Semana","N° ISO","Período","Total","Concluídas","% Realizado","Status"].map(h => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-bold text-gray-500 uppercase ${h === "Semana" || h === "Período" ? "text-left" : "text-center"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
            <tbody className="divide-y divide-zinc-900">
              {semanaisComputado.map(s => {
                const ok = s.realizado >= s.meta
                return (
                  <tr key={s.semana_iso} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-700">{s.fullLabel}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-white text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                        S{String(s.semana_iso).padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-[11px] font-mono">
                      {s.data_inicio ? `${fmtBR(s.data_inicio)} À ${fmtBR(s.data_fim)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600">{s.total}</td>
                    <td className="px-4 py-3 text-center text-emerald-400 font-bold">{s.concluidos}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold text-sm px-3 py-0.5 rounded-full ${
                        ok ? "text-emerald-400 bg-emerald-900/20" : "text-red-400 bg-red-900/20"}`}>
                        {s.realizado}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-[10px] font-bold">
                      {ok ? <span className="text-emerald-400">✅ ATINGIU</span> : <span className="text-red-400">❌ ABAIXO</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// TAB: PROVISIONAMENTO (computed read-only)
// ════════════════════════════════════════════════════════════════════════
function TabProvisionamento({ provComputado, semanasDoMes, mesAtivo, calMes }: {
  provComputado: ProgSemanal[]
  semanasDoMes: WeekInfo[]
  mesAtivo: number
  calMes?: { data_inicio: string; data_fim: string }
}) {
  const concluidos  = provComputado.filter(p => p.status === "CONCLUÍDO").length
  const emAndamento = provComputado.filter(p => p.status === "EM ANDAMENTO").length
  const reprog      = provComputado.filter(p => p.status === "REPROGRAMADO").length
  const pct         = provComputado.length > 0 ? Math.round(concluidos / provComputado.length * 100) : 0

  const statusData = [
    { name: "CONCLUÍDO",    value: concluidos  },
    { name: "EM ANDAMENTO", value: emAndamento },
    { name: "REPROG.",      value: reprog       },
    { name: "PROGRAMADO",   value: provComputado.filter(p => p.status === "PROGRAMADO").length },
  ].filter(d => d.value > 0)

  const catData = useMemo(() => {
    const m = new Map<string, number>()
    provComputado.forEach(p => {
      const k = p.categoria_operacional ?? "N/A"
      m.set(k, (m.get(k) ?? 0) + 1)
    })
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [provComputado])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest">
          Provisionamento das Preventivas — {MESES[mesAtivo - 1]}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Periodicidade: COMBOIO 550hr / RIPA – MUNCK – MULT 500hr · Dados da Programação Semanal
        </p>
        {calMes && (
          <p className="text-[11px] text-green-500 mt-0.5">
            📅 {fmtBR(calMes.data_inicio)} → {fmtBR(calMes.data_fim)}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: provComputado.length, color: "#22c55e" },
          { label: "Concluídas", value: concluidos, color: "#22c55e" },
          { label: "Em Andamento", value: emAndamento, color: "#3b82f6" },
          { label: "% Execução", value: `${pct}%`, color: pct >= 100 ? "#22c55e" : "#f59e0b" },
        ].map(k => (
          <div key={k.label} className="relative rounded-2xl border border-gray-200 bg-white p-4 overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-2xl" style={{ background: k.color }} />
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{k.label}</p>
            <p className="text-3xl font-black mt-1" style={{ color: k.color }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-bold text-gray-600 uppercase mb-4 text-center">Status</p>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusData} margin={{ top: 20, right: 10, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <ReTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Qtd" radius={[4, 4, 0, 0]}
                  label={{ position: "top", fill: "#e2e8f0", fontSize: 13, fontWeight: 700 }}>
                  {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados</div>}
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-bold text-gray-600 uppercase mb-4 text-center">Categoria Operacional</p>
          {catData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={catData} margin={{ top: 20, right: 10, left: -20, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
                <ReTooltip content={<ChartTooltip />} />
                <Bar dataKey="value" name="Qtd" fill="#1e4d2b" radius={[4, 4, 0, 0]}
                  label={{ position: "top", fill: "#e2e8f0", fontSize: 13, fontWeight: 700 }} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="flex items-center justify-center h-40 text-gray-400 text-sm">Sem dados</div>}
        </div>
      </div>

      {/* Detail table */}
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">Detalhe por Semana</p>
          <span className="text-[10px] text-gray-400">{provComputado.length} registros</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {["Semana","Período","Categoria","Placa","MPBT","Status","Início","Término","Dias"].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {provComputado.map(p => {
                const wi = semanasDoMes.find(w => w.semana_iso === (p.semana_iso ?? 0))
                return (
                  <tr key={p.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="bg-white text-gray-700 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                        S{String(p.semana_iso ?? "—").padStart(2, "0")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-[11px] font-mono">
                      {wi ? `${fmtBR(wi.data_inicio)} À ${fmtBR(wi.data_fim)}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-bold text-green-400 bg-green-900/20 px-2 py-0.5 rounded-full">
                        {p.categoria_operacional ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black text-amber-400">{p.placa ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600 text-[11px] max-w-[200px] truncate" title={p.mpbt ?? ""}>{p.mpbt ?? "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-gray-500 text-[11px] font-mono">{fmtBR(p.data_inicio_exec)}</td>
                    <td className="px-4 py-3 text-gray-500 text-[11px] font-mono">{fmtBR(p.data_fim_exec ?? p.termino)}</td>
                    <td className="px-4 py-3 text-gray-500 text-[11px]">{p.dias ?? "—"}</td>
                  </tr>
                )
              })}
              {provComputado.length === 0 && (
                <tr><td colSpan={9} className="py-12 text-center text-gray-400 text-sm">
                  Nenhum dado em {MESES[mesAtivo - 1]}. Lance dados na aba Programação Semanal.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════
// FORM
// ════════════════════════════════════════════════════════════════════════
function ProgSemanalForm({
  item, equipamentos, mesAtivo, anoAtivo, semanaIso, weekInfo, semanasDoMes, calendario, onClose,
}: {
  item: ProgSemanal | null
  equipamentos: { id: string; placa: string; categoria?: string }[]
  mesAtivo: number; anoAtivo: number
  semanaIso: number; weekInfo: WeekInfo | undefined
  semanasDoMes: WeekInfo[]
  calendario: { mes: number; ano: number; data_inicio: string; data_fim: string }[]
  onClose: () => void
}) {
  const [isPending, startT] = useTransition()
  const { isOnline } = useOffline()

  // ── Semana period (week range) ──────────────────────────────────────
  const [semanaIsoForm, setSemanaIsoForm] = useState<string>(
    String(item?.semana_iso ?? semanaIso)
  )
  const [periodoIni, setPeriodoIni] = useState<string>(
    item?.data_inicio ?? weekInfo?.data_inicio ?? ""
  )
  const [periodoFim, setPeriodoFim] = useState<string>(
    item?.data_fim ?? weekInfo?.data_fim ?? ""
  )

  // Auto-fill period from week number
  const calcFromWeekNum = useCallback(() => {
    const w = parseInt(semanaIsoForm)
    if (isNaN(w) || w < 1 || w > 53) return
    setPeriodoIni(mondayClient(w, anoAtivo))
    setPeriodoFim(sundayClient(w, anoAtivo))
  }, [semanaIsoForm, anoAtivo])

  // Auto-fill week number from start date
  const calcFromDate = useCallback((dateStr: string) => {
    if (!dateStr) return
    const w = isoWeekClient(dateStr)
    setSemanaIsoForm(String(w))
    setPeriodoFim(sundayClient(w, anoAtivo))
  }, [anoAtivo])

  // Determine mes_numero from the week's start date
  const mesNumeroForWeek = useMemo(() => {
    if (!periodoIni) return mesAtivo
    const iniDate = toDate(periodoIni)
    const found = calendario.find(c => {
      const s = toDate(c.data_inicio); const e = toDate(c.data_fim + "T23:59:59")
      return iniDate >= s && iniDate <= e
    })
    return found?.mes ?? mesAtivo
  }, [periodoIni, calendario, mesAtivo])

  const semNumeroForWeek = useMemo(() => {
    const wi = semanasDoMes.find(w => w.semana_iso === parseInt(semanaIsoForm))
    return wi?.semana_numero ?? 1
  }, [semanasDoMes, semanaIsoForm])

  // ── Item fields ─────────────────────────────────────────────────────
  const [form, setForm] = useState({
    tipo:                  item?.tipo ?? "PREVENTIVA",
    status:                item?.status ?? "PROGRAMADO",
    modulo:                item?.modulo ?? "",
    categoria_operacional: item?.categoria_operacional ?? "COMBOIO",
    placa:                 item?.placa ?? "",
    mpbt:                  item?.mpbt ?? "",
    percentual:            item?.percentual != null ? String(item.percentual) : "",
    data_inicio_exec:      item?.data_inicio_exec ?? "",
    data_fim_exec:         item?.data_fim_exec ?? item?.termino ?? "",
    dias:                  item?.dias != null ? String(item.dias) : "",
    horimetro_dia:         item?.horimetro_dia ?? "",
    observacoes:           item?.observacoes ?? "",
  })

  const set = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))

  // Auto-set percentual from status
  const handleStatus = (v: string) => {
    set("status", v)
    if (v === "CONCLUÍDO") set("percentual", "100")
    else if (v === "PROGRAMADO" || v === "REPROGRAMADO") set("percentual", "0")
  }

  // Auto-calc dias
  const handleTermino = (v: string) => {
    set("data_fim_exec", v)
    if (form.data_inicio_exec && v) {
      const d1 = toDate(form.data_inicio_exec); const d2 = toDate(v)
      const d = Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1
      if (d > 0) set("dias", String(d))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const w = parseInt(semanaIsoForm)
    const payload: Omit<ProgSemanal, "id" | "created_at"> = {
      ano: anoAtivo,
      mes_numero:   mesNumeroForWeek,
      semana_numero: semNumeroForWeek,
      semana_iso:    isNaN(w) ? null : w,
      semana_global: isNaN(w) ? null : w,
      data_inicio:   periodoIni || null,
      data_fim:      periodoFim || null,
      modulo:        form.modulo || null,
      categoria_operacional: form.categoria_operacional || null,
      placa:         form.placa || null,
      mpbt:          form.mpbt || null,
      tipo:          form.tipo,
      status:        form.status,
      data_inicio_exec: form.data_inicio_exec || null,
      data_fim_exec:    form.data_fim_exec || null,
      termino:          form.data_fim_exec || null,
      dias:          form.dias ? parseInt(form.dias) : null,
      percentual:    form.percentual ? parseFloat(form.percentual) : null,
      horimetro_dia: form.horimetro_dia || null,
      observacoes:   form.observacoes || null,
    }
    startT(async () => {
      if (isOnline) {
        try {
          const res = item ? await atualizarProgSemanal(item.id, payload) : await criarProgSemanal(payload)
          if (res?.error) {
            alert("Erro ao salvar no banco de dados:\\n" + res.error)
            return
          }
          window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
        } catch (err: any) {
          alert("Erro ao salvar no banco de dados:\\n" + (err?.message || String(err)))
          return
        }
      } else {
        const id = item?.id || `temp_${Date.now()}`
        const localData = { ...payload, id, _isPendingSync: true }
        await localDb.put("prev_prog_semanal", localData)
        await localDb.addToQueue("prev_prog_semanal", item ? "update" : "create", item ? { id, data: payload } : payload)
        window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
        alert("✅ Programação salva localmente! Será sincronizada assim que você estiver online.")
      }
      onClose()
    })
  }

  // Period display label
  const semanaLabel = semanaIsoForm
    ? `${periodoIni ? fmtBR(periodoIni) : "—"} À ${periodoFim ? fmtBR(periodoFim) : "—"} — SEMANA ${semanaIsoForm}`
    : ""

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[95vh] flex flex-col my-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div>
            <h3 className="font-bold text-gray-900 text-lg">
              {item ? "✏️ Editar" : "➕ Novo"} Lançamento
            </h3>
            {semanaLabel && (
              <p className="text-xs text-red-400 font-bold mt-1">{semanaLabel}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 mt-1"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Tipo + Status */}
          <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Tipo</label>
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)} className={inp}>
                {TIPO_OPT.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Status</label>
              <select value={form.status} onChange={e => handleStatus(e.target.value)} className={inp}>
                {STATUS_OPT.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Semana ISO + Período */}
          <div className="rounded-xl border border-gray-300 bg-gray-50/60 p-4 flex flex-col gap-3">
            <p className={lbl}>Semana & Período</p>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end flex-wrap w-full">
              <div className="w-28">
                <label className={lbl}>N° Semana (ISO)</label>
                <input type="number" min={1} max={53} value={semanaIsoForm}
                  onChange={e => setSemanaIsoForm(e.target.value)}
                  onBlur={calcFromWeekNum}
                  className={inp} placeholder="ex: 15" />
              </div>
              <button type="button" onClick={calcFromWeekNum}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-zinc-600 transition-colors mb-0.5">
                <RefreshCw size={12} /> Auto-preencher datas
              </button>
              <div className="flex-1 min-w-[180px]">
                <label className={lbl}>Início da Semana (Seg)</label>
                <input type="date" value={periodoIni}
                  onChange={e => { setPeriodoIni(e.target.value); calcFromDate(e.target.value) }}
                  className={inp} />
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className={lbl}>Fim da Semana (Dom)</label>
                <input type="date" value={periodoFim}
                  onChange={e => setPeriodoFim(e.target.value)}
                  className={inp} />
              </div>
            </div>
            {semanaLabel && (
              <p className="text-[11px] text-red-400 font-bold">{semanaLabel}</p>
            )}
          </div>

          {/* Módulo + C.O + Placa */}
          <div className="flex flex-col md:grid md:grid-cols-3 gap-3">
            <div>
              <label className={lbl}>Módulo</label>
              <input type="text" value={form.modulo}
                onChange={e => set("modulo", e.target.value)}
                placeholder="ex: RESERVA, MOD 5" className={inp} />
            </div>
            <div>
              <label className={lbl}>Categoria (C.O)</label>
              <select value={form.categoria_operacional}
                onChange={e => set("categoria_operacional", e.target.value)} className={inp}>
                <option value="">— selecione —</option>
                {CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Placa</label>
              <SearchableSelect 
                options={equipamentos.map(eq => ({ value: eq.placa, label: eq.placa }))}
                value={form.placa} 
                onChange={val => set("placa", val)}
              />
            </div>
          </div>

          {/* MPBT */}
          <div>
            <label className={lbl}>MPBT — {form.tipo === "PREVENTIVA" ? "Preventivas Programadas" : "Documentação"}</label>
            <input type="text" value={form.mpbt}
              onChange={e => set("mpbt", e.target.value)}
              placeholder={form.tipo === "PREVENTIVA"
                ? "ex: PLANO DE MANUTENÇÃO (REVISÃO DE 500 HORAS)"
                : "ex: LAUDO ELETROMECÂNICO (VENCIMENTO 21/4)"}
              className={inp} />
          </div>

          {/* Execução */}
          <div className="flex flex-col md:grid md:grid-cols-4 gap-3">
            <div>
              <label className={lbl}>% Realizado</label>
              <input type="number" min={0} max={100} step={1} value={form.percentual}
                onChange={e => set("percentual", e.target.value)} className={inp} placeholder="0-100" />
            </div>
            <div>
              <label className={lbl}>Início Execução</label>
              <input type="date" value={form.data_inicio_exec}
                onChange={e => set("data_inicio_exec", e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Término</label>
              <input type="date" value={form.data_fim_exec}
                onChange={e => handleTermino(e.target.value)} className={inp} />
            </div>
            <div>
              <label className={lbl}>Dias</label>
              <input type="number" min={0} value={form.dias}
                onChange={e => set("dias", e.target.value)} className={inp} placeholder="auto" />
            </div>
          </div>

          {/* Horímetro + Obs */}
          <div className="flex flex-col md:grid md:grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Horímetro do Dia</label>
              <input type="text" value={form.horimetro_dia}
                onChange={e => set("horimetro_dia", e.target.value)} className={inp} placeholder="ex: 13.095" />
            </div>
            <div>
              <label className={lbl}>Observações (opcional)</label>
              <input type="text" value={form.observacoes}
                onChange={e => set("observacoes", e.target.value)} className={inp} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-white transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className={`px-5 py-2 text-sm rounded-lg font-bold transition-colors ${
                isPending ? "bg-green-600/60 cursor-not-allowed text-white flex items-center gap-2" : "bg-green-600 text-white hover:bg-green-500"
              }`}>
              {isPending && <RefreshCw size={14} className="animate-spin" />}
              {isPending ? "Salvando..." : item ? "💾 Salvar" : "➕ Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
