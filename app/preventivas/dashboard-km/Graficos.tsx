'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LineChart, Line } from 'recharts'
import {
  fmtNum, fmtData, rotuloMes, serieTemporal, usoPorTipo, usoDaLinha, media,
  type LinhaPlaca, type Periodo, type Unidade, type VisaoMedia, type PontoClassificado,
} from '@/lib/horimetro-km-calc'

export const COR: Record<Unidade, string> = { h: '#059669', km: '#2563eb' }
const EIXO = { fontSize: 11, fill: '#71717a' }
const GRADE = '#e4e4e7'

export function CardGrafico({ titulo, sub, acao, children }: { titulo: string; sub?: string; acao?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{titulo}</h3>
          {sub && <p className="text-[11px] text-zinc-500">{sub}</p>}
        </div>
        {acao}
      </div>
      {children}
    </div>
  )
}

const Vazio = () => <div className="h-[220px] flex items-center justify-center text-sm text-zinc-400">Nenhuma leitura no período</div>

function TooltipBox({ titulo, valor, unidade }: { titulo: string; valor: number; unidade: Unidade }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-zinc-800 dark:text-zinc-100">{titulo}</div>
      <div className="tabular-nums text-zinc-600 dark:text-zinc-300">{fmtNum(valor, 1)} {unidade}</div>
    </div>
  )
}

/** Conteúdo do tooltip: rótulo + valor na unidade. */
const tooltip = (unidade: Unidade) => function Tip(p: TooltipProps<ValueType, NameType>) {
  const d = p.payload?.[0]?.payload as { rotulo: string; valor: number } | undefined
  return p.active && d ? <TooltipBox titulo={d.rotulo} valor={d.valor} unidade={unidade} /> : null
}

export function UsoMensalChart({ linhas, unidade, periodo, visao }: { linhas: LinhaPlaca[]; unidade: Unidade; periodo: Periodo; visao: VisaoMedia }) {
  const dados = useMemo(() => serieTemporal(linhas, unidade, periodo, visao).map(d => ({ ...d, rotulo: rotuloMes(d.chave) })), [linhas, unidade, periodo, visao])
  const med = media(dados.map(d => d.valor))
  if (!dados.some(d => d.valor > 0)) return <Vazio />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} width={56} tickFormatter={v => fmtNum(Number(v))} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={tooltip(unidade)} />
        <Bar dataKey="valor" fill={COR[unidade]} radius={[4, 4, 0, 0]} maxBarSize={48} />
        {med != null && (
          <ReferenceLine y={med} stroke="#a1a1aa" strokeDasharray="4 4"
            label={{ value: `média ${fmtNum(med)} ${unidade}`, position: 'insideTopRight', fontSize: 11, fill: '#52525b' }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RankingChart({ linhas, unidade, onSelecionar }: { linhas: LinhaPlaca[]; unidade: Unidade; onSelecionar: (l: LinhaPlaca) => void }) {
  const [todas, setTodas] = useState(false)
  const ordenado = useMemo(() => linhas
    .map(l => ({ linha: l, r: usoDaLinha(l, unidade) }))
    .filter((x): x is { linha: LinhaPlaca; r: NonNullable<typeof x.r> } => !!x.r && x.r.temLeituraNoPeriodo)
    .sort((a, b) => b.r.uso - a.r.uso)
    .map(x => ({ rotulo: x.linha.equipamento.placa, valor: x.r.uso, linha: x.linha })), [linhas, unidade])
  const dados = todas ? ordenado : ordenado.slice(0, 10)
  if (!dados.length) return <Vazio />
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 28 + 20)}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke={GRADE} strokeDasharray="3 3" />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(Number(v))} />
          <YAxis type="category" dataKey="rotulo" tick={{ ...EIXO, fontWeight: 600 }} axisLine={false} tickLine={false} width={72} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={tooltip(unidade)} />
          <Bar dataKey="valor" fill={COR[unidade]} radius={[0, 4, 4, 0]} barSize={16} cursor="pointer"
            onClick={(d: unknown) => { const l = (d as { linha?: LinhaPlaca } | null)?.linha; if (l) onSelecionar(l) }}
            label={{ position: 'right', fontSize: 11, fill: '#52525b', formatter: (v: number) => fmtNum(v) }} />
        </BarChart>
      </ResponsiveContainer>
      {ordenado.length > 10 && (
        <button type="button" onClick={() => setTodas(t => !t)} className="self-start text-xs font-semibold text-blue-600 hover:underline">
          {todas ? 'Mostrar top 10' : `Ver todas (${ordenado.length})`}
        </button>
      )}
    </div>
  )
}

export function UsoPorTipoChart({ linhas, unidade }: { linhas: LinhaPlaca[]; unidade: Unidade }) {
  const dados = useMemo(() => usoPorTipo(linhas, unidade).map(d => ({ rotulo: d.tipo, valor: d.valor, placas: d.placas })), [linhas, unidade])
  if (!dados.some(d => d.valor > 0)) return <Vazio />
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 30 + 20)}>
      <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={GRADE} strokeDasharray="3 3" />
        <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(Number(v))} />
        <YAxis type="category" dataKey="rotulo" tick={{ ...EIXO, fontWeight: 600 }} axisLine={false} tickLine={false} width={104} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={tooltip(unidade)} />
        <Bar dataKey="valor" fill={COR[unidade]} radius={[0, 4, 4, 0]} barSize={16}
          label={{ position: 'right', fontSize: 11, fill: '#52525b', formatter: (v: number) => fmtNum(v) }} />
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Evolução da leitura acumulada (só leituras válidas). */
export function EvolucaoChart({ pontos, unidade, altura = 240 }: { pontos: PontoClassificado[]; unidade: Unidade; altura?: number }) {
  const dados = pontos.filter(p => !p.inconsistente).map(p => ({ rotulo: fmtData(p.data), valor: p.valor }))
  if (!dados.length) return <Vazio />
  const vals = dados.map(d => d.valor)
  const min = Math.min(...vals), max = Math.max(...vals)
  const folga = Math.max(1, (max - min) * 0.1)
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <LineChart data={dados} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} width={64} domain={[Math.floor(min - folga), Math.ceil(max + folga)]} tickFormatter={v => fmtNum(Number(v))} />
        <Tooltip content={tooltip(unidade)} />
        <Line type="monotone" dataKey="valor" stroke={COR[unidade]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: COR[unidade] }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
