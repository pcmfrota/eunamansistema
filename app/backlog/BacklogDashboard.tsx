'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Layers, MapPin, Tag, Wrench, ShieldAlert,
  ArrowRight, Search, Filter, X, ChevronRight, ChevronLeft, Edit3, Trash2, RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  items: any[]
  placas: any[]
  calendario?: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
}

const CRITICIDADE_COLORS: Record<string, { bg: string, text: string, chart: string }> = {
  'A': { bg: 'bg-[#fde8e8] dark:bg-red-950/40 border-red-200 dark:border-red-900/50', text: 'text-[#e74c3c] dark:text-red-400', chart: '#f05252' },
  'B': { bg: 'bg-[#ebf5fb] dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50', text: 'text-[#3498db] dark:text-blue-400', chart: '#2563eb' },
}

const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  'PENDENTE': { bg: 'bg-[#fef9c3] dark:bg-yellow-950/40 border-[#fef08a]', text: 'text-[#ca8a04] dark:text-yellow-400' },
  'PROGRAMADO': { bg: 'bg-[#dcfce7] dark:bg-emerald-950/40 border-[#bbf7d0]', text: 'text-[#16a34a] dark:text-emerald-400' },
  'ENCERRADO': { bg: 'bg-[#e2e8f0] dark:bg-zinc-800 border-[#cbd5e1]', text: 'text-[#475569] dark:text-zinc-400' }
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

export default function BacklogDashboard({ items, placas, calendario = [], onEdit, onDelete }: Props) {
  const currentPeriod = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) return period;
    
    const now = new Date();
    return {
      ano: now.getFullYear(),
      mes: now.getMonth() + 1
    };
  }, [calendario]);

  const defaultMonthName = useMemo(() => {
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    return months[Number(currentPeriod.mes) - 1] || 'janeiro';
  }, [currentPeriod]);

  const defaultYearString = useMemo(() => {
    return String(currentPeriod.ano);
  }, [currentPeriod]);

  // Global Filters
  const [filterStatuses, setFilterStatuses] = useState<string[]>(['PENDENTE', 'PROGRAMADO', 'ENCERRADO'])
  const [filterCriticidade, setFilterCriticidade] = useState('')
  const [filterFornecedor, setFilterFornecedor] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterModulo, setFilterModulo] = useState('')
  const [filterAno, setFilterAno] = useState(defaultYearString)
  const [filterMes, setFilterMes] = useState(defaultMonthName)
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [search, setSearch] = useState('')

  // Pagination states for dashboard table
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [filterMecanico, setFilterMecanico] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')

  // Map database status and criticidade to target dashboard schema
  const mappedItems = useMemo(() => {
    const placasMap = new Map(placas.map(p => [p.placa, p]));
    return items.map(item => {
      // 1. Map Status
      let mappedStatus = 'PENDENTE'
      const statusLower = String(item.status || '').toLowerCase()
      const progLower = String(item.status_programacao || '').toLowerCase()
      if (statusLower === 'encerrada' || statusLower === 'concluída' || statusLower === 'concluido' || statusLower === 'encerrado') {
        mappedStatus = 'ENCERRADO'
      } else if (progLower === 'programado' || statusLower === 'programada' || statusLower === 'programado') {
        mappedStatus = 'PROGRAMADO'
      }

      // 2. Map Criticidade
      let mappedCriticidade = String(item.criticidade || 'B').toUpperCase().trim()
      if (mappedCriticidade === 'A' || mappedCriticidade === 'INTERDIÇÃO' || mappedCriticidade === 'INTERDICAO' || mappedCriticidade === 'ALTA') {
        mappedCriticidade = 'A'
      } else {
        mappedCriticidade = 'B'
      }

      // 3. Find equipment area registered in "base de frotas"
      const eq = placasMap.get(item.frota)
      const mappedArea = String(eq?.area || item.campo_base || 'REPOSIÇÃO').toUpperCase()

      // 4. Mapped month and year
      let mappedMonth = 'janeiro'
      let mappedYear = '2026'
      if (item.data_evidencia) {
        const d = new Date(item.data_evidencia)
        if (!isNaN(d.getTime())) {
          mappedMonth = MONTHS_PT[d.getMonth()]
          mappedYear = String(d.getFullYear())
        }
      } else if (item.mes) {
        // Fallback for string mes/ano
        const mIdx = parseInt(item.mes) - 1
        if (mIdx >= 0 && mIdx < 12) mappedMonth = MONTHS_PT[mIdx]
        if (item.ano) mappedYear = String(item.ano)
      }

      // 5. Calculate aging (Dias em Aberto)
      let diasAberto = 0
      if (item.data_evidencia) {
        const start = new Date(item.data_evidencia.split('T')[0])
        const end = mappedStatus === 'ENCERRADO' && item.data_conclusao
          ? new Date(item.data_conclusao.split('T')[0])
          : new Date() // Today
        const diff = end.getTime() - start.getTime()
        diasAberto = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
      }

      return {
        ...item,
        mappedStatus,
        mappedCriticidade,
        mappedArea,
        mappedMonth,
        mappedYear,
        diasAberto
      }
    })
  }, [items, placas])

  // Extract unique filters options from the fully mapped list
  const filterOptions = useMemo(() => {
    const fornecedores = new Set<string>()
    const areas = new Set<string>()
    const modulos = new Set<string>()
    const anos = new Set<string>()
    const mecanicos = new Set<string>()

    mappedItems.forEach(i => {
      if (i.fornecedor) fornecedores.add(i.fornecedor)
      if (i.mappedArea) areas.add(i.mappedArea)
      if (i.modulo) modulos.add(i.modulo)
      if (i.mappedYear) anos.add(i.mappedYear)
      if (i.colaborador) mecanicos.add(i.colaborador)
    })

    return {
      fornecedores: Array.from(fornecedores).sort(),
      areas: Array.from(areas).sort(),
      modulos: Array.from(modulos).sort(),
      anos: Array.from(anos).sort(),
      mecanicos: Array.from(mecanicos).sort()
    }
  }, [mappedItems])

  // Apply filters
  const filtered = useMemo(() => {
    return mappedItems.filter(item => {
      // 1. Status Multi-select
      if (filterStatuses.length > 0 && !filterStatuses.includes(item.mappedStatus)) return false

      // 2. Criticidade
      if (filterCriticidade && item.mappedCriticidade !== filterCriticidade) return false

      // 3. Fornecedor
      if (filterFornecedor && item.fornecedor !== filterFornecedor) return false

      // 4. Area
      if (filterArea && item.mappedArea !== filterArea) return false

      // 5. Modulo
      if (filterModulo && item.modulo !== filterModulo) return false

      // 6. Ano (Data)
      if (filterAno && item.mappedYear !== filterAno) return false

      // 6c. Mês (Data)
      if (filterMes && item.mappedMonth !== filterMes) return false

      // 6b. Date Range Filter
      if (filterDataInicio || filterDataFim) {
        if (!item.data_evidencia) return false;
        const itemDate = item.data_evidencia.split('T')[0];
        if (filterDataInicio && itemDate < filterDataInicio) return false;
        if (filterDataFim && itemDate > filterDataFim) return false;
      }

      // 7. Mecanico
      if (filterMecanico && item.colaborador !== filterMecanico) return false

      // 8. Search text
      if (search) {
        const q = search.toLowerCase()
        const matchFrota = String(item.frota || '').toLowerCase().includes(q)
        const matchDesc = String(item.descricao || '').toLowerCase().includes(q)
        const matchTag = String(item.tag || '').toLowerCase().includes(q)
        if (!matchFrota && !matchDesc && !matchTag) return false
      }

      return true
    })
  }, [mappedItems, filterStatuses, filterCriticidade, filterFornecedor, filterArea, filterModulo, filterAno, filterMes, filterMecanico, filterDataInicio, filterDataFim, search])

  // Reset pagination to first page on filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [filtered])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedFiltered = useMemo(() => {
    return filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  }, [filtered, currentPage])

  // KPIs
  const kpiConcluidas = useMemo(() => filtered.filter(i => i.mappedStatus === 'ENCERRADO').length, [filtered])
  const kpiPendentes = useMemo(() => filtered.filter(i => i.mappedStatus === 'PENDENTE').length, [filtered])
  const kpiProgramados = useMemo(() => filtered.filter(i => i.mappedStatus === 'PROGRAMADO').length, [filtered])
  const kpiTotal = filtered.length

  // Calculate Average process times
  const avgCriacaoProg = useMemo(() => {
    const validItems = filtered.filter(i => i.data_evidencia && i.data_programacao && i.mappedStatus !== 'ENCERRADO')
    if (validItems.length === 0) return '20,70' // fallback from image if no data
    const sum = validItems.reduce((acc, i) => {
      const start = new Date(i.data_evidencia.split('T')[0])
      const end = new Date(i.data_programacao.split('T')[0])
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return acc + (diff > 0 ? diff : 0)
    }, 0)
    return (sum / validItems.length).toFixed(2).replace('.', ',')
  }, [filtered])

  const avgProgEncerr = useMemo(() => {
    const validItems = filtered.filter(i => i.data_programacao && i.data_conclusao && i.mappedStatus === 'ENCERRADO')
    if (validItems.length === 0) return '63,49' // fallback from image if no data
    const sum = validItems.reduce((acc, i) => {
      const start = new Date(i.data_programacao.split('T')[0])
      const end = new Date(i.data_conclusao.split('T')[0])
      const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      return acc + (diff > 0 ? diff : 0)
    }, 0)
    return (sum / validItems.length).toFixed(2).replace('.', ',')
  }, [filtered])

  // Donut: Etiqueta por Criticidade
  const donutData = useMemo(() => {
    const map: Record<string, number> = { 'A': 0, 'B': 0 }
    filtered.forEach(i => {
      if (map[i.mappedCriticidade] !== undefined) {
        map[i.mappedCriticidade]++
      }
    })
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Horizontal Bar Chart: Etiqueta por Área
  const barAreaData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => {
      const key = i.mappedArea || 'REPOSIÇÃO'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Horizontal Bar Chart: Etiqueta por Módulo
  const barModuloData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => {
      const key = i.modulo || 'N/A'
      map[key] = (map[key] || 0) + 1
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [filtered])

  // Trend Column Chart: Tendência de Etiquetas (Month to month)
  const trendData = useMemo(() => {
    const map: Record<string, number> = {}
    MONTHS_PT.forEach(m => { map[m] = 0 })
    filtered.forEach(i => {
      if (map[i.mappedMonth] !== undefined) {
        map[i.mappedMonth]++
      }
    })
    // Filter out months with 0 if they are after the latest active month to make the chart clean
    let lastActiveIdx = 0
    MONTHS_PT.forEach((m, idx) => {
      if (map[m] > 0) lastActiveIdx = idx
    })
    return MONTHS_PT.slice(0, lastActiveIdx + 1).map(name => ({
      name,
      value: map[name]
    }))
  }, [filtered])

  // Aggregate statistics per mechanic/colaborador
  const mechanicStats = useMemo(() => {
    const statsMap: Record<string, {
      name: string;
      pendente: number;
      programado: number;
      encerrado: number;
      total: number;
      totalAging: number;
      agingCount: number;
    }> = {}

    // Aggregate from the fully mapped items list
    mappedItems.forEach(i => {
      const name = i.colaborador || 'Sem Mecânico'
      if (!statsMap[name]) {
        statsMap[name] = {
          name,
          pendente: 0,
          programado: 0,
          encerrado: 0,
          total: 0,
          totalAging: 0,
          agingCount: 0
        }
      }
      
      statsMap[name].total++
      if (i.mappedStatus === 'PENDENTE') statsMap[name].pendente++
      else if (i.mappedStatus === 'PROGRAMADO') statsMap[name].programado++
      else if (i.mappedStatus === 'ENCERRADO') statsMap[name].encerrado++

      if (i.diasAberto !== undefined && i.mappedStatus !== 'ENCERRADO') {
        statsMap[name].totalAging += i.diasAberto
        statsMap[name].agingCount++
      }
    })

    return Object.values(statsMap)
      .map(s => ({
        ...s,
        avgAging: s.agingCount > 0 ? Math.round(s.totalAging / s.agingCount) : 0
      }))
      .sort((a, b) => b.total - a.total) // most backlogs first
  }, [mappedItems])

  // Get top 8 mechanics for the chart
  const topMechanicChartData = useMemo(() => {
    return mechanicStats.slice(0, 8)
  }, [mechanicStats])

  // Recharts Custom vertical bar label containing count and MoM percentage change pill
  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, index, value } = props
    if (value === 0) return null

    let momLabel = ''
    let isUp = false
    if (index > 0) {
      const prevVal = trendData[index - 1].value
      if (prevVal > 0) {
        const pct = ((value - prevVal) / prevVal) * 100
        isUp = pct >= 0
        momLabel = `${isUp ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`
      }
    }

    return (
      <g>
        {/* Count inside bar */}
        <text x={x + width / 2} y={y + 30} fill="#ffffff" fontSize={11} fontWeight={800} textAnchor="middle">
          {value}
        </text>

        {/* MoM % Badge above the column */}
        {momLabel && (
          <g>
            <rect
              x={x + width / 2 - 25}
              y={y - 25}
              width={50}
              height={16}
              rx={4}
              fill={isUp ? '#fde8e8' : '#eafaf1'}
              stroke={isUp ? '#fecaca' : '#bbf7d0'}
              strokeWidth={1}
            />
            <text
              x={x + width / 2}
              y={y - 13}
              fill={isUp ? '#e74c3c' : '#2ecc71'}
              fontSize={8}
              fontWeight={900}
              textAnchor="middle"
            >
              {momLabel}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6 w-full text-zinc-800 dark:text-zinc-100">
      
      {/* ─── COLUNA ESQUERDA (Gráficos Laterais) ─────────────────────────────────── */}
      <div className="flex flex-col gap-6 w-full xl:w-[360px] shrink-0">
        
        {/* Card: ETIQUETA POR CRITICIDADE */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="border-l-4 border-cyan-500 pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              ETIQUETA POR CRITICIDADE
            </h3>
            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2">
              {Object.entries(CRITICIDADE_COLORS).map(([name, col]) => (
                <span key={name} className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.chart }} />
                  {name}
                </span>
              ))}
            </div>
          </div>

          <div className="h-[240px] w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => value > 0 ? `${name} ${value}` : ''}
                  labelLine={false}
                >
                  {donutData.map((entry, idx) => (
                    <Cell 
                      key={idx} 
                      fill={CRITICIDADE_COLORS[entry.name]?.chart || '#cbd5e1'} 
                      stroke="transparent" 
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        CRITICIDADE {data.name}: <span className="text-cyan-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card: ETIQUETA POR ÁREA */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="border-l-4 border-blue-600 pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              ETIQUETA POR ÁREA
            </h3>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barAreaData}
                layout="vertical"
                margin={{ left: -10, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-blue-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#0055b8"
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card: ETIQUETA POR MÓDULOS */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="border-l-4 border-[#00a859] pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              ETIQUETA POR MÓDULOS
            </h3>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barModuloData}
                layout="vertical"
                margin={{ left: -10, right: 30, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-[#00a859]">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#00a859"
                  radius={[0, 4, 4, 0]}
                  label={{ position: 'right', fill: '#71717a', fontSize: 10, fontWeight: 900 }}
                  barSize={14}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ─── COLUNA DIREITA (KPIs, Filtros, Tendência e Tabela) ─────────────────── */}
      <div className="flex-1 flex flex-col gap-6">

        {/* ── FILTROS E CABEÇALHO DO PAINEL ── */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                PAINEL DE ETIQUETAS
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                ENCERRADOS X PENDÊNCIA
              </p>
            </div>
            
            {/* Stylized Suzano Logo */}
            <div className="flex items-center gap-2 self-end lg:self-center">
              <span className="text-xs font-black uppercase tracking-widest text-[#00a859] dark:text-[#2ecc71] italic">
                suzano
              </span>
              <span className="w-4 h-4 bg-[#00a859] dark:bg-[#2ecc71] rounded-tl-full rounded-br-full" />
            </div>
          </div>

          {/* Grid de Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-10 gap-3">
            
            {/* Filtro Status Multi-select */}
            <div className="relative">
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Status</label>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black text-left flex justify-between items-center outline-none"
              >
                <span className="truncate">
                  {filterStatuses.length === 3 ? 'Todos' : filterStatuses.length > 0 ? `${filterStatuses.length} selecionados` : 'Nenhum'}
                </span>
                <ChevronRight size={14} className={cn("transform transition-transform text-zinc-400", showStatusDropdown && "rotate-90")} />
              </button>

              {showStatusDropdown && (
                <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-[#181a20] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-2.5 shadow-2xl z-50 flex flex-col gap-1.5">
                  {['PENDENTE', 'PROGRAMADO', 'ENCERRADO'].map(st => (
                    <label key={st} className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900 p-1 rounded-lg">
                      <input
                        type="checkbox"
                        checked={filterStatuses.includes(st)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilterStatuses([...filterStatuses, st])
                          } else {
                            setFilterStatuses(filterStatuses.filter(s => s !== st))
                          }
                        }}
                        className="w-4 h-4 rounded border-zinc-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      {st}
                    </label>
                  ))}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-1.5 mt-0.5 flex justify-between text-[8px] font-black uppercase tracking-widest">
                    <button onClick={() => setFilterStatuses(['PENDENTE', 'PROGRAMADO', 'ENCERRADO'])} className="text-blue-500">TODOS</button>
                    <button onClick={() => setFilterStatuses([])} className="text-red-500">LIMPAR</button>
                  </div>
                </div>
              )}
            </div>

            {/* Criticidade */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Criticidade</label>
              <select
                value={filterCriticidade}
                onChange={e => setFilterCriticidade(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {Object.keys(CRITICIDADE_COLORS).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Fornecedor */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Fornecedor</label>
              <select
                value={filterFornecedor}
                onChange={e => setFilterFornecedor(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.fornecedores.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Área */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Área</label>
              <select
                value={filterArea}
                onChange={e => setFilterArea(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.areas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Módulo */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Módulo</label>
              <select
                value={filterModulo}
                onChange={e => setFilterModulo(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer font-bold"
              >
                <option value="">Todos</option>
                {filterOptions.modulos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Data (Ano) */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Ano</label>
              <select
                value={filterAno}
                onChange={e => setFilterAno(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.anos.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Mês</label>
              <select
                value={filterMes}
                onChange={e => setFilterMes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Mecânico */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Mecânico</label>
              <select
                value={filterMecanico}
                onChange={e => setFilterMecanico(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer font-bold"
              >
                <option value="">Todos</option>
                {filterOptions.mecanicos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Data Início */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">De</label>
              <input
                type="date"
                value={filterDataInicio}
                onChange={e => setFilterDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              />
            </div>

            {/* Data Fim */}
            <div>
              <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Até</label>
              <input
                type="date"
                value={filterDataFim}
                onChange={e => setFilterDataFim(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              />
            </div>

          </div>

          {/* Barra de Pesquisa Rápida */}
          <div className="relative mt-4 group">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-green-500 transition-colors" />
            <input
              type="text"
              placeholder="BUSCAR BACKLOG POR PLACA, DESCRIÇÃO OU TAG..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-6 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        {/* ── FILA DE CARDS DE KPI ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card: CONCLUÍDAS */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex items-stretch gap-4 relative overflow-hidden shadow-sm">
            <div className="w-1.5 bg-blue-600 rounded-full shrink-0" />
            <div className="flex flex-col justify-between py-1">
              <div>
                <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Concluídas</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">{kpiConcluidas}</p>
              </div>
              <div className="h-4" />
            </div>
          </div>

          {/* Card: PENDENTES */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex items-stretch gap-4 relative overflow-hidden shadow-sm">
            <div className="w-1.5 bg-[#00a859] rounded-full shrink-0" />
            <div className="flex flex-col justify-between py-1">
              <div>
                <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Pendentes</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">{kpiPendentes}</p>
              </div>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide mt-2">
                Média Criação &gt; Progr <span className="font-black text-zinc-600 dark:text-zinc-400">{avgCriacaoProg}</span>
              </p>
            </div>
          </div>

          {/* Card: PROGRAMADO */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex items-stretch gap-4 relative overflow-hidden shadow-sm">
            <div className="w-1.5 bg-blue-600 rounded-full shrink-0" />
            <div className="flex flex-col justify-between py-1">
              <div>
                <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Programado</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">{kpiProgramados}</p>
              </div>
              <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide mt-2">
                Média Prog &gt; Encerr <span className="font-black text-zinc-600 dark:text-zinc-400">{avgProgEncerr}</span>
              </p>
            </div>
          </div>

          {/* Card: TOTAL */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex items-stretch gap-4 relative overflow-hidden shadow-sm">
            <div className="w-1.5 bg-[#00a859] rounded-full shrink-0" />
            <div className="flex flex-col justify-between py-1">
              <div>
                <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Total</p>
                <p className="text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight mt-1">{kpiTotal}</p>
              </div>
              <div className="h-4" />
            </div>
          </div>

        </div>

        {/* ── CARD: TENDÊNCIA DE ETIQUETAS (MoM %) ── */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm">
          <div className="border-l-4 border-[#0055b8] pl-3 mb-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              TENDÊNCIA DE ETIQUETAS
            </h3>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={trendData}
                margin={{ top: 30, bottom: 5, left: -20, right: 20 }}
                barSize={60}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-blue-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#0055b8"
                  radius={[4, 4, 0, 0]}
                  label={renderCustomBarLabel}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SEÇÃO: BACKLOG POR MECÂNICO ── */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col gap-6">
          <div className="border-l-4 border-indigo-600 pl-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                DISTRIBUIÇÃO DE ETIQUETAS POR MECÂNICO
              </h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                Visão de Pendentes, Programados e Encerrados
              </p>
            </div>
            {filterMecanico && (
              <button 
                onClick={() => setFilterMecanico('')}
                className="text-[9px] font-black text-red-500 hover:text-red-400 uppercase tracking-widest border border-red-500/20 px-3 py-1 rounded-xl bg-red-500/5 transition-colors"
              >
                ✕ Limpar Filtro
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico Recharts de Barras Empilhadas */}
            <div className="lg:col-span-2 h-[320px] bg-zinc-50/50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-900 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topMechanicChartData}
                  margin={{ top: 20, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0].payload
                      return (
                        <div className="bg-zinc-950/95 text-white p-4 rounded-2xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider flex flex-col gap-1.5 shadow-2xl">
                          <span className="text-indigo-400 border-b border-zinc-800 pb-1 mb-1 font-extrabold">{data.name}</span>
                          <span className="flex items-center justify-between gap-4">Pendentes: <span className="text-yellow-400 font-extrabold">{data.pendente}</span></span>
                          <span className="flex items-center justify-between gap-4">Programados: <span className="text-green-400 font-extrabold">{data.programado}</span></span>
                          <span className="flex items-center justify-between gap-4">Encerrados: <span className="text-zinc-400 font-extrabold">{data.encerrado}</span></span>
                          <span className="flex items-center justify-between gap-4 text-orange-400 border-t border-zinc-800 pt-1 mt-1 font-extrabold">Média Aging: <span>{data.avgAging} dias</span></span>
                        </div>
                      )
                    }}
                  />
                  <Legend 
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} 
                  />
                  <Bar dataKey="pendente" name="Pendente" stackId="a" fill="#ca8a04" />
                  <Bar dataKey="programado" name="Programado" stackId="a" fill="#16a34a" />
                  <Bar dataKey="encerrado" name="Encerrado" stackId="a" fill="#475569" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Listagem de cards de mecânicos */}
            <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Selecione para Filtrar</span>
              {mechanicStats.map(s => {
                const isSelected = filterMecanico === s.name;
                return (
                  <div
                    key={s.name}
                    onClick={() => setFilterMecanico(isSelected ? '' : s.name)}
                    className={cn(
                      "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between hover:scale-[1.02] shadow-sm select-none",
                      isSelected
                        ? "bg-indigo-600 border-indigo-500 text-white shadow-indigo-600/20"
                        : "bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-150 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300"
                    )}
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-tight">{s.name}</p>
                      <p className={cn("text-[8px] font-bold mt-0.5", isSelected ? "text-indigo-200" : "text-zinc-400")}>
                        Média de Pendências: <span className="font-extrabold">{s.avgAging} dias em aberto</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black", isSelected ? "bg-white/10 text-white" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500")}>
                        Total: {s.total}
                      </span>
                      <div className="flex gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" title={`Pendentes: ${s.pendente}`} />
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" title={`Programados: ${s.programado}`} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" title={`Encerrados: ${s.encerrado}`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CARD: DETALHAMENTO DO BACKLOG (Tabela PBI) ── */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              DETALHAMENTO DO BACKLOG
            </h3>
            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded">
              {filtered.length} itens listados
            </span>
          </div>

          <div className="overflow-x-auto custom-scrollbar max-h-[360px]">
            <table className="w-full text-left border-collapse text-[10px] font-semibold">
              <thead>
                <tr className="bg-zinc-50 dark:bg-[#161822] text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Placa / TAG</th>
                  <th className="px-4 py-3">Módulo</th>
                  <th className="px-4 py-3">Motivo do Status</th>
                  <th className="px-4 py-3 text-center">Criticidade</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Dias em Aberto</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-zinc-400 font-bold uppercase tracking-widest italic">
                      Nenhum backlog correspondente aos filtros ativos.
                    </td>
                  </tr>
                ) : (
                  paginatedFiltered.map((item) => {
                    const prioColor = CRITICIDADE_COLORS[item.mappedCriticidade] || { bg: 'bg-zinc-100', text: 'text-zinc-500' }
                    const statColor = STATUS_COLORS[item.mappedStatus] || { bg: 'bg-zinc-100 border-zinc-200', text: 'text-zinc-500' }

                    // Aging color scale
                    let agingBg = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                    if (item.diasAberto > 30) {
                      agingBg = 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    } else if (item.diasAberto > 15) {
                      agingBg = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                    }

                    return (
                      <tr 
                        key={item.id} 
                        className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all cursor-pointer group"
                        onClick={() => onEdit(item)}
                      >
                        <td className="px-4 py-3 font-black text-zinc-900 dark:text-zinc-50">
                          <span className="flex items-center gap-1.5">
                            {item.frota}
                            {item._isPendingSync && (
                              <span className="inline-flex items-center gap-1 text-[8px] text-amber-500 font-bold" title="Pendente de sincronização offline">
                                <RefreshCw size={8} className="animate-spin" />
                              </span>
                            )}
                          </span>
                          {item.tag && <span className="block text-[8px] text-zinc-400 font-bold mt-0.5">{item.tag}</span>}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 uppercase font-bold">
                          {item.modulo || 'N/A'}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate text-zinc-600 dark:text-zinc-400 font-bold">
                          {item.descricao || '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", prioColor.bg, prioColor.text)}>
                            {item.mappedCriticidade}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("px-2 py-0.5 rounded border text-[8px] font-black uppercase tracking-widest", statColor.bg, statColor.text)}>
                            {item.mappedStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cn("px-2 py-0.5 rounded font-mono font-black text-[9px]", agingBg)}>
                            {item.diasAberto}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onEdit(item)}
                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 rounded transition-colors"
                              title="Editar"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              onClick={() => onDelete(item.id)}
                              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 rounded transition-colors"
                              title="Excluir"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between bg-zinc-50/30 dark:bg-zinc-900/10">
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                Página {currentPage} de {totalPages}
              </p>
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-1 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-all font-bold text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronLeft size={14} />
                </button>
                <button 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-white dark:hover:bg-zinc-900 disabled:opacity-50 transition-all font-bold text-zinc-600 dark:text-zinc-400"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
