'use client'

import { useMemo, useState } from 'react'
import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from 'recharts'
import { fmtNum, usoDaLinha, media, type LinhaPlaca, type ResultadoUso, type Unidade } from '@/lib/horimetro-km-calc'
import { CardGrafico, COR } from './Graficos'
import { Segmentado } from './FiltrosBar'

export type TipoMedia = 'dia' | 'mes' | 'ano'

const EIXO = { fontSize: 11, fill: '#71717a' }
const ROTULO: Record<TipoMedia, string> = { dia: 'por dia', mes: 'por mês', ano: 'por ano' }

/** Média da placa conforme o tipo. "Por ano" = média mensal × 12 (projeção anual). */
function pegarMedia(r: ResultadoUso, tipo: TipoMedia): number | null {
  if (r.insuficiente || !r.temLeituraNoPeriodo) return null
  return tipo === 'dia' ? r.mediaDiaria : tipo === 'mes' ? r.mediaMensal : r.projecaoAnual
}

function Tip({ unidade, tipo }: { unidade: Unidade; tipo: TipoMedia }) {
  return function TipMedia(p: TooltipProps<ValueType, NameType>) {
    const d = p.payload?.[0]?.payload as { rotulo: string; valor: number; tipoEq: string } | undefined
    if (!p.active || !d) return null
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs tabular-nums">
        <div className="font-bold text-zinc-800 dark:text-zinc-100">{d.rotulo} <span className="font-normal text-zinc-500">{d.tipoEq}</span></div>
        <div className="text-zinc-600 dark:text-zinc-300">{fmtNum(d.valor, 1)} {unidade} {ROTULO[tipo]}</div>
      </div>
    )
  }
}

function GraficoMedia({ linhas, unidade, tipo, onSelecionar }: { linhas: LinhaPlaca[]; unidade: Unidade; tipo: TipoMedia; onSelecionar: (l: LinhaPlaca) => void }) {
  const [todas, setTodas] = useState(false)
  const ordenado = useMemo(() => linhas
    .map(l => {
      const r = usoDaLinha(l, unidade)
      return { linha: l, valor: r ? pegarMedia(r, tipo) : null }
    })
    .filter((x): x is { linha: LinhaPlaca; valor: number } => x.valor != null && x.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .map(x => ({ rotulo: x.linha.equipamento.placa, tipoEq: x.linha.equipamento.tipo || '', valor: x.valor, linha: x.linha })), [linhas, unidade, tipo])
  const frota = media(ordenado.map(d => d.valor))
  const dados = todas ? ordenado : ordenado.slice(0, 10)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2 tabular-nums">
        <span className="text-2xl font-extrabold" style={{ color: COR[unidade] }}>{frota == null ? '—' : fmtNum(frota, 1)}</span>
        <span className="text-xs text-zinc-500">{unidade} {ROTULO[tipo]} · média da frota ({ordenado.length} placa{ordenado.length === 1 ? '' : 's'})</span>
      </div>
      {!dados.length ? (
        <div className="h-[200px] flex items-center justify-center text-sm text-zinc-400 text-center px-4">Sem placas com pelo menos 2 leituras no período</div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(160, dados.length * 28 + 30)}>
          <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid horizontal={false} stroke="#e4e4e7" strokeDasharray="3 3" />
            <XAxis type="number" tick={EIXO} axisLine={false} tickLine={false} tickFormatter={v => fmtNum(Number(v))} />
            <YAxis type="category" dataKey="rotulo" tick={{ ...EIXO, fontWeight: 600 }} axisLine={false} tickLine={false} width={72} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={Tip({ unidade, tipo })} />
            {frota != null && (
              <ReferenceLine x={frota} stroke="#a1a1aa" strokeDasharray="4 4"
                label={{ value: 'média', position: 'top', fontSize: 10, fill: '#52525b' }} />
            )}
            <Bar dataKey="valor" fill={COR[unidade]} radius={[0, 4, 4, 0]} barSize={16} cursor="pointer"
              onClick={(d: unknown) => { const l = (d as { linha?: LinhaPlaca } | null)?.linha; if (l) onSelecionar(l) }}
              label={{ position: 'right', fontSize: 11, fill: '#52525b', formatter: (v: number) => fmtNum(v, tipo === 'dia' ? 1 : 0) }} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {ordenado.length > 10 && (
        <button type="button" onClick={() => setTodas(t => !t)} className="self-start text-xs font-semibold text-blue-600 hover:underline">
          {todas ? 'Mostrar top 10' : `Ver todas (${ordenado.length})`}
        </button>
      )}
    </div>
  )
}

/**
 * Médias por placa (por dia, por mês ou por ano) de horímetro e de KM, lado a lado.
 * Usa só placas com pelo menos 2 leituras no período. "Por ano" = média mensal × 12.
 */
export default function MediasCharts({ linhas, onSelecionar }: { linhas: LinhaPlaca[]; onSelecionar: (l: LinhaPlaca) => void }) {
  const [tipo, setTipo] = useState<TipoMedia>('dia')
  const seletor = (
    <Segmentado<TipoMedia> valor={tipo} onChange={setTipo}
      opcoes={[{ v: 'dia', l: 'Por dia' }, { v: 'mes', l: 'Por mês' }, { v: 'ano', l: 'Por ano' }]} />
  )
  const explicacao = tipo === 'dia'
    ? 'Uso no período ÷ dias do período até hoje (mês encerrado = todos os dias)'
    : tipo === 'mes' ? 'Uso no período ÷ meses com leitura' : 'Projeção anual: média mensal × 12'
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <CardGrafico titulo={`Média de horímetro ${ROTULO[tipo]}`} sub={`Horas · ${explicacao} · clique na barra para ver a placa`} acao={seletor}>
        <GraficoMedia linhas={linhas} unidade="h" tipo={tipo} onSelecionar={onSelecionar} />
      </CardGrafico>
      <CardGrafico titulo={`Média de KM ${ROTULO[tipo]}`} sub={`KM dos leves + KM dos pesados · ${explicacao}`} acao={seletor}>
        <GraficoMedia linhas={linhas} unidade="km" tipo={tipo} onSelecionar={onSelecionar} />
      </CardGrafico>
    </div>
  )
}
