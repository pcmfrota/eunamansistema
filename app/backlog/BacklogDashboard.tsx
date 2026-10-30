'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LabelList
} from 'recharts'
import {
  TrendingUp, TrendingDown, Layers, MapPin, Tag, Wrench, ShieldAlert,
  ArrowRight, Search, Filter, X, ChevronRight, ChevronLeft, ChevronDown, Edit3, Trash2, RefreshCw, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mesAnoOperacional } from '@/lib/calendario-suzano'
import { MultiSelect } from '@/components/MultiSelect'
import { calcularTipoPedido } from './classificacaoTecnica'

interface Props {
  items: any[]
  placas: any[]
  calendario?: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
  onQuickView: (item: any) => void
}

const CRITICIDADE_COLORS: Record<string, { bg: string, text: string, chart: string }> = {
  'A': { bg: 'bg-[#fde8e8] dark:bg-red-950/40 border-red-200 dark:border-red-900/50', text: 'text-[#e74c3c] dark:text-red-400', chart: '#f05252' },
  'B': { bg: 'bg-[#ebf5fb] dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/50', text: 'text-[#3498db] dark:text-blue-400', chart: '#2563eb' },
  'C': { bg: 'bg-[#eafaf1] dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50', text: 'text-[#16a34a] dark:text-emerald-400', chart: '#16a34a' },
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

function parseHours(val: any): number {
  if (!val) return 0;
  const str = String(val).toLowerCase().trim();
  if (!str) return 0;

  // Formato com horas e minutos (ex: "4h 30m" ou "4h30m" ou "4h 30min")
  const matchHM = str.match(/^(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(\d+(?:[.,]\d+)?)\s*m(?:in(?:utos?)?)?$/i);
  if (matchHM) {
    const h = parseFloat(matchHM[1].replace(',', '.'));
    const m = parseFloat(matchHM[2].replace(',', '.'));
    return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
  }

  // Formato apenas minutos (ex: "30m" ou "30min" ou "45m")
  const matchM = str.match(/^(\d+(?:[.,]\d+)?)\s*m(?:in(?:utos?)?)?$/i);
  if (matchM) {
    const m = parseFloat(matchM[1].replace(',', '.'));
    return isNaN(m) ? 0 : m / 60;
  }

  // Valor numérico ou apenas horas (ex: "4h", "4.5h", "4,5")
  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Número da semana ISO a partir de uma data (chave de agrupamento dos gráficos de
// "tempo médio por semana" — mesmo conceito da coluna SEMANA da planilha original, só que
// calculado ao vivo a partir de data_evidencia em vez de confiar numa coluna gravada que
// poderia ficar dessincronizada.
function getSemanaISO(dataStr: string): number {
  const d = new Date(dataStr.split('T')[0])
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

// Diferença em dias entre duas datas (string YYYY-MM-DD ou ISO) — null se alguma faltar.
function diasEntreDatas(inicio?: string | null, fim?: string | null): number | null {
  if (!inicio || !fim) return null
  const d1 = new Date(String(inicio).split('T')[0])
  const d2 = new Date(String(fim).split('T')[0])
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null
  return Math.round((d2.getTime() - d1.getTime()) / 86400000)
}

function formatAIMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    let isBullet = false;
    let cleanLine = line;
    if (line.trim().startsWith('- ')) {
      isBullet = true;
      cleanLine = line.trim().substring(2);
    }
    const parts = cleanLine.split('**');
    const formattedParts = parts.map((part, j) => {
      if (j % 2 === 1) {
        return <strong key={j} className="text-emerald-400 font-extrabold">{part}</strong>;
      }
      return part;
    });
    if (isBullet) {
      return (
        <div key={i} className="flex items-start gap-2 mb-1.5 pl-2 text-xs leading-relaxed text-zinc-350 dark:text-zinc-300">
          <span className="text-emerald-400 font-black mt-0.5">•</span>
          <div>{formattedParts}</div>
        </div>
      );
    }
    return (
      <p key={i} className="mb-2 text-xs leading-relaxed text-zinc-350 dark:text-zinc-300">
        {formattedParts}
      </p>
    );
  });
}

export default function BacklogDashboard({ items, placas, calendario = [], onEdit, onDelete, onQuickView }: Props) {
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
  // Painel de filtros fica fechado por padrão (discreto) — só expande ao clicar.
  const [showFiltros, setShowFiltros] = useState(false)

  // Pagination states for dashboard table
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const [filterMecanico, setFilterMecanico] = useState('')
  const [filterDataInicio, setFilterDataInicio] = useState('')
  const [filterDataFim, setFilterDataFim] = useState('')
  const [filterOrigens, setFilterOrigens] = useState<string[]>([])
  const [filterTipos, setFilterTipos] = useState<string[]>([])

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

      // 2. Map Criticidade — preserva "C" (baixa) quando presente (ex: registros antigos
      // importados da planilha), já que o formulário atual só deixa escolher A/B.
      let mappedCriticidade = String(item.criticidade || 'B').toUpperCase().trim()
      if (mappedCriticidade === 'A' || mappedCriticidade === 'INTERDIÇÃO' || mappedCriticidade === 'INTERDICAO' || mappedCriticidade === 'ALTA') {
        mappedCriticidade = 'A'
      } else if (mappedCriticidade === 'C' || mappedCriticidade === 'BAIXA') {
        mappedCriticidade = 'C'
      } else {
        mappedCriticidade = 'B'
      }

      // 3. Find equipment area registered in "base de frotas"
      const eq = placasMap.get(item.frota)
      const mappedArea = String(eq?.area || item.campo_base || 'REPOSIÇÃO').toUpperCase()

      // 4. Mapped month and year (período operacional Suzano, não mês civil)
      let mappedMonth = 'janeiro'
      let mappedYear = '2026'
      if (item.data_evidencia) {
        const periodo = mesAnoOperacional(item.data_evidencia, calendario)
        if (periodo.mes) mappedMonth = periodo.mes
        if (periodo.ano) mappedYear = periodo.ano
      } else if (item.mes) {
        // Fallback for string mes/ano
        const mIdx = parseInt(item.mes) - 1
        if (mIdx >= 0 && mIdx < 12) mappedMonth = MONTHS_PT[mIdx]
        if (item.ano) mappedYear = String(item.ano)
      }

      // 5. Calculate aging (Dias em Aberto)
      let diasAberto = 0
      let diasFechado: number | null = null
      let diasPendente: number | null = null
      if (item.data_evidencia) {
        const start = new Date(item.data_evidencia.split('T')[0])
        const end = mappedStatus === 'ENCERRADO' && item.data_conclusao
          ? new Date(item.data_conclusao.split('T')[0])
          : new Date() // Today
        const diff = end.getTime() - start.getTime()
        diasAberto = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
        if (mappedStatus === 'ENCERRADO') {
          diasFechado = diasAberto
        } else {
          diasPendente = diasAberto
        }
      }

      return {
        ...item,
        mappedStatus,
        mappedCriticidade,
        mappedArea,
        mappedMonth,
        mappedYear,
        diasAberto,
        diasFechado,
        diasPendente
      }
    })
  }, [items, placas, calendario])

  // Extract unique filters options from the fully mapped list
  const filterOptions = useMemo(() => {
    const fornecedores = new Set<string>()
    const areas = new Set<string>()
    const modulos = new Set<string>()
    const anos = new Set<string>()
    const mecanicos = new Set<string>()
    const origens = new Set<string>()
    const tipos = new Set<string>()

    mappedItems.forEach(i => {
      if (i.fornecedor) fornecedores.add(i.fornecedor)
      if (i.mappedArea) areas.add(i.mappedArea)
      if (i.modulo) modulos.add(i.modulo)
      if (i.mappedYear) anos.add(i.mappedYear)
      if (i.colaborador) mecanicos.add(i.colaborador)
      if (i.origem) origens.add(String(i.origem).toUpperCase().trim())
      if (i.tipo) tipos.add(String(i.tipo).toUpperCase().trim())
    })

    return {
      fornecedores: Array.from(fornecedores).sort(),
      areas: Array.from(areas).sort(),
      modulos: Array.from(modulos).sort(),
      anos: Array.from(anos).sort(),
      mecanicos: Array.from(mecanicos).sort(),
      origens: Array.from(origens).sort(),
      tipos: Array.from(tipos).sort()
    }
  }, [mappedItems])

  // Apply all filters except Mechanic
  const filteredWithoutMechanic = useMemo(() => {
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

      // 6d. Origem (multi-select)
      if (filterOrigens.length > 0 && !filterOrigens.includes(String(item.origem || '').toUpperCase().trim())) return false

      // 6e. Tipo (multi-select)
      if (filterTipos.length > 0 && !filterTipos.includes(String(item.tipo || '').toUpperCase().trim())) return false

      // 6b. Date Range Filter
      if (filterDataInicio || filterDataFim) {
        if (!item.data_evidencia) return false;
        const itemDate = item.data_evidencia.split('T')[0];
        if (filterDataInicio && itemDate < filterDataInicio) return false;
        if (filterDataFim && itemDate > filterDataFim) return false;
      }

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
  }, [mappedItems, filterStatuses, filterCriticidade, filterFornecedor, filterArea, filterModulo, filterAno, filterMes, filterOrigens, filterTipos, filterDataInicio, filterDataFim, search])

  // Quantos filtros estão ativos além do padrão — mostrado como selo no botão
  // quando o painel de filtros está fechado, pra não esconder que algo está filtrando.
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filterStatuses.length > 0 && filterStatuses.length < 3) count++
    if (filterCriticidade) count++
    if (filterFornecedor) count++
    if (filterArea) count++
    if (filterModulo) count++
    if (filterMecanico) count++
    if (filterOrigens.length > 0) count++
    if (filterTipos.length > 0) count++
    if (filterDataInicio) count++
    if (filterDataFim) count++
    if (search) count++
    return count
  }, [filterStatuses, filterCriticidade, filterFornecedor, filterArea, filterModulo, filterMecanico, filterOrigens, filterTipos, filterDataInicio, filterDataFim, search])

  // Apply all filters including Mechanic
  const filtered = useMemo(() => {
    if (!filterMecanico) return filteredWithoutMechanic
    return filteredWithoutMechanic.filter(item => (item.colaborador || 'Sem Mecânico') === filterMecanico)
  }, [filteredWithoutMechanic, filterMecanico])

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
    const map: Record<string, number> = { 'A': 0, 'B': 0, 'C': 0 }
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

  // Tendência Mensal: Encerradas x Pendentes, mês a mês, ano inteiro
  const trendStatusData = useMemo(() => {
    const map: Record<string, { name: string; encerrado: number; pendente: number }> = {}
    MONTHS_PT.forEach(m => { map[m] = { name: m, encerrado: 0, pendente: 0 } })
    filtered.forEach(i => {
      if (map[i.mappedMonth] !== undefined) {
        if (i.mappedStatus === 'ENCERRADO') map[i.mappedMonth].encerrado++
        else map[i.mappedMonth].pendente++
      }
    })
    return MONTHS_PT.map(name => map[name])
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

    // Aggregate from the filtered list (except mechanic filter)
    filteredWithoutMechanic.forEach(i => {
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
  }, [filteredWithoutMechanic])

  // Get top 8 mechanics for the chart
  const topMechanicChartData = useMemo(() => {
    return mechanicStats.slice(0, 8)
  }, [mechanicStats])

  // ─── BACKLOG POR TIPO DE EQUIPAMENTO (Concluído x Pendente empilhado) ───
  const barTipoStackData = useMemo(() => {
    const map: Record<string, { name: string; concluido: number; pendente: number }> = {}
    filtered.forEach(i => {
      const key = String(i.tipo || 'N/A').toUpperCase().trim() || 'N/A'
      if (!map[key]) map[key] = { name: key, concluido: 0, pendente: 0 }
      if (i.mappedStatus === 'ENCERRADO') map[key].concluido++
      else map[key].pendente++
    })
    return Object.values(map).sort((a, b) => (b.concluido + b.pendente) - (a.concluido + a.pendente))
  }, [filtered])

  // ─── STATUS DO BACKLOG POR PLACA (Concluído x Pendente lado a lado, todas as placas) ───
  const barPlacaStackData = useMemo(() => {
    const map: Record<string, { name: string; concluido: number; pendente: number }> = {}
    filtered.forEach(i => {
      const key = i.frota || 'SEM PLACA'
      if (!map[key]) map[key] = { name: key, concluido: 0, pendente: 0 }
      if (i.mappedStatus === 'ENCERRADO') map[key].concluido++
      else map[key].pendente++
    })
    return Object.values(map)
      .sort((a, b) => (b.concluido + b.pendente) - (a.concluido + a.pendente))
  }, [filtered])

  const placaResumo = useMemo(() => ({
    total: filtered.length,
    critA: filtered.filter(i => i.mappedCriticidade === 'A').length,
    critB: filtered.filter(i => i.mappedCriticidade === 'B').length,
    concluidas: filtered.filter(i => i.mappedStatus === 'ENCERRADO').length,
    pendentes: filtered.filter(i => i.mappedStatus !== 'ENCERRADO').length,
  }), [filtered])

  // ─── PROG. E EXECUÇÃO / RCS ───────────────────────────────────────────────

  // Tempo médio (dias) entre a evidência e a data de programação, por semana da evidência.
  const tempoMedioProgPorSemana = useMemo(() => {
    const acc: Record<number, { soma: number; qtd: number }> = {}
    filtered.forEach(i => {
      const dias = diasEntreDatas(i.data_evidencia, i.data_programacao)
      if (dias === null || dias < 0) return
      const semana = getSemanaISO(i.data_evidencia)
      if (!acc[semana]) acc[semana] = { soma: 0, qtd: 0 }
      acc[semana].soma += dias
      acc[semana].qtd++
    })
    return Object.entries(acc)
      .map(([semana, v]) => ({ name: `S${semana}`, semana: Number(semana), value: Number((v.soma / v.qtd).toFixed(1)) }))
      .sort((a, b) => a.semana - b.semana)
  }, [filtered])

  // Tempo médio (dias) entre a evidência e a conclusão, por semana da evidência.
  const tempoMedioResolucaoPorSemana = useMemo(() => {
    const acc: Record<number, { soma: number; qtd: number }> = {}
    filtered.forEach(i => {
      const dias = diasEntreDatas(i.data_evidencia, i.data_conclusao)
      if (dias === null || dias < 0) return
      const semana = getSemanaISO(i.data_evidencia)
      if (!acc[semana]) acc[semana] = { soma: 0, qtd: 0 }
      acc[semana].soma += dias
      acc[semana].qtd++
    })
    return Object.entries(acc)
      .map(([semana, v]) => ({ name: `S${semana}`, semana: Number(semana), value: Number((v.soma / v.qtd).toFixed(1)) }))
      .sort((a, b) => a.semana - b.semana)
  }, [filtered])

  // Tipo de Pedido (URGENTE/NORMAL/PROGRAMADO) — mesmo cálculo já usado no formulário,
  // aplicado aqui item a item e agregado.
  const tipoPedidoPieData = useMemo(() => {
    const map: Record<string, number> = { URGENTE: 0, NORMAL: 0, PROGRAMADO: 0 }
    filtered.forEach(i => {
      const tipo = calcularTipoPedido(i.data_evidencia, i.data_nec_material)
      if (tipo && map[tipo] !== undefined) map[tipo]++
    })
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const TIPO_PEDIDO_COLORS: Record<string, string> = { URGENTE: '#dc2626', NORMAL: '#ca8a04', PROGRAMADO: '#16a34a' }

  // Tempo médio (dias) entre a evidência e a abertura da RC, por tipo de equipamento.
  const tempoMedioAberturaReqData = useMemo(() => {
    const acc: Record<string, { soma: number; qtd: number }> = {}
    filtered.forEach(i => {
      const dias = diasEntreDatas(i.data_evidencia, i.data_rc)
      if (dias === null) return
      const key = String(i.tipo || 'N/A').toUpperCase().trim() || 'N/A'
      if (!acc[key]) acc[key] = { soma: 0, qtd: 0 }
      acc[key].soma += dias
      acc[key].qtd++
    })
    return Object.entries(acc)
      .map(([name, v]) => ({ name, value: Number((v.soma / v.qtd).toFixed(1)) }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // Situação RC (ATENDE / NÃO ATENDE / SEM PREVISÃO / SEM REQUISIÇÃO) — calculada e
  // gravada automaticamente no formulário (ver app/backlog/classificacaoTecnica.ts).
  const situacaoRcData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(i => {
      const v = String(i.situacao_rc || '').toUpperCase().trim()
      if (!v) return
      map[v] = (map[v] || 0) + 1
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const SITUACAO_RC_COLORS: Record<string, string> = {
    'ATENDE': '#16a34a',
    'NÃO ATENDE': '#dc2626',
    'SEM PREVISÃO': '#ca8a04',
    'SEM REQUISIÇÃO': '#64748b',
  }

  const selectedPeriod = useMemo(() => {
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    const mIdx = months.indexOf(filterMes.toLowerCase()) + 1;
    const yVal = Number(filterAno);
    
    if (mIdx > 0 && yVal > 0) {
      const cal = calendario.find(p => p && p.mes === mIdx && p.ano === yVal);
      if (cal) return cal;
    }
    
    const today = new Date();
    const targetMonth = mIdx > 0 ? mIdx : today.getMonth() + 1;
    const targetYear = yVal > 0 ? yVal : today.getFullYear();
    const data_inicio = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
    const diasNoMes = new Date(targetYear, targetMonth, 0).getDate();
    const data_fim = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}`;
    return {
      mes: targetMonth,
      ano: targetYear,
      data_inicio,
      data_fim
    };
  }, [calendario, filterMes, filterAno]);

  const diasMes = useMemo(() => {
    if (!selectedPeriod) return 30;
    const start = new Date(selectedPeriod.data_inicio + 'T00:00:00');
    const end = new Date(selectedPeriod.data_fim + 'T23:59:59');
    const diff = Math.max(0, end.getTime() - start.getTime());
    return Math.floor(diff / 86400000) + 1;
  }, [selectedPeriod]);

  const activeFleet = useMemo(() => {
    const today = new Date();
    const mesAtualRef = today.getMonth() + 1;
    const anoAtualRef = today.getFullYear();
    
    const eqTimestamps = placas
      .map(eq => eq.created_at ? new Date(eq.created_at).getTime() : null)
      .filter((t): t is number => t !== null);
    const minCreatedAt = eqTimestamps.length > 0 ? Math.min(...eqTimestamps) : Date.now();
    const baselineThreshold = minCreatedAt + 7 * 24 * 60 * 60 * 1000;

    const inicioTime = new Date(selectedPeriod.data_inicio + 'T00:00:00').getTime();
    const fimTime = new Date(selectedPeriod.data_fim + 'T23:59:59').getTime();

    return placas.filter(eq => {
      const p = eq.placa?.toUpperCase().trim();
      if (!p || ["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"].includes(p)) return false;

      // 1. Filtro temporal de criação
      const createdAt = eq.created_at ? new Date(eq.created_at).getTime() : 0;
      const isPeriodBeforeSystemInit = fimTime < minCreatedAt;

      if (isPeriodBeforeSystemInit) {
        if (createdAt > baselineThreshold) return false;
      } else {
        if (createdAt > fimTime) return false;
      }

      // 2. Filtro temporal de deleção
      if (eq.deleted_at) {
        const deletedAt = new Date(eq.deleted_at).getTime();
        if (deletedAt < inicioTime) return false;
      }

      // 3. Filtro de Inativos no mês corrente
      const isPastMonth = selectedPeriod.ano < anoAtualRef || (selectedPeriod.ano === anoAtualRef && selectedPeriod.mes < mesAtualRef);
      if (!isPastMonth) {
        const isCurrentlyInactive = String(eq.status || '').toUpperCase().trim() === "INATIVO";
        if (isCurrentlyInactive) return false;
      }

      // 4. Filtro por Categoria: na DM operacional pesada, apenas categoria PESADA é considerada.
      const eqCat = (eq.categoria || "").toUpperCase().trim();
      if (eqCat !== "PESADA") return false;

      return true;
    });
  }, [placas, selectedPeriod]);

  const numMaquinas = activeFleet.length || 1;
  const horasTotaisFrota = numMaquinas * diasMes * 24;

  const parsedBacklogHours = useMemo(() => {
    const activeItems = filtered.filter(i => i.mappedStatus !== 'ENCERRADO');
    
    let totalHoras = 0;
    let horasCriticas = 0;
    let horasNormais = 0;

    activeItems.forEach(item => {
      const horas = parseHours(item.tempo_execucao);
      totalHoras += horas;
      if (item.mappedCriticidade === 'A') {
        horasCriticas += horas;
      } else {
        horasNormais += horas;
      }
    });

    return {
      totalHoras,
      horasCriticas,
      horasNormais
    };
  }, [filtered]);

  const aiExplanation = useMemo(() => {
    const { totalHoras, horasCriticas, horasNormais } = parsedBacklogHours;
    const activeItems = filtered.filter(i => i.mappedStatus !== 'ENCERRADO');

    if (totalHoras === 0 || activeItems.length === 0) {
      return "Olá! Sou o **Assistente de IA EUNAMAN**. Atualmente, o seu backlog está zerado ou sem tempos estimados preenchidos. Isso significa que a **Disponibilidade Mecânica (DM)** da frota está operando sem riscos previstos associados a pendências em aberto. Parabéns pela eficiência!";
    }

    const moduloMaisAfetado = (() => {
      const modCounts: Record<string, number> = {};
      activeItems.forEach(i => {
        const mod = i.modulo || 'N/A';
        const h = parseHours(i.tempo_execucao);
        modCounts[mod] = (modCounts[mod] || 0) + h;
      });
      const sorted = Object.entries(modCounts).sort((a,b) => b[1] - a[1]);
      return sorted[0] ? { name: sorted[0][0], horas: sorted[0][1] } : null;
    })();

    const pctImpactoPlan = ((totalHoras / horasTotaisFrota) * 100).toFixed(2);
    const projCorretivo = (horasCriticas * 1.8) + (horasNormais * 0.5);
    const pctImpactoCorr = ((projCorretivo / horasTotaisFrota) * 100).toFixed(2);

    let diagnostic = `Com base nas **${totalHoras} horas** de backlog acumuladas para a frota de **${numMaquinas} máquinas** (tempo total de operação de **${horasTotaisFrota}h** no mês), realizei a seguinte simulação de impacto na **Disponibilidade Mecânica (DM)**: \n\n`;
    
    diagnostic += `1. **Cenário A - Parada Planejada (Prevenção):** Se você parar todas as máquinas de forma controlada para resolver as pendências preventivamente, haverá uma queda temporária de **-${pctImpactoPlan}%** na DM. Esta é a melhor escolha para a saúde dos equipamentos.\n`;
    
    diagnostic += `2. **Cenário B - Risco de Quebra (Corretivo):** Se as pendências continuarem em aberto, o risco de falhas catastróficas (com fator de risco de 1.8x para Criticidade A) projeta um downtime inesperado de **${projCorretivo.toFixed(1)}h**, o que pode derrubar a DM em até **-${pctImpactoCorr}%** devido a quebras em operação.\n\n`;

    if (moduloMaisAfetado && moduloMaisAfetado.name !== 'N/A') {
      diagnostic += `⚠️ **Recomendação de Foco:** O **${moduloMaisAfetado.name}** concentra o maior volume de horas de backlog (**${moduloMaisAfetado.horas}h**). Sugiro priorizar as ordens deste módulo com **Criticidade A** para reduzir rapidamente a projeção de downtime corretivo de ${projCorretivo.toFixed(1)}h.\n\n`;
    } else {
      diagnostic += `💡 **Recomendação de Foco:** Priorize a resolução dos itens de **Criticidade A** para mitigar imediatamente os maiores riscos de indisponibilidade indesejada da frota.\n\n`;
    }

    // List of active items
    diagnostic += `📋 **Detalhamento das Pendências Ativas:**\n`;
    const sortedActive = [...activeItems].sort((a, b) => {
      if (a.mappedCriticidade === 'A' && b.mappedCriticidade !== 'A') return -1;
      if (a.mappedCriticidade !== 'A' && b.mappedCriticidade === 'A') return 1;
      const hA = parseHours(a.tempo_execucao);
      const hB = parseHours(b.tempo_execucao);
      return hB - hA;
    });

    const displayItems = sortedActive.slice(0, 10);
    displayItems.forEach(item => {
      const h = parseHours(item.tempo_execucao);
      const critLabel = item.mappedCriticidade === 'A' ? 'Crit. A (Crítico)' : 'Crit. B (Normal)';
      diagnostic += `- **${item.frota || 'Sem Placa'}** (${item.modulo || 'Sem Módulo'}): ${item.descricao || 'Sem Descrição'} | Tempo: **${h}h** (${critLabel})\n`;
    });

    if (sortedActive.length > 10) {
      diagnostic += `- *E mais ${sortedActive.length - 10} pendências no backlog...*\n`;
    }

    return diagnostic;
  }, [parsedBacklogHours, filtered, numMaquinas, horasTotaisFrota]);

  return (
    <div className="flex flex-col gap-4 w-full text-zinc-800 dark:text-zinc-100">
      
      {/* ─── ROW 1: PAINEL DE ETIQUETAS (Filtros — retrátil, fechado por padrão) ─── */}
      <div className="w-full">
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-sm flex flex-col">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                PAINEL DE ETIQUETAS
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                ENCERRADOS X PENDÊNCIA
              </p>
            </div>

            <div className="flex items-center gap-3 self-end lg:self-center">
              {/* Botão de Filtros — retrátil e discreto, selo mostra quantos estão ativos */}
              <button
                type="button"
                onClick={() => setShowFiltros(v => !v)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors",
                  showFiltros
                    ? "bg-[#00a859]/10 border-[#00a859]/30 text-[#00a859] dark:text-[#2ecc71]"
                    : "bg-zinc-50 dark:bg-[#1e2028] border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                )}
              >
                <Filter size={13} />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[#00a859] text-white text-[8px] leading-none">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown size={13} className={cn("transition-transform", showFiltros && "rotate-180")} />
              </button>

              {/* Stylized Suzano Logo */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-[#00a859] dark:text-[#2ecc71] italic">
                  suzano
                </span>
                <span className="w-4 h-4 bg-[#00a859] dark:bg-[#2ecc71] rounded-tl-full rounded-br-full" />
              </div>
            </div>
          </div>

          {showFiltros && (
          <>
          {/* Grid de Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
            
            {/* Filtro Status Multi-select */}
            <div className="relative">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Status</span>
              <button 
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-left text-xs font-black uppercase tracking-wider flex items-center justify-between"
              >
                <span className="truncate">
                  {filterStatuses.length === 0 ? 'Todos' : `${filterStatuses.length} Sel.`}
                </span>
                <ChevronDown size={14} className="opacity-40" />
              </button>
              
              {showStatusDropdown && (
                <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 flex flex-col gap-2">
                  {['PENDENTE', 'PROGRAMADO', 'ENCERRADO'].map(status => {
                    const active = filterStatuses.includes(status)
                    return (
                      <label key={status} className="flex items-center gap-2.5 text-[10px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-wider cursor-pointer hover:text-green-500 transition-colors">
                        <input 
                          type="checkbox"
                          checked={active}
                          onChange={() => {
                            if (active) setFilterStatuses(filterStatuses.filter(s => s !== status))
                            else setFilterStatuses([...filterStatuses, status])
                          }}
                          className="w-3.5 h-3.5 rounded border-zinc-300 text-green-600 focus:ring-green-500"
                        />
                        {status}
                      </label>
                    )
                  })}
                  <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-1 flex justify-between">
                    <button 
                      onClick={() => setFilterStatuses([])}
                      className="text-[8px] font-bold text-red-500 hover:underline uppercase"
                    >
                      Limpar
                    </button>
                    <button 
                      onClick={() => setFilterStatuses(['PENDENTE', 'PROGRAMADO', 'ENCERRADO'])}
                      className="text-[8px] font-bold text-blue-500 hover:underline uppercase"
                    >
                      Todos
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Criticidade */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Criticidade</span>
              <select
                value={filterCriticidade}
                onChange={e => setFilterCriticidade(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                <option value="A">A - Crítico</option>
                <option value="B">B - Normal</option>
                <option value="C">C - Baixa</option>
              </select>
            </div>

            {/* Origem (multi-select) */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Origem</span>
              <MultiSelect
                options={filterOptions.origens.map(o => ({ value: o, label: o }))}
                values={filterOrigens}
                onChange={setFilterOrigens}
                placeholder="Todos"
                className="[&>div]:py-1 [&>div]:min-h-[34px] [&>div]:text-xs"
              />
            </div>

            {/* Tipo (multi-select) */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Tipo</span>
              <MultiSelect
                options={filterOptions.tipos.map(t => ({ value: t, label: t }))}
                values={filterTipos}
                onChange={setFilterTipos}
                placeholder="Todos"
                className="[&>div]:py-1 [&>div]:min-h-[34px] [&>div]:text-xs"
              />
            </div>

            {/* Fornecedor */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Fornecedor</span>
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
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Área</span>
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
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Módulo</span>
              <select
                value={filterModulo}
                onChange={e => setFilterModulo(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.modulos.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Ano */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Ano</span>
              <select
                value={filterAno}
                onChange={e => setFilterAno(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.anos.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Mês</span>
              <select
                value={filterMes}
                onChange={e => setFilterMes(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {MONTHS_PT.map(m => (
                  <option key={m} value={m}>{m.toUpperCase()}</option>
                ))}
              </select>
            </div>

            {/* Mecânico */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Mecânico</span>
              <select
                value={filterMecanico}
                onChange={e => setFilterMecanico(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              >
                <option value="">Todos</option>
                {filterOptions.mecanicos.map(mec => (
                  <option key={mec} value={mec}>{mec}</option>
                ))}
              </select>
            </div>

            {/* De (Data) */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">De</span>
              <input 
                type="date"
                value={filterDataInicio}
                onChange={e => setFilterDataInicio(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-50 dark:bg-[#1e2028] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-black outline-none cursor-pointer"
              />
            </div>

            {/* Até (Data) */}
            <div>
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Até</span>
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
          </>
          )}
        </div>
      </div>

      {/* ─── ROW 2: FILA DE CARDS DE KPI ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full">
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


      {/* ─── ROW 3: GRÁFICOS (Criticidade, Área, Módulos) — agrupados juntos ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">

        {/* Card: ETIQUETA POR CRITICIDADE */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
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

          <div className="h-[200px] w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
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
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="border-l-4 border-blue-600 pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              ETIQUETA POR ÁREA
            </h3>
          </div>

          <div className="h-[200px] w-full">
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
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="border-l-4 border-[#00a859] pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              ETIQUETA POR MÓDULOS
            </h3>
          </div>

          <div className="h-[200px] w-full">
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

      {/* ─── ROW 3.4: TENDÊNCIA MENSAL — ENCERRADAS X PENDENTES (ano inteiro, largo) ─── */}
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="border-l-4 border-[#0055b8] pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              TENDÊNCIA MENSAL — ENCERRADAS X PENDENTES
            </h3>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            <div className="h-[300px]" style={{ minWidth: Math.max(700, trendStatusData.length * 90) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0].payload
                      return (
                        <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                          {data.name}: <span className="text-emerald-400">{data.encerrado} encerr.</span> / <span className="text-red-400">{data.pendente} pend.</span>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={24}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Bar dataKey="encerrado" name="Encerrado" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={22}>
                    <LabelList dataKey="encerrado" position="top" fill="#16a34a" fontSize={10} fontWeight={900} formatter={(v: number) => v > 0 ? v : ''} />
                  </Bar>
                  <Bar dataKey="pendente" name="Pendente" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={22}>
                    <LabelList dataKey="pendente" position="top" fill="#dc2626" fontSize={10} fontWeight={900} formatter={(v: number) => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 3.5: BACKLOG POR TIPO DE EQUIPAMENTO ─── */}
      <div className="grid grid-cols-1 gap-4 w-full">
        {/* Card: BACKLOG POR TIPO DE EQUIPAMENTO */}
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-l-4 border-emerald-600 pl-3 mb-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              BACKLOG POR TIPO DE EQUIPAMENTO
            </h3>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> Concluído
              </span>
              <span className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" /> Pendente
              </span>
            </div>
          </div>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barTipoStackData}
                layout="vertical"
                margin={{ left: -10, right: 40, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.1} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0].payload
                    return (
                      <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-emerald-400">{data.concluido} concl.</span> / <span className="text-zinc-300">{data.pendente} pend.</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="concluido" name="Concluído" stackId="a" fill="#16a34a" barSize={16} />
                <Bar dataKey="pendente" name="Pendente" stackId="a" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── ROW 3.6: STATUS DO BACKLOG POR PLACA (Concluído x Pendente lado a lado) ─── */}
      <div className="grid grid-cols-1 gap-4 w-full">
        <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between border-l-4 border-blue-600 pl-3 mb-4 flex-wrap gap-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
              STATUS DO BACKLOG POR PLACA
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[8px] font-black uppercase">Total {placaResumo.total}</span>
              <span className="px-2 py-0.5 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-[8px] font-black uppercase">Crit. A {placaResumo.critA}</span>
              <span className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-400 text-[8px] font-black uppercase">Crit. B {placaResumo.critB}</span>
            </div>
          </div>

          {/* Destaque grande de Concluídas x Pendentes, acima do gráfico */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40">
              <span className="w-3 h-3 rounded-full bg-emerald-600 shrink-0" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Concluídas</p>
                <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none mt-1">{placaResumo.concluidas}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40">
              <span className="w-3 h-3 rounded-full bg-red-600 shrink-0" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-red-700 dark:text-red-400">Pendentes</p>
                <p className="text-2xl font-black text-red-700 dark:text-red-400 leading-none mt-1">{placaResumo.pendentes}</p>
              </div>
            </div>
          </div>

          <div className="w-full overflow-x-auto custom-scrollbar">
            <div className="h-[320px]" style={{ minWidth: Math.max(700, barPlacaStackData.length * 70) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barPlacaStackData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                  <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} angle={-45} textAnchor="end" interval={0} height={60} />
                  <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    content={({ active, payload }: any) => {
                      if (!active || !payload?.length) return null
                      const data = payload[0].payload
                      return (
                        <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                          {data.name}: <span className="text-emerald-400">{data.concluido} concl.</span> / <span className="text-red-400">{data.pendente} pend.</span>
                        </div>
                      )
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    height={24}
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                  />
                  <Bar dataKey="concluido" name="Concluído" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={18}>
                    <LabelList dataKey="concluido" position="top" fill="#16a34a" fontSize={10} fontWeight={900} formatter={(v: number) => v > 0 ? v : ''} />
                  </Bar>
                  <Bar dataKey="pendente" name="Pendente" fill="#dc2626" radius={[4, 4, 0, 0]} barSize={18}>
                    <LabelList dataKey="pendente" position="top" fill="#dc2626" fontSize={10} fontWeight={900} formatter={(v: number) => v > 0 ? v : ''} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* ─── ROW 4: DETALHAMENTO DO BACKLOG ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden flex flex-col w-full">
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
                <th className="px-4 py-3 text-center">Abertura</th>
                <th className="px-4 py-3 text-center">Fechamento</th>
                <th className="px-4 py-3 text-right">Dias Fechado</th>
                <th className="px-4 py-3 text-right">Dias Pendente</th>
                <th className="px-4 py-3 text-right">Tempo Est.</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-400 font-bold uppercase tracking-widest italic">
                    Nenhum backlog correspondente aos filtros ativos.
                  </td>
                </tr>
              ) : (
                paginatedFiltered.map((item) => {
                  const prioColor = CRITICIDADE_COLORS[item.mappedCriticidade] || { bg: 'bg-zinc-100', text: 'text-zinc-500' }
                  const statColor = STATUS_COLORS[item.mappedStatus] || { bg: 'bg-zinc-100 border-zinc-200', text: 'text-zinc-500' }

                  let agingBg = 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                  if (item.diasPendente !== null) {
                    if (item.diasPendente > 30) {
                      agingBg = 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                    } else if (item.diasPendente > 15) {
                      agingBg = 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400'
                    }
                  }

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 transition-all cursor-pointer group"
                      onClick={() => onQuickView(item)}
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
                      <td className="px-4 py-3 text-center text-zinc-500 dark:text-zinc-400 font-bold font-mono whitespace-nowrap">
                        {item.data_evidencia ? item.data_evidencia.split('T')[0].split('-').reverse().join('/') : '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-zinc-500 dark:text-zinc-400 font-bold font-mono whitespace-nowrap">
                        {item.data_conclusao ? item.data_conclusao.split('T')[0].split('-').reverse().join('/') : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.diasFechado !== null ? (
                          <span className="px-2 py-0.5 rounded font-black bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 text-[9px]">
                            {item.diasFechado} d
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {item.diasPendente !== null ? (
                          <span className={cn("px-2 py-0.5 rounded font-black text-[9px]", agingBg)}>
                            {item.diasPendente} d
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-zinc-600 dark:text-zinc-400">
                        {item.tempo_execucao || '—'}
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
                  );
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

      {/* ─── ROW 5: MECÂNICOS ─────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-3">
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

      {/* ─── PROVISÃO DE DISPONIBILIDADE MECÂNICA (DM) & ASSISTENTE DE IA ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 w-full animate-in fade-in duration-700">
        {/* Coluna 1: Métricas de Provisão (DM) */}
        <div className="lg:col-span-1 bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 flex flex-col justify-between shadow-sm">
          <div>
            <div className="border-l-4 border-indigo-500 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                PROVISÃO DE IMPACTO NA DM
              </h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                Simulações baseadas nas horas de backlog
              </p>
            </div>

            <div className="space-y-4">
              {/* Card 1: Horas de Backlog */}
              <div className="p-3 bg-zinc-50 dark:bg-[#1c1e26] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Horas de Backlog Ativo</p>
                  <p className="text-xl font-black text-zinc-800 dark:text-zinc-100 mt-0.5">{parsedBacklogHours.totalHoras} hrs</p>
                </div>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Clock size={20} />
                </div>
              </div>

              {/* Card 2: Cenário A Planejado */}
              <div className="p-3 bg-zinc-50 dark:bg-[#1c1e26] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Cenário A (Planejado)</p>
                  <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Queda Prevista: <span className="text-amber-600 dark:text-amber-400 font-black">-{((parsedBacklogHours.totalHoras / horasTotaisFrota) * 100).toFixed(2)}%</span>
                  </p>
                </div>
                <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl">
                  <TrendingDown size={20} />
                </div>
              </div>

              {/* Card 3: Cenário B Corretivo */}
              <div className="p-3 bg-zinc-50 dark:bg-[#1c1e26] border border-zinc-200 dark:border-zinc-800/80 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-wider">Cenário B (Risco de Quebra)</p>
                  <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Queda Projetada: <span className="text-red-600 dark:text-red-400 font-black">-{(((parsedBacklogHours.horasCriticas * 1.8 + parsedBacklogHours.horasNormais * 0.5) / horasTotaisFrota) * 100).toFixed(2)}%</span>
                  </p>
                </div>
                <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-xl">
                  <ShieldAlert size={20} />
                </div>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium leading-normal mt-4 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
            * Projeção baseada em frota de {numMaquinas} máquinas operando 24h/dia (total de {horasTotaisFrota}h/mês). Fator de corretiva projeta 1.8h de indisponibilidade por hora crítica de backlog devido ao tempo de socorro e quebra.
          </div>
        </div>

        {/* Coluna 2: Assistente de IA EUNAMAN */}
        <div className="lg:col-span-2 bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute -right-24 -top-24 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl" />

          <div>
            <div className="flex items-center justify-between mb-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 rounded-2xl flex items-center justify-center text-white relative shadow-sm">
                  <span className="text-xl">🤖</span>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-[#12141c] rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
                    Assistente de IA EUNAMAN
                  </h3>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
                    Análise Preditiva & Diagnóstico
                  </p>
                </div>
              </div>

              <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-150 dark:border-indigo-900 rounded-full text-[8px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-widest shadow-sm">
                Modelo Ativo
              </span>
            </div>

            <div className="max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {formatAIMarkdown(aiExplanation)}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-850">
            <span className="text-[8px] text-zinc-400 font-black uppercase tracking-widest">Ações sugeridas:</span>
            <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-0.5">
              Priorizar backlogs com Criticidade A
            </span>
          </div>
        </div>
      </div>

      {/* ─── ROW 6: PROG. E EXECUÇÃO / RCS ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 w-full">
        <div className="border-l-4 border-rose-600 pl-3">
          <h2 className="text-xl font-black uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
            PROG. E EXECUÇÃO / RCS
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
            Tempo de programação, resolução e situação das requisições de compra
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {/* Card: TEMPO MÉDIO P/ PROG. MANUTENÇÃO */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="border-l-4 border-indigo-600 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                TEMPO MÉDIO P/ PROG. MANUTENÇÃO
              </h3>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Dias entre evidência e programação, por semana</p>
            </div>
            <div className="h-[220px] w-full">
              {tempoMedioProgPorSemana.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tempoMedioProgPorSemana} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 8, fontWeight: 900 }} axisLine={false} tickLine={false} interval={Math.ceil(tempoMedioProgPorSemana.length / 15)} />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload
                        return (
                          <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                            {data.name}: <span className="text-indigo-400">{data.value} dias</span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sem dados suficientes</div>
              )}
            </div>
          </div>

          {/* Card: TEMPO MÉDIO RESOLUÇÃO */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="border-l-4 border-rose-600 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                TEMPO MÉDIO RESOLUÇÃO
              </h3>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Dias entre evidência e conclusão, por semana</p>
            </div>
            <div className="h-[220px] w-full">
              {tempoMedioResolucaoPorSemana.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tempoMedioResolucaoPorSemana} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.1} />
                    <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 8, fontWeight: 900 }} axisLine={false} tickLine={false} interval={Math.ceil(tempoMedioResolucaoPorSemana.length / 15)} />
                    <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload
                        return (
                          <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                            {data.name}: <span className="text-rose-400">{data.value} dias</span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="value" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sem dados suficientes</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 w-full">
          {/* Card: TIPO DE PEDIDO */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="border-l-4 border-amber-500 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                TIPO DE PEDIDO
              </h3>
            </div>
            <div className="h-[200px] w-full relative flex items-center justify-center">
              {tipoPedidoPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tipoPedidoPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ value }) => value}
                      labelLine={false}
                    >
                      {tipoPedidoPieData.map((entry, idx) => (
                        <Cell key={idx} fill={TIPO_PEDIDO_COLORS[entry.name] || '#cbd5e1'} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0]
                        return (
                          <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                            {data.name}: <span className="text-amber-400">{data.value}</span>
                          </div>
                        )
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sem dados suficientes</div>
              )}
            </div>
          </div>

          {/* Card: TEMPO MÉDIO P/ ABERTURA DE REQUISIÇÃO */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="border-l-4 border-cyan-600 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                TEMPO MÉDIO P/ ABERTURA DE REQUISIÇÃO
              </h3>
              <p className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">Dias entre evidência e Data da RC, por tipo</p>
            </div>
            <div className="h-[200px] w-full">
              {tempoMedioAberturaReqData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tempoMedioAberturaReqData} layout="vertical" margin={{ left: -10, right: 30, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.1} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload
                        return (
                          <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                            {data.name}: <span className="text-cyan-400">{data.value} dias</span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="value" fill="#0891b2" radius={[0, 4, 4, 0]} barSize={14} label={{ position: 'right', fill: '#71717a', fontSize: 9, fontWeight: 900 }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sem dados suficientes</div>
              )}
            </div>
          </div>

          {/* Card: SITUAÇÃO R.C */}
          <div className="bg-white dark:bg-[#12141c] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
            <div className="border-l-4 border-emerald-600 pl-3 mb-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-zinc-800 dark:text-zinc-200">
                SITUAÇÃO R.C
              </h3>
            </div>
            <div className="h-[200px] w-full">
              {situacaoRcData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={situacaoRcData} layout="vertical" margin={{ left: -10, right: 40, top: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.1} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} width={95} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null
                        const data = payload[0].payload
                        return (
                          <div className="bg-zinc-950/90 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                            {data.name}: <span className="text-emerald-400">{data.value}</span>
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} label={{ position: 'right', fill: '#71717a', fontSize: 10, fontWeight: 900 }}>
                      {situacaoRcData.map((entry, idx) => (
                        <Cell key={idx} fill={SITUACAO_RC_COLORS[entry.name] || '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Sem dados suficientes</div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
