'use client'

import { useState, useMemo } from 'react'
import {
  Plus, Clipboard, Search, ShieldAlert, List, LayoutDashboard, History,
  CheckCircle2, AlertTriangle, Percent, Boxes,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { cn } from '@/lib/utils'
import HorimetroTable from './HorimetroTable'
import HorimetroModal from './HorimetroModal'
import { useAuth } from '@/components/auth-context'

interface HorimetroClientProps {
  equipamentos: any[]
  historico: any[]
}

const COR_LANCADO = '#059669'
const COR_PENDENTE = '#f59e0b'

function diasDesde(dataStr: string): number {
  const d = new Date(dataStr + 'T00:00:00')
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((hoje.getTime() - d.getTime()) / 86400000))
}
function fmtDataBr(d: string) {
  if (!d) return '-'
  const [a, m, dd] = d.split('-')
  return dd && m && a ? `${dd}/${m}/${a}` : d
}

export default function HorimetroClient({ equipamentos, historico }: HorimetroClientProps) {
  const { profile } = useAuth()
  const isVisitante = profile?.role === 'visitante'
  const [search, setSearch] = useState("")
  const [view, setView] = useState<'planilha' | 'dashboard' | 'historico'>('planilha')
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'LANCADO' | 'PENDENTE'>('TODOS')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editData, setEditData] = useState<any>(null)

  const handleOpenNew = (equipamentoId?: string) => {
    setEditData(equipamentoId ? { equipamento_id: equipamentoId } : null)
    setIsModalOpen(true)
  }

  const handleEdit = (item: any) => {
    setEditData(item)
    setIsModalOpen(true)
  }

  const equipamentosAtivos = useMemo(
    () => equipamentos.filter(e => !e.deleted_at && (e.status || '').toUpperCase() !== 'INATIVO'),
    [equipamentos]
  )

  // Último apontamento (mais recente) por equipamento
  const ultimoPorEquipamento = useMemo(() => {
    const map: Record<string, any> = {}
    historico.forEach(h => {
      const atual = map[h.equipamento_id]
      if (!atual || (h.data_referencia || '') > (atual.data_referencia || '')) map[h.equipamento_id] = h
    })
    return map
  }, [historico])

  const qtdPorEquipamento = useMemo(() => {
    const map: Record<string, number> = {}
    historico.forEach(h => { map[h.equipamento_id] = (map[h.equipamento_id] || 0) + 1 })
    return map
  }, [historico])

  const linhasTodas = useMemo(() => {
    return equipamentosAtivos
      .map(e => {
        const ultimo = ultimoPorEquipamento[e.id]
        return {
          id: e.id, placa: e.placa, tipo: e.tipo || '-',
          modulo: e.modulo || '-', area: e.area || '-',
          ultimo, dias: ultimo ? diasDesde(ultimo.data_referencia) : null,
          qtd: qtdPorEquipamento[e.id] || 0,
        }
      })
      .sort((a, b) => (a.placa || '').localeCompare(b.placa || ''))
  }, [equipamentosAtivos, ultimoPorEquipamento, qtdPorEquipamento])

  const linhas = useMemo(() => {
    return linhasTodas.filter(l => {
      const matchSearch = (l.placa || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filtroStatus === 'TODOS' || (filtroStatus === 'LANCADO' ? !!l.ultimo : !l.ultimo)
      return matchSearch && matchStatus
    })
  }, [linhasTodas, search, filtroStatus])

  const totalOk = linhasTodas.filter(l => l.ultimo).length
  const totalPendentes = linhasTodas.length - totalOk
  const pctOk = linhasTodas.length > 0 ? Math.round((totalOk / linhasTodas.length) * 100) : 0

  const statusPieData = useMemo(() => ([
    { name: 'Lançado', value: totalOk },
    { name: 'Pendente', value: totalPendentes },
  ]), [totalOk, totalPendentes])

  // Apontamentos lançados por mês (últimos 6 meses com lançamento)
  const apontamentosPorMesData = useMemo(() => {
    const map: Record<string, number> = {}
    historico.forEach(h => {
      const mes = (h.data_referencia || '').slice(0, 7)
      if (!mes) return
      map[mes] = (map[mes] || 0) + 1
    })
    const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([mes, qtd]) => {
        const [ano, m] = mes.split('-')
        return { name: `${MESES_ABR[Number(m) - 1]}/${ano.slice(2)}`, qtd }
      })
  }, [historico])

  // Top 10 equipamentos por horas trabalhadas acumuladas
  const topHorasData = useMemo(() => {
    const map: Record<string, number> = {}
    historico.forEach(h => {
      const placa = h.equipamentos?.placa || '-'
      const horas = Number(h.horimetro_final || 0) - Number(h.horimetro_inicial || 0)
      if (horas > 0) map[placa] = (map[placa] || 0) + horas
    })
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([placa, horas]) => ({ placa, horas: Math.round(horas * 10) / 10 }))
  }, [historico])

  // Busca no Histórico pela placa do equipamento vinculado ou pela observação —
  // antes comparava com campos inexistentes (h.placa / h.operador) e nunca batia com nada.
  const filteredHistory = historico.filter(h =>
    (h.equipamentos?.placa || '').toLowerCase().includes(search.toLowerCase()) ||
    (h.observacoes || '').toLowerCase().includes(search.toLowerCase())
  )

  const handleClearFilters = () => {
    setSearch("")
  }

  return (
    <div className="flex flex-col gap-6 h-full pb-8">
      {/* Header with Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
         {/* Background decoration */}
         <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />

         <div className="flex items-center gap-4 relative z-10">
            <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-500/20">
              <Clipboard size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Registro de Horímetros</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                Gestão centralizada de apontamentos de horas trabalhadas.
              </p>
            </div>
         </div>

         <div className="flex gap-2 relative z-10 flex-wrap">
            <div className="relative group">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" />
               <input
                 type="text"
                 placeholder="BUSCAR EQUIPAMENTO..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all w-60"
               />
            </div>
            {search && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all"
              >
                Limpar Filtros
              </button>
            )}
             {isVisitante ? (
               <div className="flex items-center gap-2 px-6 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-2xl text-sm font-bold border border-zinc-200 dark:border-zinc-700 shadow-sm shadow-zinc-200/50 dark:shadow-none">
                 <ShieldAlert size={20} className="text-zinc-400" />
                 Somente Leitura
               </div>
             ) : (
               <button
                 onClick={() => handleOpenNew()}
                 className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/30 transition-all active:scale-95 group"
               >
                 <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                 Novo Apontamento
               </button>
             )}
         </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0"><Boxes size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Equipamentos</p>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100 leading-tight">{linhasTodas.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0"><CheckCircle2 size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Com Apontamento</p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-tight">{totalOk}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0"><AlertTriangle size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Pendentes</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-400 leading-tight">{totalPendentes}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0"><Percent size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">% Com Apontamento</p>
            <p className="text-xl font-black text-indigo-700 dark:text-indigo-400 leading-tight">{pctOk}%</p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 flex-wrap">
        <button
          onClick={() => setView('planilha')}
          className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
            view === 'planilha' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}
        >
          <List size={15} /> Planilha
        </button>
        <button
          onClick={() => setView('dashboard')}
          className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
            view === 'dashboard' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}
        >
          <LayoutDashboard size={15} /> Dashboard
        </button>
        <button
          onClick={() => setView('historico')}
          className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
            view === 'historico' ? 'border-blue-600 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}
        >
          <History size={15} /> Histórico
        </button>
      </div>

      {view === 'planilha' && (
        <div className="flex flex-col gap-3">
          <div className="flex border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden w-fit flex-wrap">
            {(['TODOS', 'LANCADO', 'PENDENTE'] as const).map(s => (
              <button key={s} type="button" onClick={() => setFiltroStatus(s)} className={cn('px-4 py-2 text-xs font-bold whitespace-nowrap', filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400')}>
                {s === 'TODOS' ? 'Todos os status' : s === 'LANCADO' ? 'Lançado' : 'Pendente'}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    {['Placa', 'Tipo', 'Módulo/Área', 'Status', 'Última leitura', 'Horímetro atual', 'Dias desde a leitura', 'Qtd. Troca', 'Ação'].map(h => (
                      <th key={h} className={cn('px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap', h === 'Ação' ? 'text-right' : 'text-left')}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {linhas.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum equipamento encontrado</td></tr>
                  ) : linhas.map(l => (
                    <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{l.placa}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.tipo}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.modulo}{l.area && l.area !== '-' ? ` · ${l.area}` : ''}</td>
                      <td className="px-3 py-2.5">
                        {l.ultimo ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 whitespace-nowrap"><CheckCircle2 size={11} /> Lançado</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 whitespace-nowrap"><AlertTriangle size={11} /> Pendente</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.ultimo ? fmtDataBr(l.ultimo.data_referencia?.split('T')[0]) : '-'}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.ultimo ? `${Number(l.ultimo.horimetro_final).toFixed(1)}h` : '-'}</td>
                      <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.dias != null ? `${l.dias} dia(s)` : '-'}</td>
                      <td className="px-3 py-2.5">
                        {l.qtd > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400"><History size={12} /> {l.qtd}</span>
                        ) : <span className="text-zinc-300 dark:text-zinc-700">0</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {!isVisitante && (
                            <button title="Lançar apontamento" onClick={() => handleOpenNew(l.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><Plus size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{linhas.length} equipamento(s)</div>
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Status Geral</h3>
            <p className="text-[11px] text-zinc-400 mb-3">Lançado x Pendente neste período</p>
            {linhasTodas.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-zinc-400 font-semibold uppercase tracking-wide">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {statusPieData.map(entry => (
                      <Cell key={entry.name} fill={entry.name === 'Lançado' ? COR_LANCADO : COR_PENDENTE} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} equip.`, n]} />
                  <Legend verticalAlign="bottom" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Apontamentos Lançados por Mês</h3>
            <p className="text-[11px] text-zinc-400 mb-3">Últimos meses com lançamento</p>
            {apontamentosPorMesData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-zinc-400 font-semibold uppercase tracking-wide">Sem lançamentos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={apontamentosPorMesData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" name="Apontamentos" fill="#2a78d6" radius={[4, 4, 0, 0]} barSize={32}>
                    <LabelList dataKey="qtd" position="top" fontSize={11} fontWeight={700} fill="#52525b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Top 10 — Horas Trabalhadas Acumuladas</h3>
            <p className="text-[11px] text-zinc-400 mb-3">Soma de horímetro final − inicial de todos os apontamentos, por placa</p>
            {topHorasData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-xs text-zinc-400 font-semibold uppercase tracking-wide">Sem apontamentos</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topHorasData} layout="vertical" margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} opacity={0.5} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="placa" width={80} tick={{ fontSize: 11, fontWeight: 700, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: number) => [`${v}h`, 'Horas']} />
                  <Bar dataKey="horas" name="Horas" fill="#2a78d6" radius={[0, 4, 4, 0]} barSize={16}>
                    <LabelList dataKey="horas" position="right" fontSize={11} fontWeight={700} fill="#52525b" formatter={(v: number) => `${v}h`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {view === 'historico' && (
        <div className="flex-1 min-h-[500px]">
          <HorimetroTable
            data={filteredHistory}
            onEdit={handleEdit}
            isVisitante={isVisitante}
          />
        </div>
      )}

      {/* Unified Modal */}
      <HorimetroModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipamentos={equipamentos}
        editData={editData}
        onSuccess={() => {
            // refresh data handled by revalidatePath in actions
        }}
      />
    </div>
  )
}
