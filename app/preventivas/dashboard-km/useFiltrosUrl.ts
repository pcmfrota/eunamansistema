'use client'

import { useCallback, useEffect, useState } from 'react'
import { periodoDoAtalho, periodoDosMeses, type AtalhoPeriodo, type VisaoMedia, type ModoComparacao } from '@/lib/horimetro-km-calc'

export type FiltroFrota = 'todos' | 'pesados' | 'leves'
/** Atalho, 'rf' (período Suzano), 'mes' (um mês), 'meses' (vários meses escolhidos) ou 'custom' (datas livres). */
export type ModoPeriodo = AtalhoPeriodo | 'rf' | 'mes' | 'meses' | 'custom'

export type FiltrosDashboard = {
  frota: FiltroFrota
  placas: string[]
  tipos: string[]
  modo: ModoPeriodo
  inicio: string
  fim: string
  /** Meses escolhidos (aaaa-mm) quando modo = 'meses'. */
  meses: string[]
  visao: VisaoMedia
  /** Dias sem leitura a partir dos quais a placa fica "Atrasada". */
  atraso: number
  /** Com o que comparar os KPIs (e as datas, quando escolhidas à mão). */
  cmp: ModoComparacao
  cmpIni: string
  cmpFim: string
  /** Visão do período filtrado ou visão anual (todos os meses de um ano). */
  aba: 'periodo' | 'anual'
  ano: number
}

export const hojeLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function filtrosPadrao(): FiltrosDashboard {
  const p = periodoDoAtalho('mes-atual', hojeLocal())
  // Painel sempre abre travado nos PESADOS (dá pra trocar depois, mas ao reabrir volta pra pesados).
  return { frota: 'pesados', placas: [], tipos: [], modo: 'mes-atual', inicio: p.inicio, fim: p.fim, meses: [], visao: 'mensal', atraso: 7, cmp: 'anterior', cmpIni: '', cmpFim: '', aba: 'periodo', ano: +hojeLocal().slice(0, 4) }
}

// Prefixo "dk_" pra não colidir com outros parâmetros da página.
const P = { frota: 'dk_frota', placas: 'dk_placas', tipos: 'dk_tipos', modo: 'dk_periodo', inicio: 'dk_ini', fim: 'dk_fim', meses: 'dk_meses', visao: 'dk_visao', atraso: 'dk_atraso', cmp: 'dk_cmp', cmpIni: 'dk_cmp_ini', cmpFim: 'dk_cmp_fim', aba: 'dk_aba', ano: 'dk_ano' } as const
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/
const MODOS: ModoPeriodo[] = ['mes-atual', 'mes-anterior', 'ultimos-3-meses', 'ano-atual', 'ano-anterior', 'rf', 'mes', 'meses', 'custom']

function lerDaUrl(): FiltrosDashboard {
  const base = filtrosPadrao()
  if (typeof window === 'undefined') return base
  const sp = new URLSearchParams(window.location.search)
  const lista = (k: string) => (sp.get(k) || '').split(',').map(s => s.trim()).filter(Boolean)
  const modo = sp.get(P.modo) as ModoPeriodo | null
  const ini = sp.get(P.inicio), fim = sp.get(P.fim)
  const atraso = Number(sp.get(P.atraso))
  const f: FiltrosDashboard = {
    ...base,
    placas: lista(P.placas),
    tipos: lista(P.tipos),
    visao: sp.get(P.visao) === 'anual' ? 'anual' : 'mensal',
    atraso: Number.isFinite(atraso) && atraso > 0 ? Math.round(atraso) : base.atraso,
  }
  const cmp = sp.get(P.cmp), cIni = sp.get(P.cmpIni) || '', cFim = sp.get(P.cmpFim) || ''
  if (cmp === 'ano-anterior') f.cmp = 'ano-anterior'
  else if (cmp === 'custom' && DATA_RE.test(cIni) && DATA_RE.test(cFim) && cIni <= cFim) { f.cmp = 'custom'; f.cmpIni = cIni; f.cmpFim = cFim }
  if (sp.get(P.aba) === 'anual') f.aba = 'anual'
  const ano = Number(sp.get(P.ano))
  if (Number.isInteger(ano) && ano >= 2000 && ano <= base.ano) f.ano = ano
  if (modo && MODOS.includes(modo)) {
    f.modo = modo
    if (modo !== 'rf' && modo !== 'mes' && modo !== 'meses' && modo !== 'custom') Object.assign(f, periodoDoAtalho(modo, hojeLocal()))
  }
  const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/
  if (f.modo === 'meses') {
    const ms = lista(P.meses).filter(m => MES_RE.test(m))
    if (ms.length) Object.assign(f, { meses: Array.from(new Set(ms)).sort(), ...periodoDosMeses(ms) })
    else f.modo = 'mes-atual'
    return f
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
  sp.delete(P.frota) // a frota não vai pra URL: ao abrir a página é sempre Pesados
  set(P.placas, f.placas.join(',') || null)
  set(P.tipos, f.tipos.join(',') || null)
  set(P.modo, f.modo !== 'mes-atual' ? f.modo : null)
  const datasLivres = f.modo === 'rf' || f.modo === 'mes' || f.modo === 'custom'
  set(P.inicio, datasLivres ? f.inicio : null)
  set(P.fim, datasLivres ? f.fim : null)
  set(P.meses, f.modo === 'meses' ? f.meses.join(',') : null)
  set(P.visao, f.visao !== 'mensal' ? f.visao : null)
  set(P.atraso, f.atraso !== def.atraso ? String(f.atraso) : null)
  set(P.cmp, f.cmp !== 'anterior' ? f.cmp : null)
  set(P.cmpIni, f.cmp === 'custom' ? f.cmpIni : null)
  set(P.cmpFim, f.cmp === 'custom' ? f.cmpFim : null)
  set(P.aba, f.aba !== 'periodo' ? f.aba : null)
  set(P.ano, f.aba === 'anual' && f.ano !== def.ano ? String(f.ano) : null)
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
  // Limpar mantém a visão (período/anual) em que o usuário está.
  const limpar = useCallback(() => setFiltros(f => ({ ...filtrosPadrao(), aba: f.aba, ano: f.ano })), [])
  return { filtros, atualizar, limpar, pronto }
}
