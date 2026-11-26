'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertCircle, RefreshCcw, ChevronLeft, ChevronRight, Clock, Route, Loader2 } from 'lucide-react'
import type { TooltipProps } from 'recharts'
import type { ValueType, NameType } from 'recharts/types/component/DefaultTooltipContent'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import {
  montarLinhas, serieTemporal, sigla, somarDias, fmtNum, rotuloMes, variacaoPercentual,
  type EquipamentoAtivo, type Unidade,
} from '@/lib/horimetro-km-calc'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import { CardGrafico, COR } from './Graficos'
import { hojeLocal } from './useFiltrosUrl'

const FOLGA_BASE_DIAS = 92
const COR_ANTERIOR = '#a1a1aa'
const EIXO = { fontSize: 11, fill: '#71717a' }

/** Uma linha por mês: uso no ano escolhido e no ano anterior (null = mês ainda não chegou). */
export type MesAnual = { mes: string; rotulo: string; h: number | null; hAnt: number; km: number | null; kmAnt: number }

function TipAnual({ unidade, ano }: { unidade: Unidade; ano: number }) {
  return function Tip(p: TooltipProps<ValueType, NameType>) {
    const d = p.payload?.[0]?.payload as MesAnual | undefined
    if (!p.active || !d) return null
    const atual = unidade === 'h' ? d.h : d.km
    const ant = unidade === 'h' ? d.hAnt : d.kmAnt
    const v = atual != null ? variacaoPercentual(atual, ant) : null
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 shadow-lg text-xs tabular-nums">
        <div className="font-bold text-zinc-800 dark:text-zinc-100 mb-1">{d.rotulo}</div>
        <div className="text-zinc-700 dark:text-zinc-200">{ano}: <b>{atual == null ? '—' : `${fmtNum(atual, 1)} ${sigla(unidade)}`}</b></div>
        <div className="text-zinc-500">{ano - 1}: {fmtNum(ant, 1)} {sigla(unidade)}</div>
        {v != null && <div className="text-zinc-500 mt-0.5">{v > 0 ? '+' : ''}{fmtNum(v, 1)}% vs. {ano - 1}</div>}
      </div>
    )
  }
}

function GraficoAnual({ dados, unidade, ano, comparar }: { dados: MesAnual[]; unidade: Unidade; ano: number; comparar: boolean }) {
  const chave = unidade === 'h' ? 'h' : 'km'
  const chaveAnt = unidade === 'h' ? 'hAnt' : 'kmAnt'
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="#e4e4e7" strokeDasharray="3 3" />
        <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} />
        <YAxis tick={EIXO} axisLine={false} tickLine={false} width={60} tickFormatter={v => fmtNum(Number(v))} />
        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} content={TipAnual({ unidade, ano })} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        {comparar && <Bar dataKey={chaveAnt} name={String(ano - 1)} fill={COR_ANTERIOR} radius={[4, 4, 0, 0]} maxBarSize={22} />}
        <Bar dataKey={chave} name={String(ano)} fill={COR[unidade]} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function Resumo({ titulo, icone, cor, total, totalAnt, media, unidade, ano, mesesComparados }: {
  titulo: string; icone: ReactNode; cor: string; total: number; totalAnt: number; media: number | null; unidade: Unidade; ano: number; mesesComparados: number
}) {
  const v = variacaoPercentual(total, totalAnt)
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-500">{titulo}<span className={cor}>{icone}</span></div>
      <div className="text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{fmtNum(total)}<span className={`text-sm font-bold ml-1 ${cor}`}>{sigla(unidade)}</span></div>
      <div className="text-[11px] text-zinc-500 tabular-nums">Média mensal: <b>{media == null ? '—' : `${fmtNum(media)} ${sigla(unidade)}`}</b></div>
      <div className="text-[11px] text-zinc-500 tabular-nums">
        {ano - 1} nos mesmos {mesesComparados} meses: {fmtNum(totalAnt)} {sigla(unidade)}
        {v != null && <b className={`ml-1 ${v >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>({v > 0 ? '+' : ''}{fmtNum(v, 1)}%)</b>}
      </div>
    </div>
  )
}

/**
 * Visão anual: uso de horímetro (pesados) e KM (leves + KM dos pesados) em todos os meses do ano,
 * com o ano anterior ao lado. Respeita os filtros de frota, tipo e placa.
 */
export default function PainelAnual({ ano, onAno, filtroEquip, atraso, onDados }: {
  ano: number
  onAno: (ano: number) => void
  filtroEquip: (e: EquipamentoAtivo) => boolean
  atraso: number
  onDados?: (meses: MesAnual[]) => void
}) {
  const hoje = hojeLocal()
  const anoAtual = +hoje.slice(0, 4)
  const mesAtual = hoje.slice(0, 7)
  const [comparar, setComparar] = useState(true)
  const desde = somarDias(`${ano - 1}-01-01`, -FOLGA_BASE_DIAS)
  const { dados, carregando, erro, recarregar } = useLeiturasDashboard(desde, `${ano}-12-31`, true)

  const meses = useMemo<MesAnual[]>(() => {
    if (!dados) return []
    const eqs = dados.equipamentos.filter(filtroEquip)
    const per = { inicio: `${ano}-01-01`, fim: `${ano}-12-31` }
    const perAnt = { inicio: `${ano - 1}-01-01`, fim: `${ano - 1}-12-31` }
    const linhas = montarLinhas(eqs, dados.leituras, per, hoje, atraso)
    const linhasAnt = montarLinhas(eqs, dados.leituras, perAnt, hoje, atraso)
    const h = serieTemporal(linhas, 'h', per, 'mensal'), km = serieTemporal(linhas, 'km', per, 'mensal')
    const hAnt = serieTemporal(linhasAnt, 'h', perAnt, 'mensal'), kmAnt = serieTemporal(linhasAnt, 'km', perAnt, 'mensal')
    return h.map((x, i) => {
      const futuro = x.chave > mesAtual
      return { mes: x.chave, rotulo: rotuloMes(x.chave), h: futuro ? null : x.valor, hAnt: hAnt[i].valor, km: futuro ? null : km[i].valor, kmAnt: kmAnt[i].valor }
    })
  }, [dados, filtroEquip, ano, hoje, atraso, mesAtual])

  useEffect(() => { onDados?.(meses) }, [meses, onDados])

  const passados = meses.filter(m => m.h != null)
  const soma = (k: keyof MesAnual) => passados.reduce((s, m) => s + (Number(m[k]) || 0), 0)
  const mediaDe = (k: 'h' | 'km') => {
    const com = passados.filter(m => (m[k] || 0) > 0)
    return com.length ? com.reduce((s, m) => s + (m[k] || 0), 0) / com.length : null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => onAno(ano - 1)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Ano anterior"><ChevronLeft size={16} /></button>
          <span className="px-2 text-lg font-extrabold tabular-nums text-zinc-900 dark:text-white">{ano}</span>
          <button type="button" onClick={() => onAno(ano + 1)} disabled={ano >= anoAtual} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" aria-label="Próximo ano"><ChevronRight size={16} /></button>
          <span className="ml-2 text-xs text-zinc-500">Janeiro a dezembro{ano === anoAtual ? ' (meses futuros ficam em branco)' : ''}</span>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={comparar} onChange={e => setComparar(e.target.checked)} className="accent-blue-600" />
          Mostrar {ano - 1} ao lado
        </label>
      </div>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> Não foi possível carregar as leituras: {erro}</span>
          <button type="button" onClick={recarregar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-xs font-semibold"><RefreshCcw size={13} /> Tentar de novo</button>
        </div>
      )}

      {!dados && !erro ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[0, 1].map(i => <div key={i} className="h-[120px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />)}</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{[0, 1].map(i => <div key={i} className="h-[340px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />)}</div>
        </>
      ) : dados && (
        <>
          {carregando && <div className="flex items-center gap-2 text-xs text-blue-600"><Loader2 size={13} className="animate-spin" /> Atualizando dados…</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Resumo titulo={`Horas rodadas em ${ano}`} icone={<Clock size={16} />} cor="text-emerald-600" unidade="h" ano={ano}
              total={soma('h')} totalAnt={soma('hAnt')} media={mediaDe('h')} mesesComparados={passados.length} />
            <Resumo titulo={`KM rodados em ${ano}`} icone={<Route size={16} />} cor="text-blue-600" unidade="km" ano={ano}
              total={soma('km')} totalAnt={soma('kmAnt')} media={mediaDe('km')} mesesComparados={passados.length} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CardGrafico titulo={`Horímetro mês a mês — ${ano}`} sub="Horas rodadas pelos pesados em cada mês">
              <GraficoAnual dados={meses} unidade="h" ano={ano} comparar={comparar} />
            </CardGrafico>
            <CardGrafico titulo={`KM mês a mês — ${ano}`} sub="KM rodado pelos leves + KM dos pesados em cada mês">
              <GraficoAnual dados={meses} unidade="km" ano={ano} comparar={comparar} />
            </CardGrafico>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-xs tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                  <th className="px-3 py-2 text-left font-bold">Mês</th>
                  <th className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400">Horas {ano}</th>
                  <th className="px-3 py-2 text-right font-bold">Horas {ano - 1}</th>
                  <th className="px-3 py-2 text-right font-bold text-blue-700 dark:text-blue-400">KM {ano}</th>
                  <th className="px-3 py-2 text-right font-bold">KM {ano - 1}</th>
                </tr>
              </thead>
              <tbody>
                {meses.map(m => (
                  <tr key={m.mes} className="border-b border-zinc-100 dark:border-zinc-800/60">
                    <td className="px-3 py-1.5 font-semibold capitalize">{m.rotulo}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{m.h == null ? '—' : fmtNum(m.h, 1)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-500">{fmtNum(m.hAnt, 1)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{m.km == null ? '—' : fmtNum(m.km, 1)}</td>
                    <td className="px-3 py-1.5 text-right text-zinc-500">{fmtNum(m.kmAnt, 1)}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-zinc-50 dark:bg-zinc-950">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">{fmtNum(soma('h'), 1)}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{fmtNum(meses.reduce((s, m) => s + m.hAnt, 0), 1)}</td>
                  <td className="px-3 py-2 text-right">{fmtNum(soma('km'), 1)}</td>
                  <td className="px-3 py-2 text-right text-zinc-500">{fmtNum(meses.reduce((s, m) => s + m.kmAnt, 0), 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
