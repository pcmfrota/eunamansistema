'use client'

import { useMemo, useRef, useState, useEffect, type ReactNode } from 'react'
import { Search, X, FilterX, Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react'
import { CheckboxMultiSelect } from '@/components/checkbox-multi-select'
import { fimDoMes, periodoDoAtalho, type AtalhoPeriodo } from '@/lib/horimetro-km-calc'
import { hojeLocal, type FiltrosDashboard, type FiltroFrota } from './useFiltrosUrl'

type Props = {
  filtros: FiltrosDashboard
  atualizar: (p: Partial<FiltrosDashboard>) => void
  limpar: () => void
  placasDisponiveis: string[]
  tiposDisponiveis: string[]
  rfAtual: { ano: number; mes: number; inicio: string; fim: string } | null
  onExportar: (formato: 'xlsx' | 'csv') => void
  podeExportar: boolean
  /** Visão anual: esconde os controles de período (o ano é escolhido no próprio painel). */
  modoAnual?: boolean
  /** Controle extra mostrado ao lado de Categoria / Tipo (ex.: Horímetro / KM dos gráficos). */
  extra?: ReactNode
}

export function Segmentado<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: { v: T; l: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 p-0.5">
      {opcoes.map(o => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${valor === o.v ? 'bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'}`}>
          {o.l}
        </button>
      ))}
    </div>
  )
}

/** Busca de placa com autocomplete e seleção múltipla (chips). */
function PlacasSelect({ valores, onChange, opcoes }: { valores: string[]; onChange: (v: string[]) => void; opcoes: string[] }) {
  const [texto, setTexto] = useState('')
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  const sugestoes = useMemo(() => {
    const t = texto.trim().toUpperCase()
    return opcoes.filter(p => !valores.includes(p) && (!t || p.toUpperCase().includes(t))).slice(0, 30)
  }, [texto, opcoes, valores])

  return (
    <div ref={ref} className="relative min-w-[220px] flex-1 max-w-sm">
      <div className="flex flex-wrap items-center gap-1 px-2 py-1 min-h-[34px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 focus-within:ring-2 focus-within:ring-blue-500">
        <Search size={13} className="text-zinc-400 shrink-0" />
        {valores.map(p => (
          <span key={p} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-700 dark:text-zinc-200">
            {p}
            <button type="button" aria-label={`Remover ${p}`} onClick={() => onChange(valores.filter(x => x !== p))}><X size={11} /></button>
          </span>
        ))}
        <input value={texto} onChange={e => { setTexto(e.target.value); setAberto(true) }} onFocus={() => setAberto(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && sugestoes[0]) { onChange([...valores, sugestoes[0]]); setTexto('') }
            if (e.key === 'Backspace' && !texto && valores.length) onChange(valores.slice(0, -1))
          }}
          placeholder={valores.length ? '' : 'Placa(s)...'} className="flex-1 min-w-[70px] bg-transparent outline-none text-xs py-1 dark:text-white" />
      </div>
      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-30 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {sugestoes.map(p => (
            <button key={p} type="button" onClick={() => { onChange([...valores, p]); setTexto('') }}
              className="block w-full text-left px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">{p}</button>
          ))}
        </div>
      )}
    </div>
  )
}

const ATALHOS: { v: AtalhoPeriodo; l: string }[] = [
  { v: 'mes-atual', l: 'Mês atual' },
  { v: 'mes-anterior', l: 'Mês anterior' },
  { v: 'ultimos-3-meses', l: 'Últimos 3 meses' },
  { v: 'ano-atual', l: 'Ano atual' },
  { v: 'ano-anterior', l: 'Ano anterior' },
]

function MenuExportar({ onExportar, desabilitado }: { onExportar: (f: 'xlsx' | 'csv') => void; desabilitado: boolean }) {
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora)
    return () => document.removeEventListener('mousedown', fora)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" disabled={desabilitado} onClick={() => setAberto(a => !a)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40">
        <Download size={13} /> Exportar <ChevronDown size={12} />
      </button>
      {aberto && (
        <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
          <button type="button" onClick={() => { onExportar('xlsx'); setAberto(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileSpreadsheet size={13} className="text-emerald-600" /> Excel (.xlsx)</button>
          <button type="button" onClick={() => { onExportar('csv'); setAberto(false) }} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileText size={13} className="text-zinc-500" /> CSV</button>
        </div>
      )}
    </div>
  )
}

const inputData = 'px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500'

export default function FiltrosBar({ filtros, atualizar, limpar, placasDisponiveis, tiposDisponiveis, rfAtual, onExportar, podeExportar, modoAnual = false, extra }: Props) {
  const mesSelecionado = filtros.modo === 'mes' ? filtros.inicio.slice(0, 7) : ''
  const btnAtalho = (ativo: boolean) => `px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${ativo ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`

  return (
    <div className="sticky top-0 z-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur shadow-sm p-3 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmentado<FiltroFrota> valor={filtros.frota} onChange={v => atualizar({ frota: v })}
          opcoes={[{ v: 'todos', l: 'Todos' }, { v: 'pesados', l: 'Pesados' }, { v: 'leves', l: 'Leves' }]} />
        <PlacasSelect valores={filtros.placas} onChange={v => atualizar({ placas: v })} opcoes={placasDisponiveis} />
        <CheckboxMultiSelect values={filtros.tipos} onChange={v => atualizar({ tipos: v })}
          options={tiposDisponiveis.map(t => ({ value: t, label: t }))} placeholder="Categoria / Tipo" />
        {extra}
        <div className="flex items-center gap-2 ml-auto">
          {!modoAnual && <>
            <span className="text-[11px] font-semibold text-zinc-500 uppercase">Média</span>
            <Segmentado valor={filtros.visao} onChange={v => atualizar({ visao: v })} opcoes={[{ v: 'mensal', l: 'Mensal' }, { v: 'anual', l: 'Anual' }]} />
          </>}
          <button type="button" onClick={limpar} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <FilterX size={13} /> Limpar filtros
          </button>
          <MenuExportar onExportar={onExportar} desabilitado={!podeExportar} />
        </div>
      </div>

      {!modoAnual && <div className="flex flex-wrap items-center gap-1.5">
        {ATALHOS.map(a => (
          <button key={a.v} type="button" className={btnAtalho(filtros.modo === a.v)}
            onClick={() => atualizar({ modo: a.v, ...periodoDoAtalho(a.v, hojeLocal()) })}>{a.l}</button>
        ))}
        {rfAtual && (
          <button type="button" className={btnAtalho(filtros.modo === 'rf')} title={`Período Suzano RF'${String(rfAtual.mes).padStart(2, '0')}`}
            onClick={() => atualizar({ modo: 'rf', inicio: rfAtual.inicio, fim: rfAtual.fim })}>
            RF&apos;{String(rfAtual.mes).padStart(2, '0')} (Suzano)
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
          Mês/Ano
          <input type="month" className={inputData} value={mesSelecionado}
            onChange={e => { const m = e.target.value; if (m) atualizar({ modo: 'mes', inicio: `${m}-01`, fim: fimDoMes(m) }) }} />
        </label>
        <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
          De
          <input type="date" className={inputData} value={filtros.inicio} max={filtros.fim}
            onChange={e => { if (e.target.value) atualizar({ modo: 'custom', inicio: e.target.value }) }} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
          Até
          <input type="date" className={inputData} value={filtros.fim} min={filtros.inicio}
            onChange={e => { if (e.target.value) atualizar({ modo: 'custom', fim: e.target.value }) }} />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase ml-auto" title="Placa sem leitura há mais dias que isso fica com status Atrasada">
          Atrasada após
          <input type="number" min={1} max={365} className={inputData + ' w-16'} value={filtros.atraso}
            onChange={e => { const n = Math.round(Number(e.target.value)); if (n >= 1) atualizar({ atraso: n }) }} />
          dias
        </label>
      </div>}
    </div>
  )
}
