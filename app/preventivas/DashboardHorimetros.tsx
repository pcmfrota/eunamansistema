'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronDown, X, Filter, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Prev = {
  id: string
  ultimo_horimetro: number
  horimetro_atual: number
  intervalo_horas: number
  data_atualizacao: string | null
  equipamentos: { placa: string; tipo: string; categoria: string; modulo: string | null } | null
}

function getFalta(p: Prev) {
  return (p.ultimo_horimetro + p.intervalo_horas) - p.horimetro_atual
}
function getColor(falta: number, warn = 75) {
  return falta < 0 ? '#dc2626' : falta <= warn ? '#eab308' : '#16a34a'
}
function getStatusLabel(falta: number, warn = 75) {
  return falta < 0 ? 'ATRASADO' : falta <= warn ? 'ATENÇÃO' : 'NO PRAZO'
}

// ─── MULTI-SELECT DROPDOWN ────────────────────────────────────────────────────
function MultiSelect({ label, options, value, onChange }: {
  label: string; options: string[]; value: string[]; onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const toggle = (opt: string) => {
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt])
  }
  const allSelected = value.length === 0
  return (
    <div ref={ref} className="relative min-w-[160px]">
      <button onClick={() => setOpen(!open)}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-text-primary hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
        <span className="truncate">{allSelected ? 'Todos' : value.length === 1 ? value[0] : `${value.length} selecionados`}</span>
        <ChevronDown size={14} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-max min-w-full max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl py-1">
          <button onClick={() => onChange([])} className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${allSelected ? 'text-blue-500' : 'text-text-muted'}`}>
            <div className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
              {allSelected && <svg width="10" height="8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </div>
            Todos
          </button>
          {options.map(opt => (
            <button key={opt} onClick={() => toggle(opt)}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${value.includes(opt) ? 'text-blue-500' : 'text-text-secondary'}`}>
              <div className={`w-4 h-4 rounded border flex items-center justify-center ${value.includes(opt) ? 'bg-blue-500 border-blue-500' : 'border-slate-300 dark:border-slate-600'}`}>
                {value.includes(opt) && <svg width="10" height="8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </div>
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SVG BAR CHART ────────────────────────────────────────────────────────────
function GroupChart({ title, items, onBarClick, fullWidth = false }: {
  title: string; items: Prev[]; onBarClick: (p: Prev) => void; fullWidth?: boolean
}) {
  const sorted = [...items].sort((a, b) => getFalta(a) - getFalta(b))

  const faltas = sorted.map(getFalta)
  const maxPos = Math.max(...faltas.filter(f => f >= 0), 1)
  const maxNeg = Math.max(...faltas.filter(f => f < 0).map(f => Math.abs(f)), 0)
  const hasNeg = maxNeg > 0

  const BAR_W = fullWidth ? 48 : 36
  const BAR_GAP = fullWidth ? 14 : 10
  const POS_H = 100
  const NEG_H = hasNeg ? 48 : 0
  const VAL_SPACE = 22
  const LABEL_H = 26        // só placa
  const CHART_H = VAL_SPACE + POS_H + NEG_H + LABEL_H
  const BASELINE = VAL_SPACE + POS_H
  const SVG_W = sorted.length * (BAR_W + BAR_GAP) + BAR_GAP
  const MIN_W = sorted.length * (fullWidth ? 64 : 52)

  return (
    <div className="glass-card rounded-xl overflow-hidden h-full">
      <div className="px-3 py-2 border-b border-border-color bg-white/40 dark:bg-black/20">
        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">{title.toUpperCase()}</h3>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${CHART_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', minWidth: MIN_W + 'px', height: CHART_H + 'px' }}
        >
          {/* Grid */}
          {[0.33, 0.66, 1].map(f => (
            <line key={f} x1={0} y1={BASELINE - POS_H * f * 0.95} x2={SVG_W} y2={BASELINE - POS_H * f * 0.95}
              stroke="currentColor" strokeWidth={0.5} className="text-slate-200/50 dark:text-zinc-800/40" />
          ))}
          <line x1={0} y1={BASELINE} x2={SVG_W} y2={BASELINE} stroke="currentColor" strokeWidth={1} className="text-slate-400/80 dark:text-zinc-600" />

          {sorted.map((p, i) => {
            const falta = getFalta(p)
            const color = getColor(falta)
            const cx = BAR_GAP + i * (BAR_W + BAR_GAP)
            const barCx = cx + BAR_W / 2

            if (falta >= 0) {
              const barH = Math.max((falta / maxPos) * POS_H * 0.93, 2)
              const barY = BASELINE - barH
              return (
                <g key={p.id} onClick={() => onBarClick(p)} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
                  <rect x={cx} y={0} width={BAR_W} height={CHART_H} fill="transparent" />
                  <rect x={cx} y={barY} width={BAR_W} height={barH} fill={color} rx={2.5} opacity={0.92}
                    onMouseEnter={e => e.currentTarget.setAttribute('opacity', '1')}
                    onMouseLeave={e => e.currentTarget.setAttribute('opacity', '0.92')} />
                  {/* Badge above bar */}
                  <rect x={barCx - 16} y={barY - 18} width={32} height={15} rx={3} fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth={0.5} />
                  <text x={barCx} y={barY - 7} textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--text-primary)" pointerEvents="none">
                    {falta === 0 ? '0' : `+${falta}`}
                  </text>
                  {/* Só placa embaixo — sem módulo para evitar sobreposição */}
                  <text x={barCx} y={BASELINE + NEG_H + 16} textAnchor="middle" fontSize={9} fontWeight="700" fill="currentColor" className="text-slate-600 dark:text-slate-400" pointerEvents="none">
                    {p.equipamentos?.placa}
                  </text>
                </g>
              )
            } else {
              const barH = Math.max((Math.abs(falta) / Math.max(maxNeg, 1)) * NEG_H * 0.9, 3)
              return (
                <g key={p.id} onClick={() => onBarClick(p)} style={{ cursor: 'pointer', pointerEvents: 'all' }}>
                  <rect x={cx} y={0} width={BAR_W} height={CHART_H} fill="transparent" />
                  <rect x={cx} y={BASELINE} width={BAR_W} height={barH} fill={color} rx={2.5} opacity={0.92}
                    onMouseEnter={e => e.currentTarget.setAttribute('opacity', '1')}
                    onMouseLeave={e => e.currentTarget.setAttribute('opacity', '0.92')} />
                  {/* Badge INSIDE bar at top */}
                  <rect x={barCx - 16} y={BASELINE + 3} width={32} height={14} rx={3} fill="var(--bg-primary)" stroke="var(--border-color)" strokeWidth={0.5} />
                  <text x={barCx} y={BASELINE + 14} textAnchor="middle" fontSize={9} fontWeight="700" fill="var(--text-primary)" pointerEvents="none">{falta}</text>
                  {/* Só placa */}
                  <text x={barCx} y={BASELINE + NEG_H + 16} textAnchor="middle" fontSize={9} fontWeight="700" fill="currentColor" className="text-slate-600 dark:text-slate-400" pointerEvents="none">
                    {p.equipamentos?.placa}
                  </text>
                </g>
              )
            }
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────
function VehicleDetailModal({ vehicle, onClose, unit = 'h', warnThreshold = 75 }: {
  vehicle: Prev; onClose: () => void; unit?: string; warnThreshold?: number
}) {
  const falta = getFalta(vehicle)
  const proxima = vehicle.ultimo_horimetro + vehicle.intervalo_horas
  const status = getStatusLabel(falta, warnThreshold)
  const progress = Math.min(100, Math.max(0, ((vehicle.horimetro_atual - vehicle.ultimo_horimetro) / vehicle.intervalo_horas) * 100))
  const color = getColor(falta, warnThreshold)
  const eq = vehicle.equipamentos
  const U = unit   // short alias

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="glass-card rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">DETALHES DO VEÍCULO</p>
            <h2 className="text-3xl font-black text-text-primary tracking-tight">{eq?.placa}</h2>
            <p className="text-text-secondary text-sm mt-0.5 uppercase">{eq?.tipo} — {eq?.categoria} {eq?.modulo ? `— ${eq.modulo}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-text-muted hover:text-text-primary">
            <X size={18} />
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 mb-5">
          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white"
            style={{ backgroundColor: color }}>
            {status}
          </span>
          {falta >= 0
            ? <span className="flex items-center gap-1 text-sm text-emerald-400"><TrendingUp size={14} /> {falta.toLocaleString('pt-BR')}{U} restantes</span>
            : <span className="flex items-center gap-1 text-sm text-red-400"><TrendingDown size={14} /> {Math.abs(falta).toLocaleString('pt-BR')}{U} atrasado</span>
          }
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'ÚLTIMO', value: `${vehicle.ultimo_horimetro.toLocaleString('pt-BR')}${U}` },
            { label: 'ATUAL', value: `${vehicle.horimetro_atual.toLocaleString('pt-BR')}${U}` },
            { label: 'PRÓXIMA', value: `${proxima.toLocaleString('pt-BR')}${U}` },
          ].map(s => (
            <div key={s.label} className="bg-white/50 dark:bg-slate-900/50 rounded-xl p-3 border border-border-color text-center">
              <p className="text-lg font-bold text-text-primary">{s.value}</p>
              <p className="text-[10px] text-text-muted uppercase mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-text-muted mb-2 uppercase tracking-wider font-semibold">
            <span>Progresso desde última manutenção</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: color }} />
          </div>
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            <span>{vehicle.ultimo_horimetro.toLocaleString('pt-BR')}{U}</span>
            <span className="text-zinc-400 uppercase font-semibold">Intervalo: {vehicle.intervalo_horas.toLocaleString('pt-BR')}{U}</span>
            <span>{proxima.toLocaleString('pt-BR')}{U}</span>
          </div>
        </div>

        {/* Falta bar */}
        <div className="p-4 rounded-xl border uppercase tracking-wider" style={{ borderColor: color + '40', backgroundColor: color + '15' }}>
          <div className="flex justify-between items-center">
            <p className="text-sm font-bold" style={{ color }}>
              {falta >= 0 ? `${U === 'km' ? 'KM RESTANTES' : 'HORAS RESTANTES'} PARA MANUTENÇÃO` : `${U === 'km' ? 'KM EM ATRASO' : 'HORAS EM ATRASO'}`}
            </p>
            <p className="text-2xl font-black" style={{ color }}>
              {falta >= 0 ? `+${falta.toLocaleString('pt-BR')}` : falta.toLocaleString('pt-BR')}{U}
            </p>
          </div>
          {vehicle.data_atualizacao && (
            <p className="text-xs text-zinc-500 mt-2 font-semibold">
              ÚLTIMA ATUALIZAÇÃO: {vehicle.data_atualizacao.split('T')[0].split('-').reverse().join('/')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function DashboardHorimetros({ data, unit = 'h', warnThreshold = 75 }: {
  data: Prev[]; unit?: 'h' | 'km'; warnThreshold?: number
}) {
  const [tipoFilter, setTipoFilter] = useState<string[]>([])
  const [placaFilter, setPlacaFilter] = useState<string[]>([])
  const [mesFilter, setMesFilter] = useState('')
  const [anoFilter, setAnoFilter] = useState('')
  const [selected, setSelected] = useState<Prev | null>(null)

  // Options for filters
  const tipoOptions = useMemo(() =>
    Array.from(new Set(data.map(p => p.equipamentos?.tipo).filter(Boolean))).sort() as string[],
    [data])

  const placaOptions = useMemo(() =>
    Array.from(new Set(data.map(p => p.equipamentos?.placa).filter(Boolean))).sort() as string[],
    [data])

  const anoOptions = useMemo(() => {
    const anos = Array.from(new Set(data.map(p => p.data_atualizacao?.substring(0, 4)).filter(Boolean))) as string[]
    return anos.sort().reverse()
  }, [data])

  const mesOptions = useMemo(() => {
    const seen = new Set<string>()
    const meses = data.map(p => {
      const d = p.data_atualizacao?.split('T')[0]
      if (!d) return null
      const [y, m] = d.split('-')
      const mLabel = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][parseInt(m)-1]
      return { label: `${mLabel}/${y}`, sort: `${y}-${m}` }
    }).filter(Boolean) as { label: string; sort: string }[]
    return meses
      .filter(m => { if (seen.has(m.sort)) return false; seen.add(m.sort); return true })
      .sort((a, b) => b.sort.localeCompare(a.sort))
      .map(m => m.label)
  }, [data])

  // Apply filters
  const filtered = useMemo(() => {
    return data.filter(p => {
      const tipo = p.equipamentos?.tipo || ''
      const placa = p.equipamentos?.placa || ''
      const dateStr = p.data_atualizacao?.split('T')[0] || ''
      const [y, m] = dateStr.split('-')
      const mLabel = m ? ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][parseInt(m)-1] : ''
      const mesLabel = mLabel && y ? `${mLabel}/${y}` : ''

      if (tipoFilter.length > 0 && !tipoFilter.includes(tipo)) return false
      if (placaFilter.length > 0 && !placaFilter.includes(placa)) return false
      if (mesFilter && mesLabel !== mesFilter) return false
      if (anoFilter && y !== anoFilter) return false
      return true
    })
  }, [data, tipoFilter, placaFilter, mesFilter, anoFilter])

  // Group by tipo, sorted so COMBOIO is last (full width)
  const groups = useMemo(() => {
    const tipos = Array.from(new Set(filtered.map(p => p.equipamentos?.tipo).filter(Boolean))) as string[]
    return tipos
      .sort((a, b) => {
        if (a === 'COMBOIO') return 1
        if (b === 'COMBOIO') return -1
        return a.localeCompare(b)
      })
      .map(tipo => ({
        tipo,
        items: filtered.filter(p => p.equipamentos?.tipo === tipo)
      }))
      .filter(g => g.items.length > 0)
  }, [filtered])

  const counts = useMemo(() => ({
    ok:   filtered.filter(p => getFalta(p) > warnThreshold).length,
    warn: filtered.filter(p => { const f = getFalta(p); return f >= 0 && f <= warnThreshold }).length,
    late: filtered.filter(p => getFalta(p) < 0).length,
  }), [filtered, warnThreshold])

  // Split groups: COMBOIO full width, others in 2-col grid
  const comboio = groups.find(g => g.tipo === 'COMBOIO')
  const others = groups.filter(g => g.tipo !== 'COMBOIO')

  const hasActiveFilter = tipoFilter.length > 0 || placaFilter.length > 0 || mesFilter || anoFilter

  return (
    <div className="flex flex-col gap-2">
      {/* ── Header compacto ── */}
      <div className="relative rounded-xl overflow-hidden border border-emerald-200/50 dark:border-emerald-800/30">
        <div className="bg-gradient-to-r from-emerald-50/90 via-emerald-100/90 to-teal-50/90 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-teal-950/40 px-5 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-600 dark:bg-emerald-500/20 border border-emerald-700/10 dark:border-emerald-400/20 flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-base font-black text-white dark:text-emerald-200">E</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-emerald-900 dark:text-emerald-100 tracking-wider uppercase leading-tight">
              {(unit === 'km' ? 'Controle de Km Rodados' : 'Controle de Horímetro').toUpperCase()}
            </h1>
            <p className="text-emerald-700 dark:text-emerald-300 text-xs font-medium">
              {unit === 'km' ? 'Veículos Leves — Troca a cada 10.000 km' : 'Veículos Pesados — Intervalo padrão 500 horas'} — clique em qualquer barra
            </p>
          </div>
        </div>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
          backgroundImage: 'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
          backgroundSize: '10px 10px'
        }} />
      </div>

      {/* ── Filtros em linha única ── */}
      <div className="glass-card rounded-xl px-3 py-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter size={8} /> Filtros:
          </span>
          <MultiSelect label="Tipo" options={tipoOptions} value={tipoFilter} onChange={setTipoFilter} />
          <MultiSelect label="Placa" options={placaOptions} value={placaFilter} onChange={setPlacaFilter} />
          <select value={mesFilter} onChange={e => setMesFilter(e.target.value)}
            className="px-2 py-1.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-text-primary outline-none hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
            <option value="">Todos os Meses</option>
            {mesOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={anoFilter} onChange={e => setAnoFilter(e.target.value)}
            className="px-2 py-1.5 bg-white/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-text-primary outline-none hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
            <option value="">Todos</option>
            {anoOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {hasActiveFilter && (
            <button onClick={() => { setTipoFilter([]); setPlacaFilter([]); setMesFilter(''); setAnoFilter('') }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 text-xs font-semibold hover:bg-red-900/50 transition-colors">
              <X size={10} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards compactos ── */}
      <div className="grid grid-cols-3 gap-2">
        {/* NO PRAZO */}
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/30 shadow-sm transition-all duration-300 hover:shadow-md">
          <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{counts.ok}</span>
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200 leading-tight">NO PRAZO</p>
            <p className="text-emerald-600/80 dark:text-emerald-400/80 text-[10px] font-medium">Dentro do intervalo</p>
          </div>
        </div>
        {/* ATENÇÃO */}
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/30 shadow-sm transition-all duration-300 hover:shadow-md">
          <span className="text-3xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{counts.warn}</span>
          <div>
            <p className="text-sm font-bold text-amber-800 dark:text-amber-200 leading-tight">ATENÇÃO</p>
            <p className="text-amber-600/80 dark:text-amber-400/80 text-[10px] font-medium">Menos de {warnThreshold.toLocaleString('pt-BR')}{unit} restantes</p>
          </div>
        </div>
        {/* ATRASADO */}
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 bg-red-50/80 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/30 shadow-sm transition-all duration-300 hover:shadow-md">
          <span className="text-3xl font-black text-red-600 dark:text-red-400 tabular-nums">{counts.late}</span>
          <div>
            <p className="text-sm font-bold text-red-800 dark:text-red-200 leading-tight">ATRASADO</p>
            <p className="text-red-600/80 dark:text-red-400/80 text-[10px] font-medium">Manutenção vencida</p>
          </div>
        </div>
      </div>

      {/* ── Gráficos ── */}
      {groups.length === 0 ? (
        <div className="text-center py-10 text-text-muted glass-card rounded-xl text-sm">
          Nenhum dado para os filtros selecionados.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {others.length > 0 && (
            <div className={`grid gap-2 ${others.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {others.map(g => (
                <GroupChart key={g.tipo} title={g.tipo} items={g.items} onBarClick={setSelected} fullWidth={false} />
              ))}
            </div>
          )}
          {comboio && (
            <GroupChart title="COMBOIO" items={comboio.items} onBarClick={setSelected} fullWidth={true} />
          )}
        </div>
      )}

      {/* ── Legenda ── */}
      <div className="flex gap-4 items-center justify-center py-1">
        {[{ color: '#16a34a', label: `NO PRAZO (> ${warnThreshold.toLocaleString('pt-BR')}${unit})` }, { color: '#eab308', label: `ATENÇÃO (≤ ${warnThreshold.toLocaleString('pt-BR')}${unit})` }, { color: '#dc2626', label: 'ATRASADO (< 0)' }].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>

      {selected && <VehicleDetailModal vehicle={selected} onClose={() => setSelected(null)} unit={unit} warnThreshold={warnThreshold} />}
    </div>
  )
}
