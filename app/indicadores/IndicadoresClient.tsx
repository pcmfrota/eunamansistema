'use client'

import React, { useState, useMemo, useCallback, useTransition } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell
} from 'recharts'
import {
  Activity, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Filter, X, ChevronDown, Download, Info, Gauge, Cpu, Loader2, ShieldOff
} from 'lucide-react'
import { useAuth } from '@/components/auth-context'
import { IndicadoresData, getIndicadoresData } from './actions'

// ── Helpers ──────────────────────────────────────────────────────────────────
const META = 95

function getColor(pct: number) {
  if (pct >= META) return '#22c55e'
  if (pct >= 90) return '#f59e0b'
  return '#ef4444'
}

function fmtH(h: number) {
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.round(h * 60)}min`
}

// ── Tooltip customizado ───────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label, horasTotais }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = d.value as number
  const horasManut = horasTotais - (horasTotais * pct / 100)
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 shadow-2xl min-w-[180px]">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">{label}</p>
      <p className="text-lg font-black mb-1" style={{ color: getColor(pct) }}>
        {pct.toFixed(1)}%
      </p>
      <div className="space-y-1 text-[10px] font-bold text-zinc-400 border-t border-zinc-700 pt-2 mt-1">
        <div className="flex justify-between gap-4">
          <span>Tempo Total</span>
          <span className="text-zinc-300">{fmtH(horasTotais)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Tempo Parado</span>
          <span className="text-red-400">{fmtH(horasManut)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Meta</span>
          <span className="text-emerald-400">≥ {META}%</span>
        </div>
      </div>
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiIndicador({ label, value, sub, color, icon: Icon, badge }: {
  label: string; value: string; sub?: string; color: string; icon: any; badge?: string
}) {
  return (
    <div className="relative flex flex-col gap-2 p-6 rounded-3xl border overflow-hidden bg-zinc-950 border-zinc-800 group hover:scale-[1.02] transition-all duration-300 hover:shadow-2xl">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}15, transparent 60%)` }} />
      <div className="flex items-center justify-between z-10">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <div className="p-2 rounded-xl" style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <p className="text-4xl font-black tabular-nums z-10" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest z-10">{sub}</p>}
      {badge && (
        <span className="absolute top-3 right-14 text-[9px] font-black px-2 py-0.5 rounded-full"
          style={{ background: `${color}25`, color }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ── Gráfico de disponibilidade ────────────────────────────────────────────────
function GraficoDisp({ dados, titulo, subtitulo, mediaGeral, tipo, horasTotais }: {
  dados: { name: string; value: number }[]
  titulo: string
  subtitulo: string
  mediaGeral: number
  tipo: 'dm' | 'do'
  horasTotais: number
}) {
  const [ativoPlaca, setAtivoPlaca] = useState<string | null>(null)
  const cor = getColor(mediaGeral)

  // Detalhe da placa selecionada
  const detalhe = ativoPlaca ? dados.find(d => d.name === ativoPlaca) : null

  return (
    <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100">{titulo}</h3>
          <p className="text-[10px] text-zinc-500 font-bold mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-3xl font-black tabular-nums" style={{ color: cor }}>
            {mediaGeral.toFixed(1)}%
          </span>
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Média Geral</span>
        </div>
      </div>

      {/* Barra de progresso da média */}
      <div className="relative h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${mediaGeral}%`, background: `linear-gradient(90deg, ${cor}, ${cor}aa)` }}
        />
        {/* Linha de meta */}
        <div
          className="absolute top-0 h-full w-[1px] bg-emerald-400/70"
          style={{ left: `${META}%` }}
        />
      </div>

      {/* Gráfico */}
      {dados.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-xs font-bold">
          Nenhum dado disponível para o período
        </div>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={Math.max(220, dados.length * 32)}>
            <BarChart data={dados} layout="vertical" margin={{ left: 4, right: 20, top: 4, bottom: 4 }}
              onClick={(e) => {
                if (e?.activeLabel) setAtivoPlaca(prev => prev === e.activeLabel ? null : e.activeLabel!)
              }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis
                type="number" domain={[0, 100]}
                tick={{ fill: '#71717a', fontSize: 9, fontWeight: 700 }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                dataKey="name" type="category"
                tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 700 }}
                width={80}
              />
              <Tooltip content={<CustomTooltip horasTotais={horasTotais} />} cursor={{ fill: '#ffffff08' }} />
              <ReferenceLine x={META} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: `Meta ${META}%`, position: 'insideTopRight', fill: '#22c55e', fontSize: 9, fontWeight: 700 }} />
              <Bar dataKey="value" name={tipo === 'dm' ? 'DM' : 'DO'} radius={[0, 6, 6, 0]}
                label={{
                  position: 'right', fill: '#a1a1aa', fontSize: 9, fontWeight: 700,
                  formatter: (v: number) => `${v.toFixed(1)}%`
                }}>
                {dados.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={getColor(entry.value)}
                    opacity={ativoPlaca && ativoPlaca !== entry.name ? 0.35 : 1}
                    stroke={ativoPlaca === entry.name ? '#fff' : 'transparent'}
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Painel de detalhe ao clicar */}
          {detalhe && (
            <div className="mt-3 p-4 bg-zinc-900 rounded-2xl border border-zinc-700 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-zinc-200">{detalhe.name}</span>
                <button onClick={() => setAtivoPlaca(null)}
                  className="text-zinc-500 hover:text-zinc-300 transition-colors">
                  <X size={12} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-lg font-black" style={{ color: getColor(detalhe.value) }}>{detalhe.value.toFixed(1)}%</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Disponibilidade</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-zinc-200">{fmtH(horasTotais)}</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Tempo Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black text-red-400">{fmtH(horasTotais - horasTotais * detalhe.value / 100)}</p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase">Tempo Parado</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legenda de cores */}
      <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/60">
        {[{ cor: '#22c55e', label: `≥ ${META}%` }, { cor: '#f59e0b', label: '90–94%' }, { cor: '#ef4444', label: '< 90%' }].map(({ cor, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: cor }} />
            <span className="text-[9px] font-bold text-zinc-500">{label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-4 h-[1px] bg-emerald-400/70" style={{ borderTop: '1.5px dashed #22c55e' }} />
          <span className="text-[9px] font-bold text-emerald-500">Meta {META}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
interface Props { initialData: IndicadoresData }

export default function IndicadoresClient({ initialData }: Props) {
  const { profile } = useAuth()
  const isVisitante = profile?.role === 'visitante'
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  // Filtros
  const [mes, setMes] = useState(0)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [categoria, setCategoria] = useState('')
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [abaAtiva, setAbaAtiva] = useState<'todos' | 'leves' | 'pesados'>('todos')
  const [filtroIndisp, setFiltroIndisp] = useState<'todos' | 'apenas_indisp' | 'apenas_100'>('todos')

  const fetchData = useCallback((params: { mes: number; ano: number; categoria: string; placa: string }) => {
    startTransition(async () => {
      const result = await getIndicadoresData({
        mes: params.mes > 0 ? params.mes : undefined,
        ano: params.ano > 0 ? params.ano : undefined,
        categoria: params.categoria || undefined,
        placa: params.placa || undefined,
      })
      setData(result)
    })
  }, [])

  function handleChange(updates: Partial<{ mes: number; ano: number; categoria: string; placa: string }>) {
    const next = { mes, ano, categoria, placa: filtroPlaca, ...updates }
    if (updates.mes !== undefined) setMes(updates.mes)
    if (updates.ano !== undefined) setAno(updates.ano)
    if (updates.categoria !== undefined) setCategoria(updates.categoria)
    if (updates.placa !== undefined) setFiltroPlaca(updates.placa)
    fetchData(next)
  }

  function handleReset() {
    const now = new Date()
    setMes(0); setAno(now.getFullYear()); setCategoria(''); setFiltroPlaca('')
    setAbaAtiva('todos'); setFiltroIndisp('todos')
    fetchData({ mes: 0, ano: now.getFullYear(), categoria: '', placa: '' })
  }

  // Filtro por aba (categoria)
  const veiculosFiltradosAba = useMemo(() => {
    return data.veiculos.filter(v => {
      if (abaAtiva === 'leves') return v.categoria?.toLowerCase().includes('leve') || v.categoria?.toLowerCase().includes('carro')
      if (abaAtiva === 'pesados') return v.categoria?.toLowerCase().includes('pesad') || v.categoria?.toLowerCase().includes('caminh')
      return true
    })
  }, [data.veiculos, abaAtiva])

  // Filtro por indisponibilidade
  const veiculosFinal = useMemo(() => {
    return veiculosFiltradosAba.filter(v => {
      if (filtroIndisp === 'apenas_indisp') return v.dm < 100
      if (filtroIndisp === 'apenas_100') return v.dm >= 100
      return true
    })
  }, [veiculosFiltradosAba, filtroIndisp])

  // Dados para gráficos
  const dadosDM = veiculosFinal.map(v => ({ name: v.placa, value: v.dm }))
  const dadosDO = veiculosFinal.map(v => ({ name: v.placa, value: v.do_ }))

  // Médias do subconjunto exibido
  const dmMediaLocal = veiculosFinal.length > 0
    ? Math.round(veiculosFinal.reduce((a, v) => a + v.dm, 0) / veiculosFinal.length * 10) / 10
    : data.dmMedia
  const doMediaLocal = veiculosFinal.length > 0
    ? Math.round(veiculosFinal.reduce((a, v) => a + v.do_, 0) / veiculosFinal.length * 10) / 10
    : data.doMedia

  // Contagens para KPIs
  const acimaMeta = veiculosFinal.filter(v => v.dm >= META).length
  const abaixoMeta = veiculosFinal.filter(v => v.dm < META).length
  const criticos = veiculosFinal.filter(v => v.dm < 90).length

  const selectCls = (active: boolean) =>
    `px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border outline-none cursor-pointer appearance-none transition-all
    ${active
      ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600'}`

  const ABAS: { id: 'todos' | 'leves' | 'pesados'; label: string }[] = [
    { id: 'todos', label: 'Todos' },
    { id: 'leves', label: 'Carros Leves' },
    { id: 'pesados', label: 'Caminhões Pesados' },
  ]

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#0f1115] min-h-screen">

      {/* Loading */}
      {isPending && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-zinc-900 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl border border-zinc-800">
            <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            <span className="text-sm font-medium text-zinc-300">Calculando indicadores...</span>
          </div>
        </div>
      )}

      {/* Título */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Indicadores de Manutenção</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Análise de Disponibilidade Mecânica (DM) e Operacional (DO) por ativo · {data.periodoLabel}
        </p>
      </div>

      {/* Abas de categoria */}
      <div className="flex gap-1 p-1 bg-zinc-900 rounded-2xl border border-zinc-800 w-fit">
        {ABAS.map(aba => (
          <button key={aba.id} onClick={() => setAbaAtiva(aba.id)}
            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200
              ${abaAtiva === aba.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-zinc-500 hover:text-zinc-300'}`}>
            {aba.label}
          </button>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-3 p-5 bg-zinc-950 rounded-3xl border border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest pr-4 border-r border-zinc-800">
          <Filter size={14} className="text-indigo-500" /> Filtros
        </div>

        <select value={mes} onChange={e => handleChange({ mes: Number(e.target.value) })}
          className={selectCls(mes > 0)}>
          <option value={0}>📅 Mês</option>
          {data.filtroOpcoes.meses.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <select value={ano} onChange={e => handleChange({ ano: Number(e.target.value) })}
          className={selectCls(ano > 0)}>
          <option value={0}>📅 Ano</option>
          {data.filtroOpcoes.anos.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select value={categoria} onChange={e => handleChange({ categoria: e.target.value })}
          className={selectCls(!!categoria)}>
          <option value="">🚘 Categoria</option>
          {data.filtroOpcoes.categorias.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select value={filtroPlaca} onChange={e => handleChange({ placa: e.target.value })}
          className={selectCls(!!filtroPlaca)}>
          <option value="">🚗 Veículo</option>
          {data.filtroOpcoes.placas.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Filtro Indisponibilidade */}
        <div className="flex items-center gap-1 ml-1 border-l border-zinc-800 pl-3">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mr-1">🔻 Filtrar por Indisp.:</span>
          {[
            { id: 'todos', label: 'Todas' },
            { id: 'apenas_indisp', label: 'Com Indisp.' },
            { id: 'apenas_100', label: 'Disponíveis (100%)' },
          ].map(opt => (
            <button key={opt.id}
              onClick={() => setFiltroIndisp(opt.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all
                ${filtroIndisp === opt.id
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'text-zinc-500 border-zinc-800 hover:border-zinc-600'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        {(mes > 0 || categoria || filtroPlaca || filtroIndisp !== 'todos') && (
          <button onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all ml-auto">
            <X size={12} /> Limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 text-[10px] font-black text-zinc-500">
          <Info size={12} className="text-indigo-500" />
          <span className="text-indigo-400">{veiculosFinal.length}</span> de <span className="text-zinc-400">{data.veiculos.length}</span> ativos
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiIndicador
          label="DM Média"
          value={`${dmMediaLocal.toFixed(1)}%`}
          sub={`Meta ≥ ${META}%`}
          color={getColor(dmMediaLocal)}
          icon={Gauge}
          badge={dmMediaLocal >= META ? '✓ META' : '✗ META'}
        />
        <KpiIndicador
          label="DO Média"
          value={`${doMediaLocal.toFixed(1)}%`}
          sub="Disponibilidade Operacional"
          color={getColor(doMediaLocal)}
          icon={Activity}
        />
        <KpiIndicador
          label="Acima da Meta"
          value={String(acimaMeta)}
          sub={`DM ≥ ${META}%`}
          color="#22c55e"
          icon={CheckCircle2}
        />
        <KpiIndicador
          label="Abaixo da Meta"
          value={String(abaixoMeta)}
          sub={`DM < ${META}%`}
          color="#f59e0b"
          icon={TrendingDown}
        />
        <KpiIndicador
          label="Críticos"
          value={String(criticos)}
          sub="DM < 90%"
          color="#ef4444"
          icon={AlertTriangle}
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GraficoDisp
          dados={dadosDM}
          titulo="Disponibilidade Mecânica (DM)"
          subtitulo="(Tempo Total − Tempo de Manutenção) / Tempo Total × 100"
          mediaGeral={dmMediaLocal}
          tipo="dm"
          horasTotais={data.horasTotaisPeriodo}
        />
        <GraficoDisp
          dados={dadosDO}
          titulo="Disponibilidade Operacional (DO)"
          subtitulo="Tempo Operacional / Tempo Total × 100"
          mediaGeral={doMediaLocal}
          tipo="do"
          horasTotais={data.horasTotaisPeriodo}
        />
      </div>

      {/* Tabela resumo */}
      <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-100">Detalhamento por Ativo</h3>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
              Período: {data.periodoLabel} · {data.diasTranscorridos} dias ({data.horasTotaisPeriodo}h/ativo)
            </p>
          </div>
            {!isVisitante ? (
              <button
                onClick={() => exportCSV(veiculosFinal, data.periodoLabel)}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all">
                <Download size={13} /> Exportar CSV
              </button>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-500 text-[10px] font-bold">
                <ShieldOff size={12} /> Somente Leitura
              </div>
            )}
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-[0.15em] text-zinc-500 border-b border-zinc-800">
              <th className="pb-3 pr-4">Placa</th>
              <th className="pb-3 pr-4">Categoria</th>
              <th className="pb-3 pr-4">OS Total</th>
              <th className="pb-3 pr-4">H. Manut.</th>
              <th className="pb-3 pr-4">DM %</th>
              <th className="pb-3 pr-4">DO %</th>
              <th className="pb-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900">
            {veiculosFinal.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500 text-xs font-bold">
                  Nenhum ativo encontrado com os filtros aplicados
                </td>
              </tr>
            ) : veiculosFinal.map((v, i) => (
              <tr key={i} className="hover:bg-zinc-900/40 transition-colors group">
                <td className="py-3 pr-4">
                  <span className="text-xs font-black text-zinc-200 bg-zinc-800 px-2 py-1 rounded-lg font-mono">
                    {v.placa}
                  </span>
                </td>
                <td className="py-3 pr-4 text-[10px] font-bold text-zinc-400">{v.categoria || '—'}</td>
                <td className="py-3 pr-4 text-[10px] font-bold text-zinc-300">{v.totalOS}</td>
                <td className="py-3 pr-4 text-[10px] font-bold text-zinc-300">{fmtH(v.dmHorasManut)}</td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v.dm}%`, background: getColor(v.dm) }} />
                    </div>
                    <span className="text-xs font-black tabular-nums" style={{ color: getColor(v.dm) }}>
                      {v.dm.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${v.do_}%`, background: getColor(v.do_) }} />
                    </div>
                    <span className="text-xs font-black tabular-nums" style={{ color: getColor(v.do_) }}>
                      {v.do_.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="py-3">
                  <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest
                    ${v.dm >= META ? 'bg-emerald-500/15 text-emerald-400' :
                      v.dm >= 90 ? 'bg-amber-500/15 text-amber-400' :
                      'bg-red-500/15 text-red-400'}`}>
                    {v.dm >= META ? '✓ OK' : v.dm >= 90 ? '⚠ Atenção' : '✗ Crítico'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

// ── Exportar CSV ──────────────────────────────────────────────────────────────
function exportCSV(veiculos: any[], periodo: string) {
  const headers = ['Placa', 'Categoria', 'Módulo', 'OS Total', 'OS Fechadas', 'OS Abertas', 'Horas Manutenção', 'DM %', 'DO %', 'Status DM']
  const rows = veiculos.map(v => [
    v.placa, v.categoria, v.modulo, v.totalOS, v.osFechadas, v.osAbertas,
    v.dmHorasManut.toFixed(1),
    v.dm.toFixed(1), v.do_.toFixed(1),
    v.dm >= META ? 'OK' : v.dm >= 90 ? 'Atenção' : 'Crítico'
  ])
  const csv = [headers, ...rows].map(r => r.map(String).join(';')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `indicadores_${periodo.replace(/\s/g, '_')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
