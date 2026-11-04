// @ts-nocheck
'use client'

// Redesenho nativo (Fase 5) — mesma lógica de cálculo/filtro do BacklogDashboard original
// (ver app/backlog/BacklogDashboard.tsx — erros de tipo pré-existentes lá, não
// introduzidos pelo porte). Gráficos recharts mantidos como pediu o plano; só os
// cartões de KPI (StatTile), o painel de filtros, a tabela de detalhamento e os cards
// de mecânico mudaram de visual (de "web claro" pra tema escuro nativo — o projeto usa
// darkMode:"class" e o field-app nunca aplica essa classe, então as variantes "dark:"
// originais nunca ativavam de fato; o visual real antes era sempre a versão clara).
import React, { useState, useMemo, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import {
  TrendingUp, TrendingDown, Layers, ShieldAlert, CheckCircle2,
  Search, Filter, ChevronRight, ChevronLeft, ChevronDown, Edit3, Trash2, RefreshCw, Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { mesAnoOperacional } from '@/lib/calendario-suzano'
import { StatTile } from '../../ui/primitives/StatTile'
import { Card } from '../../ui/primitives/ListRow'
import { EmptyState } from '../../ui/primitives/EmptyState'
import { getCurrentLocalDate } from '@/src/utils/dateUtils'

interface Props {
  items: any[]
  placas: any[]
  calendario?: any[]
  onEdit: (item: any) => void
  onDelete: (id: string) => void
}

const CRITICIDADE_COLORS: Record<string, { bg: string, text: string, chart: string }> = {
  'A': { bg: 'bg-red-500/15', text: 'text-red-400', chart: '#f05252' },
  'B': { bg: 'bg-blue-500/15', text: 'text-blue-400', chart: '#2563eb' },
}

const STATUS_COLORS: Record<string, { bg: string, text: string }> = {
  'PENDENTE': { bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'PROGRAMADO': { bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
  'ENCERRADO': { bg: 'bg-zinc-800', text: 'text-zinc-400' }
}

const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

function parseHours(val: any): number {
  if (!val) return 0;
  const str = String(val).toLowerCase().trim();
  if (!str) return 0;

  const matchHM = str.match(/^(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s*(\d+(?:[.,]\d+)?)\s*m(?:in(?:utos?)?)?$/i);
  if (matchHM) {
    const h = parseFloat(matchHM[1].replace(',', '.'));
    const m = parseFloat(matchHM[2].replace(',', '.'));
    return (isNaN(h) ? 0 : h) + (isNaN(m) ? 0 : m / 60);
  }

  const matchM = str.match(/^(\d+(?:[.,]\d+)?)\s*m(?:in(?:utos?)?)?$/i);
  if (matchM) {
    const m = parseFloat(matchM[1].replace(',', '.'));
    return isNaN(m) ? 0 : m / 60;
  }

  const cleaned = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
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
        <div key={i} className="flex items-start gap-2 mb-1.5 pl-2 text-xs leading-relaxed text-zinc-300">
          <span className="text-emerald-400 font-black mt-0.5">•</span>
          <div>{formattedParts}</div>
        </div>
      );
    }
    return (
      <p key={i} className="mb-2 text-xs leading-relaxed text-zinc-300">
        {formattedParts}
      </p>
    );
  });
}

export default function BacklogDashboard({ items, placas, calendario = [], onEdit, onDelete }: Props) {
  const currentPeriod = useMemo(() => {
    const today = getCurrentLocalDate();
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

      // 4. Mapped month and year (período operacional Suzano, não mês civil)
      let mappedMonth = 'janeiro'
      let mappedYear = '2026'
      if (item.data_evidencia) {
        const periodo = mesAnoOperacional(item.data_evidencia, calendario)
        if (periodo.mes) mappedMonth = periodo.mes
        if (periodo.ano) mappedYear = periodo.ano
      } else if (item.mes) {
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
  }, [mappedItems, filterStatuses, filterCriticidade, filterFornecedor, filterArea, filterModulo, filterAno, filterMes, filterDataInicio, filterDataFim, search])

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
    if (filterDataInicio) count++
    if (filterDataFim) count++
    if (search) count++
    return count
  }, [filterStatuses, filterCriticidade, filterFornecedor, filterArea, filterModulo, filterMecanico, filterDataInicio, filterDataFim, search])

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

  const selectCls = "px-3 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-xs font-semibold outline-none"

  return (
    <div className="flex flex-col gap-4 w-full text-zinc-100">

      {/* ─── PAINEL DE ETIQUETAS (Filtros — retrátil, fechado por padrão) ─── */}
      <Card className="p-4 flex flex-col">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-tight text-zinc-100">
              Painel de Etiquetas
            </h2>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
              Encerrados x Pendência
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFiltros(v => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-colors shrink-0",
              showFiltros
                ? "bg-emerald-500/10 border-emerald-900/40 text-emerald-400"
                : "bg-zinc-800 border-zinc-700 text-zinc-400"
            )}
            style={{ minHeight: "var(--tap-min)" }}
          >
            <Filter size={13} />
            Filtros
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-white text-[8px] leading-none">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown size={13} className={cn("transition-transform", showFiltros && "rotate-180")} />
          </button>
        </div>

        {showFiltros && (
        <div className="mt-4 space-y-3">
          {/* Status Multi-select */}
          <div className="relative">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Status</span>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className={cn(selectCls, "w-full text-left flex items-center justify-between")}
            >
              <span className="truncate">
                {filterStatuses.length === 0 ? 'Todos' : `${filterStatuses.length} Sel.`}
              </span>
              <ChevronDown size={14} className="opacity-40" />
            </button>

            {showStatusDropdown && (
              <div className="absolute left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 flex flex-col gap-2">
                {['PENDENTE', 'PROGRAMADO', 'ENCERRADO'].map(status => {
                  const active = filterStatuses.includes(status)
                  return (
                    <label key={status} className="flex items-center gap-2.5 text-[10px] font-black text-zinc-300 uppercase tracking-wider cursor-pointer">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          if (active) setFilterStatuses(filterStatuses.filter(s => s !== status))
                          else setFilterStatuses([...filterStatuses, status])
                        }}
                        className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-green-600 focus:ring-green-500"
                      />
                      {status}
                    </label>
                  )
                })}
                <div className="border-t border-zinc-800 pt-2 mt-1 flex justify-between">
                  <button onClick={() => setFilterStatuses([])} className="text-[8px] font-bold text-red-400 uppercase">Limpar</button>
                  <button onClick={() => setFilterStatuses(['PENDENTE', 'PROGRAMADO', 'ENCERRADO'])} className="text-[8px] font-bold text-blue-400 uppercase">Todos</button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Criticidade</span>
              <select value={filterCriticidade} onChange={e => setFilterCriticidade(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                <option value="A">A - Crítico</option>
                <option value="B">B - Normal</option>
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Fornecedor</span>
              <select value={filterFornecedor} onChange={e => setFilterFornecedor(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {filterOptions.fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Área</span>
              <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {filterOptions.areas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Módulo</span>
              <select value={filterModulo} onChange={e => setFilterModulo(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {filterOptions.modulos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Ano</span>
              <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {filterOptions.anos.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Mês</span>
              <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {MONTHS_PT.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Mecânico</span>
              <select value={filterMecanico} onChange={e => setFilterMecanico(e.target.value)} className={cn(selectCls, "w-full")}>
                <option value="">Todos</option>
                {filterOptions.mecanicos.map(mec => <option key={mec} value={mec}>{mec}</option>)}
              </select>
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">De</span>
              <input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} className={cn(selectCls, "w-full")} />
            </div>
            <div>
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Até</span>
              <input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} className={cn(selectCls, "w-full")} />
            </div>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por placa, descrição ou tag..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={cn(selectCls, "w-full pl-9")}
            />
          </div>
        </div>
        )}
      </Card>

      {/* ─── FILA DE CARDS DE KPI ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 w-full">
        <StatTile icon={CheckCircle2} label="Concluídas" value={kpiConcluidas} accent="zinc" />
        <StatTile icon={Clock} label="Pendentes" value={kpiPendentes} accent="amber" />
        <StatTile icon={TrendingUp} label="Programado" value={kpiProgramados} accent="emerald" />
        <StatTile icon={Layers} label="Total" value={kpiTotal} accent="zinc" />
      </div>
      <div className="grid grid-cols-2 gap-3 -mt-2 px-1 text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
        <span />
        <span>Média Criação &gt; Progr <span className="font-black text-zinc-300">{avgCriacaoProg}</span></span>
        <span>Média Prog &gt; Encerr <span className="font-black text-zinc-300">{avgProgEncerr}</span></span>
        <span />
      </div>

      {/* ─── GRÁFICOS (Criticidade, Área, Módulos, Tendência) ─── */}
      <div className="grid grid-cols-1 gap-4 w-full">

        <Card className="p-5">
          <div className="border-l-4 border-cyan-500 pl-3 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Etiqueta por Criticidade</h3>
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
                    <Cell key={idx} fill={CRITICIDADE_COLORS[entry.name]?.chart || '#52525b'} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        CRITICIDADE {data.name}: <span className="text-cyan-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="border-l-4 border-blue-600 pl-3 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Etiqueta por Área</h3>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barAreaData} layout="vertical" margin={{ left: -10, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-blue-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="border-l-4 border-emerald-500 pl-3 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Etiqueta por Módulos</h3>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barModuloData} layout="vertical" margin={{ left: -10, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} opacity={0.3} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} width={110} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-emerald-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: '#a1a1aa', fontSize: 10, fontWeight: 900 }} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="border-l-4 border-indigo-600 pl-3 mb-3">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Tendência de Etiquetas</h3>
          </div>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 30, bottom: 5, left: -20, right: 20 }} barSize={60}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.3} />
                <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  content={({ active, payload }: any) => {
                    if (!active || !payload?.length) return null
                    const data = payload[0]
                    return (
                      <div className="bg-zinc-950 text-white px-3 py-1.5 rounded-xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider">
                        {data.name}: <span className="text-indigo-400">{data.value}</span>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} label={renderCustomBarLabel} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* ─── DETALHAMENTO DO BACKLOG ─────────────────────────────────────────── */}
      <Card className="overflow-hidden flex flex-col w-full">
        <div className="px-4 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Detalhamento do Backlog</h3>
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
            {filtered.length} itens
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState icon={Layers} title="Nenhum backlog correspondente aos filtros ativos" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {paginatedFiltered.map((item) => {
              const prioColor = CRITICIDADE_COLORS[item.mappedCriticidade] || { bg: 'bg-zinc-800', text: 'text-zinc-400' }
              const statColor = STATUS_COLORS[item.mappedStatus] || { bg: 'bg-zinc-800', text: 'text-zinc-400' }

              let agingBg = 'bg-emerald-500/15 text-emerald-400'
              if (item.diasPendente !== null) {
                if (item.diasPendente > 30) agingBg = 'bg-red-500/15 text-red-400'
                else if (item.diasPendente > 15) agingBg = 'bg-amber-500/15 text-amber-400'
              }

              return (
                <div key={item.id} className="p-4 flex items-start gap-3">
                  <button type="button" onClick={() => onEdit(item)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-black text-zinc-50">{item.frota}</span>
                      {item._isPendingSync && <RefreshCw size={10} className="animate-spin text-amber-500" />}
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", prioColor.bg, prioColor.text)}>{item.mappedCriticidade}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase", statColor.bg, statColor.text)}>{item.mappedStatus}</span>
                      {item.tag && <span className="text-[9px] text-zinc-500 font-bold">{item.tag}</span>}
                    </div>
                    <p className="text-xs font-bold text-zinc-400 mt-1 line-clamp-1">{item.descricao || '—'}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1.5 text-[10px] font-semibold text-zinc-500">
                      <span>{item.modulo || 'N/A'}</span>
                      <span>· Abertura {item.data_evidencia ? item.data_evidencia.split('T')[0].split('-').reverse().join('/') : '—'}</span>
                      {item.data_conclusao && <span>· Fecho {item.data_conclusao.split('T')[0].split('-').reverse().join('/')}</span>}
                      {item.tempo_execucao && <span>· {item.tempo_execucao}</span>}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {item.diasFechado !== null && (
                        <span className="px-1.5 py-0.5 rounded font-black bg-zinc-800 text-zinc-400 text-[9px]">{item.diasFechado}d fechado</span>
                      )}
                      {item.diasPendente !== null && (
                        <span className={cn("px-1.5 py-0.5 rounded font-black text-[9px]", agingBg)}>{item.diasPendente}d pendente</span>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => onEdit(item)} className="p-2 text-zinc-500 active:bg-zinc-800 rounded-lg" style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}>
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => onDelete(item.id)} className="p-2 text-zinc-500 active:bg-red-950/40 active:text-red-400 rounded-lg" style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="p-3 border-t border-zinc-800 flex items-center justify-between">
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Página {currentPage} de {totalPages}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 border border-zinc-800 rounded-lg active:bg-zinc-800 disabled:opacity-40 text-zinc-400">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 border border-zinc-800 rounded-lg active:bg-zinc-800 disabled:opacity-40 text-zinc-400">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* ─── MECÂNICOS ─────────────────────────────────────────── */}
      <Card className="p-5 flex flex-col gap-4 w-full">
        <div className="flex items-center justify-between border-l-4 border-indigo-600 pl-3">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Distribuição por Mecânico</h3>
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Pendentes, Programados e Encerrados</p>
          </div>
          {filterMecanico && (
            <button onClick={() => setFilterMecanico('')} className="text-[9px] font-black text-red-400 uppercase tracking-widest border border-red-900/40 px-2.5 py-1 rounded-xl bg-red-500/10 shrink-0">
              ✕ Limpar
            </button>
          )}
        </div>

        <div className="h-[260px] bg-zinc-950/40 border border-zinc-800 rounded-2xl p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topMechanicChartData} margin={{ top: 20, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.3} />
              <XAxis dataKey="name" tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#a1a1aa', fontSize: 9, fontWeight: 900 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-zinc-950 text-white p-3 rounded-2xl border border-zinc-800 text-[10px] font-black uppercase tracking-wider flex flex-col gap-1">
                      <span className="text-indigo-400 border-b border-zinc-800 pb-1 mb-1">{data.name}</span>
                      <span className="flex items-center justify-between gap-4">Pendentes: <span className="text-amber-400">{data.pendente}</span></span>
                      <span className="flex items-center justify-between gap-4">Programados: <span className="text-emerald-400">{data.programado}</span></span>
                      <span className="flex items-center justify-between gap-4">Encerrados: <span className="text-zinc-400">{data.encerrado}</span></span>
                      <span className="flex items-center justify-between gap-4 text-orange-400 border-t border-zinc-800 pt-1 mt-1">Média Aging: <span>{data.avgAging}d</span></span>
                    </div>
                  )
                }}
              />
              <Legend verticalAlign="top" height={30} wrapperStyle={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
              <Bar dataKey="pendente" name="Pendente" stackId="a" fill="#d97706" />
              <Bar dataKey="programado" name="Programado" stackId="a" fill="#10b981" />
              <Bar dataKey="encerrado" name="Encerrado" stackId="a" fill="#52525b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Toque para filtrar</span>
          {mechanicStats.map(s => {
            const isSelected = filterMecanico === s.name;
            return (
              <button
                key={s.name}
                onClick={() => setFilterMecanico(isSelected ? '' : s.name)}
                className={cn(
                  "p-3 rounded-2xl border text-left flex items-center justify-between",
                  isSelected ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-300 active:bg-zinc-800"
                )}
                style={{ minHeight: "var(--tap-min)" }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-tight truncate">{s.name}</p>
                  <p className={cn("text-[8px] font-bold mt-0.5", isSelected ? "text-indigo-200" : "text-zinc-500")}>
                    Média {s.avgAging}d em aberto
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-black", isSelected ? "bg-white/10 text-white" : "bg-zinc-800 text-zinc-500")}>
                    Total: {s.total}
                  </span>
                  <div className="flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* ─── PROVISÃO DE DISPONIBILIDADE MECÂNICA (DM) & ASSISTENTE DE IA ─── */}
      <Card className="p-5 flex flex-col gap-4 w-full">
        <div className="border-l-4 border-indigo-500 pl-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-zinc-200">Provisão de Impacto na DM</h3>
          <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Simulações baseadas nas horas de backlog</p>
        </div>

        <div className="space-y-2.5">
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Horas de Backlog Ativo</p>
              <p className="text-lg font-black text-zinc-100 mt-0.5">{parsedBacklogHours.totalHoras} hrs</p>
            </div>
            <div className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl"><Clock size={18} /></div>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Cenário A (Planejado)</p>
              <p className="text-xs font-bold text-zinc-400 mt-0.5">
                Queda: <span className="text-amber-400 font-black">-{((parsedBacklogHours.totalHoras / horasTotaisFrota) * 100).toFixed(2)}%</span>
              </p>
            </div>
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl"><TrendingDown size={18} /></div>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Cenário B (Risco de Quebra)</p>
              <p className="text-xs font-bold text-zinc-400 mt-0.5">
                Queda: <span className="text-red-400 font-black">-{(((parsedBacklogHours.horasCriticas * 1.8 + parsedBacklogHours.horasNormais * 0.5) / horasTotaisFrota) * 100).toFixed(2)}%</span>
              </p>
            </div>
            <div className="p-2 bg-red-500/15 text-red-400 rounded-xl"><ShieldAlert size={18} /></div>
          </div>
        </div>

        <p className="text-[9px] text-zinc-500 font-medium leading-normal border-t border-zinc-800 pt-3">
          * Projeção baseada em frota de {numMaquinas} máquinas operando 24h/dia (total de {horasTotaisFrota}h/mês). Fator corretivo projeta 1.8h de indisponibilidade por hora crítica de backlog.
        </p>
      </Card>

      <Card className="p-5 flex flex-col gap-3 w-full">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-indigo-500/15 border border-indigo-900/40 rounded-xl flex items-center justify-center relative">
              <span className="text-lg">🤖</span>
              <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
            </div>
            <div>
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-wide">Assistente de IA EUNAMAN</h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Análise Preditiva</p>
            </div>
          </div>
        </div>

        <div className="max-h-[220px] overflow-y-auto">
          {formatAIMarkdown(aiExplanation)}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
          <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest">Ação sugerida:</span>
          <span className="text-[9px] text-indigo-400 font-bold">Priorizar backlogs com Criticidade A</span>
        </div>
      </Card>
    </div>
  )
}
