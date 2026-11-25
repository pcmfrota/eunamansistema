'use client'

import type { ReactNode } from 'react'
import { Truck, Clock, Route, Activity, AlertTriangle, AlertOctagon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtNum, variacaoPercentual, type Kpis, type VisaoMedia } from '@/lib/horimetro-km-calc'

type CardProps = {
  titulo: string
  valor: ReactNode
  sub?: ReactNode
  icone: ReactNode
  /** Variação % contra o período anterior; null = sem base de comparação. */
  variacao: number | null
  /** true quando subir é ruim (alertas) — inverte a cor da variação. */
  subirEhRuim?: boolean
  alerta?: boolean
  rotulo: string
}

function Variacao({ v, subirEhRuim, rotulo }: { v: number | null; subirEhRuim?: boolean; rotulo: string }) {
  if (v == null) return <span className="text-[11px] text-zinc-400">sem base de comparação</span>
  const zero = Math.abs(v) < 0.05
  const bom = zero ? null : (v > 0) !== !!subirEhRuim
  const cor = zero ? 'text-zinc-500' : bom ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
  const Icone = zero ? Minus : v > 0 ? TrendingUp : TrendingDown
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${cor}`}>
      <Icone size={12} /> {v > 0 ? '+' : ''}{fmtNum(v, 1)}% <span className="font-normal text-zinc-400">vs. {rotulo}</span>
    </span>
  )
}

function CardBase({ titulo, valor, sub, icone, variacao, subirEhRuim, alerta, rotulo }: CardProps) {
  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-2 bg-white dark:bg-zinc-900 ${alerta ? 'border-red-200 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">{titulo}</span>
        <span className={alerta ? 'text-red-500' : 'text-zinc-400'}>{icone}</span>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums leading-none ${alerta ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{valor}</div>
      {sub && <div className="text-[11px] text-zinc-500 tabular-nums">{sub}</div>}
      <Variacao v={variacao} subirEhRuim={subirEhRuim} rotulo={rotulo} />
    </div>
  )
}

export function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[118px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />)}
    </div>
  )
}

export default function KpiCards({ atual, anterior, visao, temAnterior, rotuloComparacao = 'período anterior' }: { atual: Kpis; anterior: Kpis; visao: VisaoMedia; temAnterior: boolean; rotuloComparacao?: string }) {
  const Card = (p: Omit<CardProps, 'rotulo'>) => CardBase({ ...p, rotulo: rotuloComparacao })
  const v = (a: number | null, b: number | null) => (temAnterior && a != null ? variacaoPercentual(a, b) : null)
  const rotuloMedia = visao === 'mensal' ? 'Média mensal / equip.' : 'Média anual / equip.'
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      <Card titulo="Frotas ativas" icone={<Truck size={16} />} valor={fmtNum(atual.frotas)} sub="no filtro aplicado" variacao={null} />
      <Card titulo="Horas rodadas" icone={<Clock size={16} className="text-emerald-600" />}
        valor={<>{fmtNum(atual.horasTotais)}<span className="text-sm font-bold text-emerald-600 ml-1">h</span></>} sub="Pesados (horímetro)"
        variacao={v(atual.horasTotais, anterior.horasTotais)} />
      <Card titulo="KM rodados" icone={<Route size={16} className="text-blue-600" />}
        valor={<>{fmtNum(atual.kmTotais)}<span className="text-sm font-bold text-blue-600 ml-1">km</span></>} sub="Leves (KM)"
        variacao={v(atual.kmTotais, anterior.kmTotais)} />
      <Card titulo={rotuloMedia} icone={<Activity size={16} />}
        valor={<span className="text-lg"><span className="text-emerald-700 dark:text-emerald-400">{fmtNum(atual.mediaH)} h</span> <span className="text-zinc-300">·</span> <span className="text-blue-700 dark:text-blue-400">{fmtNum(atual.mediaKm)} km</span></span>}
        sub="pesados · leves"
        variacao={v(atual.mediaH ?? null, anterior.mediaH)} />
      <Card titulo="Sem leitura no período" icone={<AlertTriangle size={16} />} alerta={atual.semLeitura > 0}
        valor={fmtNum(atual.semLeitura)} sub="placas ativas" variacao={v(atual.semLeitura, anterior.semLeitura)} subirEhRuim />
      <Card titulo="Inconsistências" icone={<AlertOctagon size={16} />} alerta={atual.inconsistencias > 0}
        valor={fmtNum(atual.inconsistencias)} sub="leituras fora da sequência" variacao={v(atual.inconsistencias, anterior.inconsistencias)} subirEhRuim />
    </div>
  )
}
