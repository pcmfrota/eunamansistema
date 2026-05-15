'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts'
import {
  AlertTriangle, TrendingUp, TrendingDown, Package,
  Activity, Clock, Target, Zap, Filter, X, Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props { 
  items: any[]
  placas: any[]
}

const CRITICIDADE_COLOR: Record<string, string> = {
  A: '#ef4444', B: '#f97316', C: '#eab308', D: '#22c55e'
}
const STATUS_COLOR: Record<string, string> = {
  'Aberta': '#6366f1', 'Em Andamento': '#f59e0b', 'Concluída': '#22c55e',
  'Cancelada': '#6b7280', 'Programada': '#3b82f6', 'Aguardando': '#a855f7'
}

function KPICard({ label, value, sub, color, icon: Icon, trend }: any) {
  return (
    <div className={cn(
      "relative flex flex-col gap-3 p-6 rounded-3xl border overflow-hidden group transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl",
      "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
    )}>
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700`}
        style={{ background: `radial-gradient(circle at 80% 20%, ${color}15, transparent 60%)` }} />
      <div className="flex items-center justify-between relative z-10">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">{label}</span>
        <div className="p-2 rounded-xl" style={{ background: `${color}20` }}>
          <Icon size={16} style={{ color }} />
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-4xl font-black tabular-nums" style={{ color }}>{value}</p>
        {sub && <p className="text-[10px] text-zinc-400 font-bold mt-1 uppercase tracking-widest">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={cn("flex items-center gap-1 text-[10px] font-black uppercase tracking-widest relative z-10",
          trend >= 0 ? "text-red-400" : "text-emerald-400")}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}% vs. média
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 shadow-2xl">
      <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-black" style={{ color: p.color || p.fill }}>
          {p.name}: <span className="text-white">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function BacklogDashboard({ items, placas }: Props) {
  const [filterCrit, setFilterCrit] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterModulo, setFilterModulo] = useState('')
  const [filterArea, setFilterArea] = useState('')

  const filtered = useMemo(() => items.filter(i => {
    if (filterCrit && i.criticidade !== filterCrit) return false
    if (filterStatus && i.status !== filterStatus) return false
    if (filterModulo && i.modulo !== filterModulo) return false
    
    if (filterArea) {
      const pInfo = placas.find(p => p.placa === i.frota);
      if (pInfo?.area !== filterArea) return false;
    }

    return true
  }), [items, filterCrit, filterStatus, filterModulo, filterArea, placas])

  // KPIs
  const total = filtered.length
  const critA = filtered.filter(i => i.criticidade === 'A').length
  const critB = filtered.filter(i => i.criticidade === 'B').length
  const critC = filtered.filter(i => i.criticidade === 'C').length
  const abertos = filtered.filter(i => !i.status || i.status === 'Aberta' || i.status === 'ABERTO').length
  const semEvidencia = filtered.filter(i => !i.data_evidencia).length
  const pctAbertos = total ? Math.round((abertos / total) * 100) : 0

  // Chart 1: Por Módulo
  const porModulo = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => { const k = i.modulo || 'SEM MÓDULO'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Chart 2: Top 15 frotas
  const topFrotas = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => { const k = i.frota || '?'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 15)
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Chart 3: Por Status (Pie)
  const porStatus = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => { const k = i.status || 'Aberta'; map[k] = (map[k] || 0) + 1 })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Chart 4: Criticidade por Módulo (Radar)
  const critPorModulo = useMemo(() => {
    const top5 = Array.from(new Set(filtered.map(i => i.modulo).filter(Boolean))).slice(0, 6)
    return top5.map(mod => ({
      modulo: mod,
      A: filtered.filter(i => i.modulo === mod && i.criticidade === 'A').length,
      B: filtered.filter(i => i.modulo === mod && i.criticidade === 'B').length,
      C: filtered.filter(i => i.modulo === mod && i.criticidade === 'C').length,
    }))
  }, [filtered])

  // Top críticos (A sem data_evidencia)
  const topCriticos = filtered
    .filter(i => i.criticidade === 'A')
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 5)

  // Dynamic filter options
  const crits = Array.from(new Set(items.map(i => i.criticidade).filter(Boolean))).sort()
  const areasOptions = Array.from(new Set(placas.map(p => p.area).filter(Boolean))).sort()
  const statuses = Array.from(new Set(items.map(i => i.status).filter(Boolean))).sort()
  const modulos = [
    "MÓDULO 5",
    "MÓDULO 2",
    "MÓDULO 7",
    "CARREGAMENTO",
    "RESERVA",
    "MALHA VIÁRIA"
  ]

  const hasFilters = filterCrit || filterStatus || filterModulo || filterArea

  const selectCls = (active: boolean) => cn(
    "px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border outline-none cursor-pointer appearance-none transition-all",
    active
      ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20"
      : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
  )

  return (
    <div className="space-y-6 animate-in fade-in duration-700">

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 p-5 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest pr-4 border-r border-zinc-200 dark:border-zinc-800">
          <Filter size={14} className="text-indigo-500" /> Filtros
        </div>

        <select value={filterCrit} onChange={e => setFilterCrit(e.target.value)} className={selectCls(!!filterCrit)}>
          <option value="">🔴 CRITICIDADE</option>
          {crits.map(c => <option key={c} value={c}>CRITICIDADE {c}</option>)}
        </select>

        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls(!!filterStatus)}>
          <option value="">📋 STATUS</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={filterModulo} onChange={e => setFilterModulo(e.target.value)} className={selectCls(!!filterModulo)}>
          <option value="">📍 MÓDULO</option>
          {modulos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={selectCls(!!filterArea)}>
          <option value="">🏢 ÁREA</option>
          {areasOptions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setFilterCrit(''); setFilterStatus(''); setFilterModulo(''); setFilterArea(''); }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-red-400 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition-all">
            <X size={12} /> Limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2 text-[10px] font-black text-zinc-500">
          <Info size={12} className="text-indigo-500" />
          Exibindo <span className="text-indigo-400">{total}</span> de <span className="text-zinc-400">{items.length}</span> itens
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Total Backlog" value={total} sub="itens cadastrados" color="#6366f1" icon={Package} />
        <KPICard label="Criticidade A" value={critA} sub="prioridade máxima" color="#ef4444" icon={AlertTriangle} />
        <KPICard label="Criticidade B" value={critB} sub="prioridade alta" color="#f97316" icon={Zap} />
        <KPICard label="Criticidade C" value={critC} sub="prioridade média" color="#eab308" icon={Target} />
        <KPICard label="Itens Abertos" value={`${pctAbertos}%`} sub={`${abertos} itens`} color="#22c55e" icon={Activity} />
        <KPICard label="Sem Evidência" value={semEvidencia} sub="pendente de data" color="#a855f7" icon={Clock} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Backlog por Módulo */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Backlog por Módulo</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Top 10 módulos com mais pendências</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={porModulo} layout="vertical" margin={{ left: 0, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }} />
              <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 700 }} width={90} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Itens" radius={[0, 8, 8, 0]}
                fill="url(#gradBar1)" label={{ position: 'right', fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }} />
              <defs>
                <linearGradient id="gradBar1" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 15 Frotas */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Ranking de Frotas</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Top 15 equipamentos com mais itens</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topFrotas} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 8, fontWeight: 700 }} angle={-45} textAnchor="end" />
              <YAxis tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Itens" radius={[8, 8, 0, 0]}>
                {topFrotas.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#ef4444' : i === 1 ? '#f97316' : i === 2 ? '#eab308' : '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Distribuição por Status (Pie) */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Por Status</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Distribuição atual</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porStatus} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                paddingAngle={4} dataKey="value" nameKey="name">
                {porStatus.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLOR[entry.name] || `hsl(${i * 60}, 70%, 60%)`}
                    stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v: string) => <span style={{ color: '#a1a1aa', fontSize: 9, fontWeight: 700 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Radar: Criticidade por Módulo */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-100">Criticidade × Módulo</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Distribuição radar</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={critPorModulo} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis dataKey="modulo" tick={{ fill: '#71717a', fontSize: 8, fontWeight: 700 }} />
              <Radar name="A" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              <Radar name="B" dataKey="B" stroke="#f97316" fill="#f97316" fillOpacity={0.2} />
              <Radar name="C" dataKey="C" stroke="#eab308" fill="#eab308" fillOpacity={0.15} />
              <Legend iconType="circle" iconSize={8}
                formatter={(v: string) => <span style={{ color: '#a1a1aa', fontSize: 9, fontWeight: 700 }}>CRIT. {v}</span>} />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Painel Crítico: Itens A */}
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-red-500/30 p-6 shadow-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between mb-4 relative z-10">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-red-400">⚡ Críticos Abertos</h3>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Criticidade A — ação imediata</p>
            </div>
            <div className="px-2 py-1 bg-red-500/20 rounded-lg text-[9px] font-black text-red-400 border border-red-500/30">
              {critA} ITENS
            </div>
          </div>
          <div className="space-y-3 relative z-10">
            {topCriticos.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-500 text-xs font-bold">
                Nenhum item crítico! 🎉
              </div>
            ) : topCriticos.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20 rounded-2xl hover:bg-red-500/10 transition-all">
                <div className="w-6 h-6 bg-red-500/20 rounded-lg flex items-center justify-center text-[9px] font-black text-red-400 shrink-0">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black text-zinc-200 truncate">{item.frota}</p>
                  <p className="text-[9px] text-zinc-500 font-bold truncate mt-0.5">{item.descricao}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{item.modulo || '—'}</p>
                </div>
              </div>
            ))}
            {critA > 5 && (
              <p className="text-center text-[9px] font-black text-zinc-500 uppercase tracking-widest pt-2">
                +{critA - 5} outros itens críticos
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {crits.map(c => {
          const count = filtered.filter(i => i.criticidade === c).length
          const pct = total ? Math.round((count / total) * 100) : 0
          const color = CRITICIDADE_COLOR[c] || '#6366f1'
          return (
            <div key={c} className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg"
                style={{ background: `${color}20`, color }}>
                {c}
              </div>
              <div>
                <p className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{count}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{pct}% do total</p>
                {/* Mini progress bar */}
                <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mt-2">
                  <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
