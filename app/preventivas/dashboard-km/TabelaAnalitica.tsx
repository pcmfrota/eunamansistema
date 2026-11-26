'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, ChevronLeft, ChevronRight, CheckCircle2, Clock3, AlertOctagon } from 'lucide-react'
import { sigla, fmtNum, fmtData, usoValido, type LinhaPlaca, type StatusLeitura, type ResultadoUso } from '@/lib/horimetro-km-calc'

type Chave = 'placa' | 'tipo' | 'frota' | 'inicial' | 'final' | 'uso' | 'diaria' | 'mensal' | 'projecao' | 'ultima' | 'dias' | 'status'
const POR_PAGINA = 15
const ORDEM_STATUS: Record<StatusLeitura, number> = { Inconsistente: 0, Atrasada: 1, 'Em dia': 2 }

function valorOrdenacao(l: LinhaPlaca, k: Chave): string | number | null {
  const p = l.principal
  switch (k) {
    case 'placa': return l.equipamento.placa
    case 'tipo': return l.equipamento.tipo || ''
    case 'frota': return l.frota
    case 'inicial': return p.leituraInicial
    case 'final': return p.leituraFinal
    case 'uso': return usoValido(p)
    case 'diaria': return p.mediaDiaria
    case 'mensal': return p.mediaMensal
    case 'projecao': return p.projecaoAnual
    case 'ultima': return l.ultimaLeitura
    case 'dias': return l.diasSemLeitura
    case 'status': return ORDEM_STATUS[l.status]
  }
}

export function StatusBadge({ status }: { status: StatusLeitura }) {
  const cfg = {
    'Em dia': { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40', Icone: CheckCircle2 },
    Atrasada: { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40', Icone: Clock3 },
    Inconsistente: { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40', Icone: AlertOctagon },
  }[status]
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold whitespace-nowrap ${cfg.cls}`}><cfg.Icone size={11} />{status}</span>
}

/** Valor na unidade da placa; nos pesados com KM, mostra o KM embaixo em azul. */
const Insuf = () => <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400" title="Só 1 leitura no período: são necessárias pelo menos 2 para calcular o uso">Insuficiente (1 leitura)</span>

function Valor({ l, pegar, casas = 0, insuficiente = false }: { l: LinhaPlaca; pegar: (r: ResultadoUso) => number | null; casas?: number; insuficiente?: boolean }) {
  const v = pegar(l.principal)
  const km = l.km ? pegar(l.km) : null
  return (
    <div className="flex flex-col items-end leading-tight">
      {v == null && insuficiente && l.principal.insuficiente
        ? <Insuf />
        : <span className={v == null ? 'text-zinc-300' : ''}>{v == null ? '—' : `${fmtNum(v, casas)} ${sigla(l.unidade)}`}</span>}
      {km != null && <span className="text-[10px] text-blue-600 dark:text-blue-400">{fmtNum(km, casas)} KM</span>}
      {km == null && insuficiente && l.km?.insuficiente && <Insuf />}
    </div>
  )
}

const COLUNAS: { k: Chave; l: string; num?: boolean }[] = [
  { k: 'placa', l: 'Placa' }, { k: 'tipo', l: 'Tipo' }, { k: 'frota', l: 'Frota' },
  { k: 'inicial', l: 'Leitura inicial', num: true }, { k: 'final', l: 'Leitura final', num: true },
  { k: 'uso', l: 'Uso no período', num: true }, { k: 'diaria', l: 'Média diária', num: true },
  { k: 'mensal', l: 'Média mensal', num: true }, { k: 'projecao', l: 'Projeção anual', num: true },
  { k: 'ultima', l: 'Última leitura' }, { k: 'dias', l: 'Dias sem leitura', num: true }, { k: 'status', l: 'Status' },
]

export default function TabelaAnalitica({ linhas, onSelecionar, acaoExtra }: { linhas: LinhaPlaca[]; onSelecionar: (l: LinhaPlaca) => void; acaoExtra?: ReactNode }) {
  const [busca, setBusca] = useState('')
  const [ordem, setOrdem] = useState<{ k: Chave; asc: boolean }>({ k: 'uso', asc: false })
  const [pagina, setPagina] = useState(0)

  const filtradas = useMemo(() => {
    const t = busca.trim().toUpperCase()
    const base = t ? linhas.filter(l => l.equipamento.placa.toUpperCase().includes(t) || (l.equipamento.tipo || '').toUpperCase().includes(t)) : linhas
    return [...base].sort((a, b) => {
      const va = valorOrdenacao(a, ordem.k), vb = valorOrdenacao(b, ordem.k)
      if (va == null && vb == null) return 0
      if (va == null) return 1 // vazios sempre no fim
      if (vb == null) return -1
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb))
      return ordem.asc ? c : -c
    })
  }, [linhas, busca, ordem])

  useEffect(() => { setPagina(0) }, [busca, ordem, linhas])
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const visiveis = filtradas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA)
  const ordenar = (k: Chave) => setOrdem(o => ({ k, asc: o.k === k ? !o.asc : k === 'placa' || k === 'tipo' }))

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">Análise por placa <span className="font-normal text-zinc-500">({filtradas.length})</span></h3>
        <div className="flex items-center gap-2">
          {acaoExtra}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar placa ou tipo..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 w-52" />
          </div>
        </div>
      </div>

      {/* Desktop: tabela com cabeçalho fixo */}
      <div className="hidden md:block overflow-auto max-h-[560px]">
        <table className="w-full text-xs tabular-nums">
          <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950">
            <tr>
              {COLUNAS.map(c => (
                <th key={c.k} className={`px-3 py-2.5 font-bold text-[11px] uppercase tracking-wide text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}>
                  <button type="button" onClick={() => ordenar(c.k)} className={`inline-flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200 ${c.num ? 'flex-row-reverse' : ''}`}>
                    {c.l}
                    {ordem.k === c.k ? (ordem.asc ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="opacity-30" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map(l => (
              <tr key={l.equipamento.id} onClick={() => onSelecionar(l)} className="cursor-pointer border-b border-zinc-100 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400">{l.equipamento.placa}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{l.equipamento.tipo || '—'}</td>
                <td className="px-3 py-2">
                  <span className={`text-[11px] font-bold ${l.frota === 'leve' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{l.frota === 'leve' ? 'Leve' : 'Pesado'}</span>
                </td>
                <td className="px-3 py-2 text-right"><Valor l={l} pegar={r => r.leituraInicial} casas={1} /></td>
                <td className="px-3 py-2 text-right"><Valor l={l} pegar={r => r.leituraFinal} casas={1} /></td>
                <td className="px-3 py-2 text-right font-bold text-zinc-900 dark:text-white"><Valor l={l} pegar={usoValido} casas={1} insuficiente /></td>
                <td className="px-3 py-2 text-right"><Valor l={l} pegar={r => r.mediaDiaria} casas={1} /></td>
                <td className="px-3 py-2 text-right"><Valor l={l} pegar={r => r.mediaMensal} casas={1} /></td>
                <td className="px-3 py-2 text-right"><Valor l={l} pegar={r => r.projecaoAnual} /></td>
                <td className="px-3 py-2 whitespace-nowrap">{fmtData(l.ultimaLeitura)}</td>
                <td className={`px-3 py-2 text-right ${l.status === 'Atrasada' ? 'text-amber-700 dark:text-amber-400 font-bold' : ''}`}>{l.diasSemLeitura ?? '—'}</td>
                <td className="px-3 py-2"><StatusBadge status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visiveis.length && <p className="p-8 text-center text-sm text-zinc-400">Nenhuma placa encontrada.</p>}
      </div>

      {/* Mobile: lista de cards */}
      <div className="md:hidden flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
        {visiveis.map(l => (
          <button key={l.equipamento.id} type="button" onClick={() => onSelecionar(l)} className="text-left p-3 flex flex-col gap-2 active:bg-zinc-50 dark:active:bg-zinc-800/40">
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="font-bold text-amber-700 dark:text-amber-400">{l.equipamento.placa}</span>
                <span className="ml-2 text-[11px] text-zinc-500">{l.equipamento.tipo} · {l.frota === 'leve' ? 'Leve' : 'Pesado'}</span>
              </div>
              <StatusBadge status={l.status} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] tabular-nums">
              <div><div className="text-zinc-400">Uso</div><div className="font-bold">{l.principal.insuficiente ? <Insuf /> : usoValido(l.principal) != null ? `${fmtNum(l.principal.uso, 1)} ${sigla(l.unidade)}` : '—'}</div></div>
              <div><div className="text-zinc-400">Média mensal</div><div className="font-bold">{l.principal.mediaMensal != null ? `${fmtNum(l.principal.mediaMensal, 1)} ${sigla(l.unidade)}` : '—'}</div></div>
              <div><div className="text-zinc-400">Última</div><div className="font-bold">{fmtData(l.ultimaLeitura)}</div></div>
            </div>
          </button>
        ))}
        {!visiveis.length && <p className="p-8 text-center text-sm text-zinc-400">Nenhuma placa encontrada.</p>}
      </div>

      {paginas > 1 && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
          <span>{pagina * POR_PAGINA + 1}–{Math.min(filtradas.length, (pagina + 1) * POR_PAGINA)} de {filtradas.length}</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" aria-label="Página anterior"><ChevronLeft size={14} /></button>
            <span className="tabular-nums">{pagina + 1} / {paginas}</span>
            <button type="button" disabled={pagina >= paginas - 1} onClick={() => setPagina(p => p + 1)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30" aria-label="Próxima página"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}
