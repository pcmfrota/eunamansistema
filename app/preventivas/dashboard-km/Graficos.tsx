'use client'

import { useMemo, useState, type ReactNode } from 'react'
import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, LineChart, Line, LabelList } from 'recharts'
import {
  sigla, fmtNum, fmtData, rotuloMes, serieTemporal, usoPorTipo, usoDaLinha, usoValido, media,
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

type PropsRotulo = { x?: number | string; y?: number | string; width?: number | string; value?: unknown }

/**
 * Valor em cima da barra numa linha só ("10.460 H"). O rótulo padrão do recharts quebra o texto
 * na largura da barra — em barra estreita o "H" ia pra linha de baixo e o número estourava o topo.
 * `vertical`: texto em pé (usado na barra do ano anterior, pra não encavalar com a do ano atual).
 */
export function rotuloTopo(unidade: Unidade, opts: { fontSize?: number; cor?: string; negrito?: boolean; vertical?: boolean; casas?: number } = {}) {
  return function RotuloTopo(p: PropsRotulo) {
    const v = Number(p.value)
    if (!(v > 0)) return null
    const cx = Number(p.x) + Number(p.width) / 2
    const y = Number(p.y)
    const texto = `${fmtNum(v, opts.casas ?? 0)} ${sigla(unidade)}`
    const comum = { fontSize: opts.fontSize ?? 10, fontWeight: opts.negrito === false ? 500 : 700, fill: opts.cor ?? '#3f3f46' }
    return opts.vertical
      ? <text transform={`translate(${cx + 3},${y - 4}) rotate(-90)`} textAnchor="start" {...comum}>{texto}</text>
      : <text x={cx} y={y - 6} textAnchor="middle" {...comum}>{texto}</text>
  }
}

/** Folga acima da barra mais alta, pro rótulo não ser cortado. */
export const dominioComFolga = (folga = 1.12) => [0, (max: number) => (max > 0 ? Math.ceil(max * folga) : 1)] as [number, (max: number) => number]

const Vazio = () => <div className="h-[220px] flex items-center justify-center text-sm text-zinc-400">Nenhuma leitura no período</div>

function TooltipBox({ titulo, valor, unidade }: { titulo: string; valor: number; unidade: Unidade }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-zinc-800 dark:text-zinc-100">{titulo}</div>
      <div className="tabular-nums text-zinc-600 dark:text-zinc-300">{fmtNum(valor, 1)} {sigla(unidade)}</div>
    </div>
  )
}

/** Conteúdo do tooltip: rótulo + valor na unidade. */
const tooltip = (unidade: Unidade) => function Tip(p: TooltipProps<ValueType, NameType>) {
  const d = p.payload?.[0]?.payload as { rotulo: string; valor: number } | undefined
  return p.active && d ? <TooltipBox titulo={d.rotulo} valor={d.valor} unidade={unidade} /> : null
}

export function UsoMensalChart({ linhas, unidade, periodo, visao, meses }: { linhas: LinhaPlaca[]; unidade: Unidade; periodo: Periodo; visao: VisaoMedia; meses?: string[] }) {
  const dados = useMemo(() => serieTemporal(linhas, unidade, periodo, visao)
    .filter(d => !meses?.length || visao !== 'mensal' || meses.includes(d.chave))
    .map(d => ({ ...d, rotulo: rotuloMes(d.chave) })), [linhas, unidade, periodo, visao, meses])
  const med = media(dados.map(d => d.valor))
  if (!dados.some(d => d.valor > 0)) return <Vazio />
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={dados} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} width={56} domain={dominioComFolga()} tickFormatter={v => fmtNum(Number(v))} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={tooltip(unidade)} />
        <Bar dataKey="valor" fill={COR[unidade]} radius={[4, 4, 0, 0]} maxBarSize={48}>
          <LabelList dataKey="valor" content={rotuloTopo(unidade, { fontSize: 11 })} />
        </Bar>
        {med != null && (
          <ReferenceLine y={med} stroke="#a1a1aa" strokeDasharray="4 4"
            label={{ value: `média ${fmtNum(med)} ${sigla(unidade)}`, position: 'insideTopRight', fontSize: 11, fill: '#52525b' }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  )
}

export function RankingChart({ linhas, unidade, onSelecionar }: { linhas: LinhaPlaca[]; unidade: Unidade; onSelecionar: (l: LinhaPlaca) => void }) {
  const [todas, setTodas] = useState(false)
  const ordenado = useMemo(() => linhas
    .map(l => ({ linha: l, r: usoDaLinha(l, unidade) }))
    .filter((x): x is { linha: LinhaPlaca; r: NonNullable<typeof x.r> } => usoValido(x.r) != null)
    .sort((a, b) => b.r.uso - a.r.uso)
    .map(x => ({ rotulo: x.linha.equipamento.placa, valor: x.r.uso, linha: x.linha })), [linhas, unidade])
  const dados = todas ? ordenado : ordenado.slice(0, 10)
  if (!dados.length) return <Vazio />
  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 28 + 20)}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 64, left: 0, bottom: 0 }} style={{ cursor: 'pointer' }}
            onClick={(st: unknown) => { const l = (st as { activePayload?: { payload?: { linha?: LinhaPlaca } }[] } | null)?.activePayload?.[0]?.payload?.linha; if (l) onSelecionar(l) }}>
          <CartesianGrid horizontal={false} stroke={GRADE} strokeDasharray="3 3" />
          <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(Number(v))} />
          <YAxis type="category" dataKey="rotulo" tick={{ ...EIXO, fontWeight: 600, cursor: 'pointer' }} axisLine={false} tickLine={false} width={72}
              onClick={(t: unknown) => { const v = (t as { value?: string } | null)?.value; const l = dados.find(d => d.rotulo === v)?.linha; if (l) onSelecionar(l) }} />
          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={tooltip(unidade)} />
          <Bar dataKey="valor" fill={COR[unidade]} radius={[0, 4, 4, 0]} barSize={16} cursor="pointer"
            onClick={(d: unknown) => { const l = (d as { linha?: LinhaPlaca } | null)?.linha; if (l) onSelecionar(l) }}
            label={{ position: 'right', fontSize: 11, fill: '#52525b', formatter: (v: number) => `${fmtNum(v)} ${sigla(unidade)}` }} />
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
          label={{ position: 'right', fontSize: 11, fill: '#52525b', formatter: (v: number) => `${fmtNum(v)} ${sigla(unidade)}` }} />
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
      <LineChart data={dados} margin={{ top: 22, right: 28, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} width={64} domain={[Math.floor(min - folga), Math.ceil(max + folga)]} tickFormatter={v => fmtNum(Number(v))} />
        <Tooltip content={tooltip(unidade)} />
        <Line type="monotone" dataKey="valor" stroke={COR[unidade]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: COR[unidade] }} activeDot={{ r: 6 }}>
          {/* Com muitos pontos os números se sobrepõem: rotula só até 15 leituras (o tooltip mostra o resto). */}
          {dados.length <= 15 && (
            <LabelList dataKey="valor" position="top" fontSize={10} fontWeight={700} fill="#3f3f46" formatter={(v: number) => `${fmtNum(v)} ${sigla(unidade)}`} />
          )}
        </Line>
      </LineChart>
    </ResponsiveContainer>
  )
}
