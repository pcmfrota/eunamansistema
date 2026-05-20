'use client'

import { useState, useTransition, useRef } from 'react'
import { Search, Edit2, Check, X, Trash2, Upload, BarChart2, Truck, Wrench, Gauge, FileSpreadsheet, FileText } from 'lucide-react'
import Script from 'next/script'
import { excluirPreventiva, atualizarPreventiva } from './actions'
import DashboardHorimetros from './DashboardHorimetros'

type Prev = {
  id: string
  ultimo_horimetro: number
  horimetro_atual: number
  intervalo_horas: number
  data_atualizacao: string | null
  equipamentos: {
    placa: string
    tipo: string
    categoria: string
    modulo: string | null
  } | null
}

// ─── EXPORT HELPERS ───────────────────────────────────────────────────────────
function exportCSV(data: Prev[], filename: string) {
  const headers = ['Placa', 'Tipo', 'Categoria', 'Modulo', 'Ultimo(h/km)', 'Atual(h/km)', 'Intervalo', 'Proxima', 'Falta', 'Data_Atualizacao', 'Status']
  const rows = data.map(p => {
    const proxima = p.ultimo_horimetro + p.intervalo_horas
    const falta = proxima - p.horimetro_atual
    const status = falta < 0 ? 'ATRASADO' : falta <= Math.min(100, p.intervalo_horas * 0.15) ? 'ATENCAO' : 'NO PRAZO'
    return [
      p.equipamentos?.placa, p.equipamentos?.tipo, p.equipamentos?.categoria,
      p.equipamentos?.modulo || '', p.ultimo_horimetro, p.horimetro_atual,
      p.intervalo_horas, proxima, falta, p.data_atualizacao || '', status
    ].join(',')
  })
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

function exportXLSX(data: Prev[], filename: string) {
  const XLSX = (window as any).XLSX
  if (!XLSX) { alert('Biblioteca Excel ainda carregando...'); return }
  const rows = data.map(p => {
    const proxima = p.ultimo_horimetro + p.intervalo_horas
    const falta = proxima - p.horimetro_atual
    const status = falta < 0 ? 'ATRASADO' : falta <= Math.min(100, p.intervalo_horas * 0.15) ? 'ATENCAO' : 'NO PRAZO'
    return {
      Placa: p.equipamentos?.placa, Tipo: p.equipamentos?.tipo,
      Categoria: p.equipamentos?.categoria, Modulo: p.equipamentos?.modulo || '',
      'Ultimo (h/km)': p.ultimo_horimetro, 'Atual (h/km)': p.horimetro_atual,
      'Intervalo': p.intervalo_horas, 'Proxima': proxima, 'Falta': falta,
      'Data Atualizacao': p.data_atualizacao || '', 'Status': status
    }
  })
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Horimetros')
  XLSX.writeFile(wb, filename + '.xlsx')
}

// ─── BAR CHART ───────────────────────────────────────────────────────────────
function BarChart({ items, intervalo }: { items: Prev[]; intervalo: number }) {
  if (!items.length) return <p className="text-zinc-400 text-sm p-4">Sem dados.</p>
  const maxVal = Math.max(...items.map(p => p.horimetro_atual - p.ultimo_horimetro), 10)
  return (
    <div className="flex items-end gap-3 px-4 pb-4 overflow-x-auto min-h-[180px]">
      {items.map(p => {
        const proxima = p.ultimo_horimetro + p.intervalo_horas
        const falta = proxima - p.horimetro_atual
        const progresso = p.horimetro_atual - p.ultimo_horimetro
        const pct = Math.max(5, Math.min(100, (Math.abs(progresso) / Math.max(maxVal, 1)) * 100))
        const cor = falta < 0 ? 'bg-red-600' : falta <= Math.min(100, intervalo * 0.15) ? 'bg-yellow-500' : 'bg-green-600'
        return (
          <div key={p.id} className="flex flex-col items-center gap-1 min-w-[64px]">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded text-white ${cor}`}>
              {falta < 0 ? falta : `+${progresso}`}
            </span>
            <div className={`w-12 rounded-t-sm ${cor} transition-all`} style={{ height: `${pct * 1.4}px` }} />
            <span className="text-[10px] font-semibold text-zinc-700 dark:text-zinc-300 text-center leading-tight mt-1">
              {p.equipamentos?.placa}
            </span>
            <span className="text-[9px] text-zinc-400 text-center">{p.equipamentos?.modulo || p.equipamentos?.categoria}</span>
          </div>
        )
      })}
    </div>
  )
}

function DashboardCard({ title, items, intervalo }: { title: string; items: Prev[]; intervalo: number }) {
  if (!items.length) return null
  return (
    <div className="glass-card rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-border-color bg-white/40 dark:bg-black/20">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">{title}</h3>
      </div>
      <BarChart items={items} intervalo={intervalo} />
    </div>
  )
}

// ─── EXPORT BAR ──────────────────────────────────────────────────────────────
function ExportBar({ data, label, fileInputRef, onImport }: {
  data: Prev[]
  label: string
  fileInputRef: React.RefObject<HTMLInputElement>
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center justify-end mb-2">
      <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={onImport} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors"
      >
        <Upload size={13} /> Importar (Excel/CSV)
      </button>
      <button
        onClick={() => exportXLSX(data, label)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors"
      >
        <FileSpreadsheet size={13} /> Exportar Excel
      </button>
      <button
        onClick={() => exportCSV(data, label)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-600 hover:bg-zinc-700 text-white shadow-sm transition-colors"
      >
        <FileText size={13} /> Exportar CSV
      </button>
    </div>
  )
}

// ─── TABLE ────────────────────────────────────────────────────────────────────
function PrevTable({ data, isVisitante, unidade = 'h', limites, label }: {
  data: Prev[]
  isVisitante: boolean
  unidade?: 'h' | 'km'
  limites: number[]
  label: string
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [editVals, setEditVals] = useState({ ultimo: '', atual: '', intervalo: '', data: '' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos Status')
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const getStatus = (p: Prev) => {
    const proxima = p.ultimo_horimetro + p.intervalo_horas
    const falta = proxima - p.horimetro_atual
    return falta < 0 ? 'ATRASADO' : falta <= Math.min(100, p.intervalo_horas * 0.15) ? 'ATENÇÃO' : 'NO PRAZO'
  }

  const handleEdit = (p: Prev) => {
    setEditId(p.id)
    setEditVals({
      ultimo: String(p.ultimo_horimetro), atual: String(p.horimetro_atual),
      intervalo: String(p.intervalo_horas),
      data: p.data_atualizacao?.split('T')[0] || new Date().toISOString().split('T')[0]
    })
  }

  const handleSave = (id: string) => {
    startTransition(async () => {
      const res = await atualizarPreventiva(id, {
        ultimo_horimetro: parseFloat(editVals.ultimo),
        horimetro_atual: parseFloat(editVals.atual),
        intervalo_horas: parseFloat(editVals.intervalo),
        data_atualizacao: editVals.data
      })
      if ('error' in res) alert('Erro: ' + res.error)
      else setEditId(null)
    })
  }

  const handleDelete = (id: string, placa: string) => {
    if (confirm(`Excluir preventiva de ${placa}?`)) {
      startTransition(async () => {
        const res = await excluirPreventiva(id)
        if ('error' in res) alert(res.error)
      })
    }
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    alert(`Arquivo "${file.name}" recebido. Use a ação "Importar Preventivas" na página para processar em lote.`)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const filtered = data.filter(p => {
    const placa = p.equipamentos?.placa?.toLowerCase() || ''
    const status = getStatus(p)
    return placa.includes(search.toLowerCase()) &&
      (statusFilter === 'Todos Status' || status === statusFilter)
  })

  const inp = "px-2 py-1 rounded border border-blue-300 dark:border-blue-700 bg-white dark:bg-zinc-800 text-xs outline-none focus:ring-1 focus:ring-blue-400 w-24"

  return (
    <div className="flex flex-col gap-3">
      <ExportBar data={data} label={label} fileInputRef={fileInputRef} onImport={handleImportExcel} />
      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
          <input type="text" placeholder="Buscar placa..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white/50 dark:bg-slate-900/50 text-sm text-text-primary outline-none hover:border-slate-300 dark:hover:border-slate-600 transition-colors" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white/50 dark:bg-slate-900/50 text-sm text-text-secondary outline-none hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
          <option>Todos Status</option>
          <option>NO PRAZO</option>
          <option>ATENÇÃO</option>
          <option>ATRASADO</option>
        </select>
        <span className="text-xs text-text-muted">{filtered.length} veículos</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/50">
        <table className="w-full text-sm">
          <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-text-muted text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Placa</th>
              <th className="px-4 py-3 text-left">Tipo</th>
              <th className="px-4 py-3 text-left">Cat.</th>
              <th className="px-4 py-3 text-left">Módulo</th>
              <th className="px-4 py-3 text-left">Último</th>
              <th className="px-4 py-3 text-left">Atual</th>
              <th className="px-4 py-3 text-left">Próxima</th>
              <th className="px-4 py-3 text-left">Falta</th>
              <th className="px-4 py-3 text-left">Intervalo</th>
              <th className="px-4 py-3 text-left">Atualização</th>
              <th className="px-4 py-3 text-left">Status</th>
              {!isVisitante && <th className="px-4 py-3 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filtered.map(p => {
              const proxima = p.ultimo_horimetro + p.intervalo_horas
              const falta = proxima - p.horimetro_atual
              const status = getStatus(p)
              const badgeCls = status === 'ATRASADO'
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : status === 'ATENÇÃO'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              const isEditing = editId === p.id
              const eq = p.equipamentos

              return (
                <tr key={p.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">{eq?.placa}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{eq?.tipo}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{eq?.categoria}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{eq?.modulo || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {isEditing
                      ? <input className={inp} value={editVals.ultimo} onChange={e => setEditVals(v => ({ ...v, ultimo: e.target.value }))} />
                      : `${p.ultimo_horimetro}${unidade}`}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {isEditing
                      ? <input className={inp} value={editVals.atual} onChange={e => setEditVals(v => ({ ...v, atual: e.target.value }))} />
                      : `${p.horimetro_atual}${unidade}`}
                  </td>
                  <td className="px-4 py-3 font-bold text-xs">{proxima}{unidade}</td>
                  <td className={`px-4 py-3 font-bold text-xs ${falta < 0 ? 'text-red-500' : falta <= Math.min(100, p.intervalo_horas * 0.15) ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {falta}{unidade}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {isEditing
                      ? <input className={inp} value={editVals.intervalo} onChange={e => setEditVals(v => ({ ...v, intervalo: e.target.value }))} />
                      : `${p.intervalo_horas}${unidade}`}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {isEditing
                      ? <input type="date" className={inp + ' w-32'} value={editVals.data} onChange={e => setEditVals(v => ({ ...v, data: e.target.value }))} />
                      : (p.data_atualizacao ? p.data_atualizacao.split('T')[0].split('-').reverse().join('/') : '-')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeCls}`}>{status}</span>
                  </td>
                  {!isVisitante && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {isEditing ? (
                          <>
                            <button onClick={() => handleSave(p.id)} disabled={isPending} className="p-1 rounded text-emerald-600 hover:bg-emerald-50"><Check size={14} /></button>
                            <button onClick={() => setEditId(null)} className="p-1 rounded text-zinc-400 hover:bg-zinc-100"><X size={14} /></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(p)} className="p-1 rounded text-zinc-400 hover:text-blue-600 hover:bg-blue-50"><Edit2 size={14} /></button>
                            <button onClick={() => handleDelete(p.id, eq?.placa || '')} className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={12} className="py-12 text-center text-zinc-400 text-sm">Nenhum registro encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
interface Props {
  data: Prev[]
  isVisitante: boolean
}

type TabKey = 'dashboard-pesados' | 'pesados' | 'leves' | 'zocar' | 'dashboard-leves'

export default function ControleHorimetrosTabs({ data, isVisitante }: Props) {
  const [tab, setTab] = useState<TabKey>('dashboard-pesados')

  const pesados = data.filter(p => {
    const cat = p.equipamentos?.categoria?.toUpperCase() || ''
    const tipo = p.equipamentos?.tipo?.toUpperCase() || ''
    return cat === 'PESADA' || ['COMBOIO', 'MUNCK', 'PIPA', 'SKID MOVEL', 'SKID', 'MULTIFUNCIONAL', 'ESCAVADEIRA'].includes(tipo)
  })

  const leves = data.filter(p => {
    const cat = p.equipamentos?.categoria?.toUpperCase() || ''
    const tipo = p.equipamentos?.tipo?.toUpperCase() || ''
    return cat === 'LEVE' || ['CARRO', 'PICKUP', 'VAN', 'CAMINHONETE', 'LEVE'].includes(tipo)
  })

  const zocar = data.filter(p => {
    const tipo = p.equipamentos?.tipo?.toUpperCase() || ''
    const mod = p.equipamentos?.modulo?.toUpperCase() || ''
    return tipo.includes('ZOCAR') || mod.includes('ZOCAR') || (p.intervalo_horas <= 100 && p.intervalo_horas > 0)
  })

  const tipos = Array.from(new Set(pesados.map(p => p.equipamentos?.tipo).filter(Boolean))) as string[]

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'dashboard-pesados', label: 'Dashboard Pesados', icon: <BarChart2 size={14} /> },
    { key: 'pesados', label: `Pesados (${pesados.length})`, icon: <Truck size={14} /> },
    { key: 'dashboard-leves', label: 'Dashboard Leves', icon: <BarChart2 size={14} /> },
    { key: 'leves', label: `Leves (${leves.length})`, icon: <Gauge size={14} /> },
    { key: 'zocar', label: `Implemento Zocar (${zocar.length})`, icon: <Wrench size={14} /> },
  ]

  const fileInputAllRef = useRef<HTMLInputElement>(null)
  const allData = [...new Map(data.map(d => [d.id, d])).values()]

  return (
    <div className="flex flex-col gap-4">
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />

      {/* Header action bar */}
      <div className="flex flex-wrap gap-2 items-center justify-between bg-white/40 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-xl p-3 backdrop-blur-sm">
        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Exportar todos os dados:</span>
        <div className="flex gap-2">
          <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputAllRef} className="hidden" />
          <button onClick={() => exportXLSX(allData, 'horimetros_completo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors">
            <FileSpreadsheet size={13} /> Excel Completo
          </button>
          <button onClick={() => exportCSV(allData, 'horimetros_completo')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-600 hover:bg-zinc-700 text-white shadow-sm transition-colors">
            <FileText size={13} /> CSV Completo
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/30'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Pesados — SVG clustered bar chart with filters */}
      {tab === 'dashboard-pesados' && (
        <DashboardHorimetros data={pesados} />
      )}

      {tab === 'pesados' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-blue-500" />
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Veículos Pesados — Manutenção a cada 500 horas</h3>
          </div>
          <PrevTable data={pesados} isVisitante={isVisitante} unidade="h" limites={[500]} label="horimetros_pesados" />
        </div>
      )}

      {/* Dashboard Leves — SVG clustered bar chart with filters */}
      {tab === 'dashboard-leves' && (
        <DashboardHorimetros data={leves} unit="km" warnThreshold={1000} />
      )}

      {tab === 'leves' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Gauge size={16} className="text-blue-500" />
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Veículos Leves — Manutenção a cada 10.000 km</h3>
          </div>
          <PrevTable data={leves} isVisitante={isVisitante} unidade="km" limites={[10000]} label="horimetros_leves" />
        </div>
      )}

      {tab === 'zocar' && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Wrench size={16} className="text-orange-500" />
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Implemento Zocar — Intervalos: 100h / 500h / 1.000h</h3>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-2">
            {[100, 500, 1000].map(interv => {
              const group = zocar.filter(p => p.intervalo_horas === interv)
              return (
                <div key={interv} className="glass-card rounded-xl p-3 shadow-sm">
                  <p className="text-xs text-text-muted font-medium">Intervalo {interv}h</p>
                  <p className="text-2xl font-black text-text-primary">{group.length}</p>
                  <p className="text-xs text-text-muted">equipamentos</p>
                </div>
              )
            })}
          </div>
          <PrevTable data={zocar} isVisitante={isVisitante} unidade="h" limites={[100, 500, 1000]} label="horimetros_zocar" />
        </div>
      )}
    </div>
  )
}
