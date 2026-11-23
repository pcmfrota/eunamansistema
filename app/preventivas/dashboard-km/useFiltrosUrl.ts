'use client'

import { useCallback, useEffect, useState } from 'react'
import { periodoDoAtalho, type AtalhoPeriodo, type VisaoMedia } from '@/lib/horimetro-km-calc'

export type FiltroFrota = 'todos' | 'pesados' | 'leves'
/** Atalho escolhido, 'rf' (período Suzano atual), 'mes' (seletor de mês/ano) ou 'custom' (datas livres). */
export type ModoPeriodo = AtalhoPeriodo | 'rf' | 'mes' | 'custom'

export type FiltrosDashboard = {
  frota: FiltroFrota
  placas: string[]
  tipos: string[]
  modo: ModoPeriodo
  inicio: string
  fim: string
  visao: VisaoMedia
  /** Dias sem leitura a partir dos quais a placa fica "Atrasada". */
  atraso: number
}

export const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function filtrosPadrao(): FiltrosDashboard {
  const p = periodoDoAtalho('mes-atual', hojeLocal())
  return { frota: 'todos', placas: [], tipos: [], modo: 'mes-atual', inicio: p.inicio, fim: p.fim, visao: 'mensal', atraso: 7 }
}

// Prefixo "dk_" pra não colidir com outros parâmetros da página.
const P = { frota: 'dk_frota', placas: 'dk_placas', tipos: 'dk_tipos', modo: 'dk_periodo', inicio: 'dk_ini', fim: 'dk_fim', visao: 'dk_visao', atraso: 'dk_atraso' } as const
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const MODOS: ModoPeriodo[] = ['mes-atual', 'mes-anterior', 'ultimos-3-meses', 'ano-atual', 'ano-anterior', 'rf', 'mes', 'custom']

function lerDaUrl(): FiltrosDashboard {
  const base = filtrosPadrao()
  if (typeof window === 'undefined') return base
  const sp = new URLSearchParams(window.location.search)
  const lista = (k: string) => (sp.get(k) || '').split(',').map(s => s.trim()).filter(Boolean)
  const frota = sp.get(P.frota)
  const modo = sp.get(P.modo) as ModoPeriodo | null
  const ini = sp.get(P.inicio), fim = sp.get(P.fim)
  const atraso = Number(sp.get(P.atraso))
  const f: FiltrosDashboard = {
    ...base,
    frota: frota === 'pesados' || frota === 'leves' ? frota : 'todos',
    placas: lista(P.placas),
    tipos: lista(P.tipos),
    visao: sp.get(P.visao) === 'anual' ? 'anual' : 'mensal',
    atraso: Number.isFinite(atraso) && atraso > 0 ? Math.round(atraso) : base.atraso,
  }
  if (modo && MODOS.includes(modo)) {
    f.modo = modo
    if (modo !== 'rf' && modo !== 'mes' && modo !== 'custom') Object.assign(f, periodoDoAtalho(modo, hojeLocal()))
  }
  if ((f.modo === 'rf' || f.modo === 'mes' || f.modo === 'custom') && ini && fim && DATA_RE.test(ini) && DATA_RE.test(fim) && ini <= fim) {
    f.inicio = ini; f.fim = fim
  } else if (f.modo === 'rf' || f.modo === 'mes' || f.modo === 'custom') {
    f.modo = 'mes-atual'
  }
  return f
}

function gravarNaUrl(f: FiltrosDashboard) {
  const sp = new URLSearchParams(window.location.search)
  const def = filtrosPadrao()
  const set = (k: string, v: string | null) => { if (v) sp.set(k, v); else sp.delete(k) }
  set(P.frota, f.frota !== 'todos' ? f.frota : null)
  set(P.placas, f.placas.join(',') || null)
  set(P.tipos, f.tipos.join(',') || null)
  set(P.modo, f.modo !== 'mes-atual' ? f.modo : null)
  const datasLivres = f.modo === 'rf' || f.modo === 'mes' || f.modo === 'custom'
  set(P.inicio, datasLivres ? f.inicio : null)
  set(P.fim, datasLivres ? f.fim : null)
  set(P.visao, f.visao !== 'mensal' ? f.visao : null)
  set(P.atraso, f.atraso !== def.atraso ? String(f.atraso) : null)
  const qs = sp.toString()
  window.history.replaceState(window.history.state, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`)
}

/** Filtros do dashboard guardados na URL (sobrevivem ao recarregar e podem ser compartilhados por link). */
export function useFiltrosUrl() {
  const [filtros, setFiltros] = useState<FiltrosDashboard>(filtrosPadrao)
  const [pronto, setPronto] = useState(false)

  useEffect(() => { setFiltros(lerDaUrl()); setPronto(true) }, [])
  useEffect(() => { if (pronto) gravarNaUrl(filtros) }, [filtros, pronto])

  const atualizar = useCallback((parcial: Partial<FiltrosDashboard>) => setFiltros(f => ({ ...f, ...parcial })), [])
  const limpar = useCallback(() => setFiltros(filtrosPadrao()), [])
  return { filtros, atualizar, limpar, pronto }
}
