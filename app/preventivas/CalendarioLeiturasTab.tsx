'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCcw, Search } from 'lucide-react'
import { getLeiturasHorimetroKm } from './actions'
import { inferUnidadeHorimetro } from '@/lib/horimetro-log'
import EditarLeituraModal, { type LeituraEditavel, type NovaLeitura } from './EditarLeituraModal'

type PrevLinha = {
  id: string
  equipamentos: { placa: string; tipo: string; categoria: string; modulo: string | null } | null
}

type Leitura = {
  id: string
  placa: string
  unidade: 'h' | 'km'
  valor_anterior: number | null
  valor_novo: number
  km_anterior?: number | null
  km_novo?: number | null
  data_referencia?: string | null
  origem: string
  observacoes: string | null
  atualizado_por_nome: string | null
  atualizado_em: string
}

type Celula = { horimetro: number | null; km: number | null; leitura: Leitura; qtd: number }

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
/** Data da leitura: a informada no modal; nas antigas, o dia (no fuso local) em que foi registrada. */
const diaDaLeitura = (l: Leitura) => l.data_referencia ? String(l.data_referencia).slice(0, 10) : iso(new Date(l.atualizado_em))
const fmt = (v: number) => Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })

/**
 * Calendário de Leituras: placas nas linhas, dias do mês nas colunas; cada célula mostra o
 * horímetro e o KM informados naquela data (a leitura mais recente do dia, se houver mais
 * de uma). Fonte: historico_horimetros (gravado pelo modal "Atualizar Horímetro e KM" e
 * pelas edições anteriores, que só tinham horímetro).
 */
export default function CalendarioLeiturasTab({ preventivas, podeEditar = false }: { preventivas: PrevLinha[]; podeEditar?: boolean }) {
  const [editando, setEditando] = useState<LeituraEditavel[] | null>(null)
  const [novaLeitura, setNovaLeitura] = useState<NovaLeitura | null>(null)
  const [mes, setMes] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [categoria, setCategoria] = useState<'todos' | 'h' | 'km'>('todos')
  const [busca, setBusca] = useState('')
  const [leituras, setLeituras] = useState<Leitura[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const dias = useMemo(() => {
    const n = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()
    return Array.from({ length: n }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), i + 1))
  }, [mes])

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res: any = await getLeiturasHorimetroKm(iso(dias[0]), iso(dias[dias.length - 1]))
      if (res.error) setErro(res.error)
      else setLeituras(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [dias])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => {
    window.addEventListener('horimetro-leitura-registrada', carregar)
    return () => window.removeEventListener('horimetro-leitura-registrada', carregar)
  }, [carregar])

  // placa|dia → leitura mais recente do dia
  const celulas = useMemo(() => {
    const inicio = iso(dias[0]), fim = iso(dias[dias.length - 1])
    const mapa = new Map<string, Celula>()
    const ordenadas = [...leituras].sort((a, b) => a.atualizado_em.localeCompare(b.atualizado_em))
    for (const l of ordenadas) {
      const dia = diaDaLeitura(l)
      if (dia < inicio || dia > fim) continue
      const chave = `${String(l.placa).toUpperCase().trim()}|${dia}`
      const horimetro = l.unidade === 'h' ? Number(l.valor_novo) : null
      const km = l.km_novo != null ? Number(l.km_novo) : l.unidade === 'km' ? Number(l.valor_novo) : null
      const anterior = mapa.get(chave)
      mapa.set(chave, {
        horimetro: horimetro ?? anterior?.horimetro ?? null,
        km: km ?? anterior?.km ?? null,
        leitura: l,
        qtd: (anterior?.qtd || 0) + 1,
      })
    }
    return mapa
  }, [leituras, dias])

  const linhas = useMemo(() => {
    const vistas = new Set<string>()
    const lista: { prevId: string; placa: string; tipo: string; modulo: string | null; unidade: 'h' | 'km' }[] = []
    for (const p of preventivas) {
      const eq = p.equipamentos
      const placa = String(eq?.placa || '').toUpperCase().trim()
      if (!placa || vistas.has(placa)) continue
      vistas.add(placa)
      lista.push({ prevId: p.id, placa, tipo: eq?.tipo || '', modulo: eq?.modulo || null, unidade: inferUnidadeHorimetro(eq?.categoria, eq?.tipo) })
    }
    const q = busca.trim().toUpperCase()
    return lista
      .filter(l => categoria === 'todos' || l.unidade === categoria)
      .filter(l => !q || l.placa.includes(q) || l.tipo.toUpperCase().includes(q))
      .sort((a, b) => a.placa.localeCompare(b.placa))
  }, [preventivas, categoria, busca])

  const resumo = useMemo(() => {
    const placas = new Set(linhas.map(l => l.placa))
    let total = 0
    const atualizadas = new Set<string>()
    celulas.forEach((c, chave) => {
      const placa = chave.split('|')[0]
      if (!placas.has(placa)) return
      total += c.qtd
      atualizadas.add(placa)
    })
    return { total, atualizadas: atualizadas.size, placas: placas.size }
  }, [celulas, linhas])

  const hoje = iso(new Date())

  /** Abre a correção com todas as leituras da placa naquele dia (a última já selecionada). */
  const abrirCorrecao = (placa: string, dia: string) => {
    const doDia = leituras
      .filter(l => String(l.placa).toUpperCase().trim() === placa && diaDaLeitura(l) === dia)
      .sort((a, b) => a.atualizado_em.localeCompare(b.atualizado_em))
      .map(l => ({
        id: l.id, placa, unidade: l.unidade, valor_novo: Number(l.valor_novo),
        km_novo: l.km_novo != null ? Number(l.km_novo) : null,
        valor_anterior: l.valor_anterior != null ? Number(l.valor_anterior) : null,
        km_anterior: l.km_anterior != null ? Number(l.km_anterior) : null,
        data: dia, atualizado_por_nome: l.atualizado_por_nome, observacoes: l.observacoes,
      }))
    if (doDia.length) setEditando(doDia)
  }
  const mudarMes = (delta: number) => setMes(m => new Date(m.getFullYear(), m.getMonth() + delta, 1))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-blue-500" />
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Calendário de Leituras — Horímetro e KM por data</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" title="Mês anterior"><ChevronLeft size={16} /></button>
          <span className="min-w-[150px] text-center font-bold text-sm text-zinc-700 dark:text-zinc-200">{MESES[mes.getMonth()]}/{mes.getFullYear()}</span>
          <button onClick={() => mudarMes(1)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800" title="Próximo mês"><ChevronRight size={16} /></button>
          <button onClick={carregar} disabled={loading} className="p-2 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30" title="Atualizar">
            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
          <input type="text" placeholder="Buscar placa ou tipo..." value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white/50 dark:bg-slate-900/50 text-sm text-text-primary outline-none" />
        </div>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold">
          {([['todos', 'Todos'], ['h', 'Pesados'], ['km', 'Leves']] as const).map(([v, label]) => (
            <button key={v} onClick={() => setCategoria(v)}
              className={`px-3 py-2 ${categoria === v ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>{label}</button>
          ))}
        </div>
        <span className="text-xs text-text-muted">
          {resumo.total} leitura{resumo.total !== 1 ? 's' : ''} no mês · {resumo.atualizadas} de {resumo.placas} placas atualizadas
        </span>
      </div>

      {erro ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 text-sm font-semibold">{erro}</div>
      ) : (
        <div className={`overflow-auto max-h-[70vh] rounded-xl border border-slate-200/60 dark:border-slate-800/50 ${loading ? 'opacity-60' : ''}`}>
          <table className="text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 text-text-muted">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-left uppercase tracking-wider min-w-[150px] border-b border-r border-slate-200 dark:border-slate-800">Placa</th>
                {dias.map(d => {
                  const k = iso(d)
                  const fds = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <th key={k} className={`px-1 py-1 min-w-[68px] text-center border-b border-slate-200 dark:border-slate-800 ${k === hoje ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : fds ? 'bg-slate-100 dark:bg-slate-800/60' : ''}`}>
                      <div className="font-bold">{d.getDate()}</div>
                      <div className="text-[9px] font-medium opacity-70">{DIAS_SEMANA[d.getDay()]}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.placa} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                  <td className="sticky left-0 z-10 bg-white dark:bg-zinc-950 px-3 py-1.5 border-b border-r border-slate-200 dark:border-slate-800 whitespace-nowrap">
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{l.placa}</span>
                    <span className="ml-1 text-[9px] uppercase text-zinc-400">{l.tipo}</span>
                  </td>
                  {dias.map(d => {
                    const k = iso(d)
                    const c = celulas.get(`${l.placa}|${k}`)
                    const titulo = c
                      ? [
                          `${l.placa} — ${k.split('-').reverse().join('/')}`,
                          c.horimetro != null ? `Horímetro: ${fmt(c.horimetro)} h` : null,
                          c.km != null ? `KM: ${fmt(c.km)} km` : null,
                          `Por: ${c.leitura.atualizado_por_nome || 'Sistema'}`,
                          c.qtd > 1 ? `(${c.qtd} atualizações no dia — mostrando a última)` : null,
                          c.leitura.observacoes ? `Obs.: ${c.leitura.observacoes}` : null,
                          podeEditar ? 'Clique para corrigir' : null,
                        ].filter(Boolean).join('\n')
                      : podeEditar ? `${l.placa} — ${k.split('-').reverse().join('/')}\nSem leitura · clique para lançar` : undefined
                    return (
                      <td key={k} title={titulo}
                        onClick={!podeEditar ? undefined : c ? () => abrirCorrecao(l.placa, k)
                          : () => setNovaLeitura({ preventivaId: l.prevId, placa: l.placa, unidade: l.unidade, data: k })}
                        className={`${podeEditar ? 'cursor-pointer hover:ring-2 hover:ring-inset hover:ring-amber-400 ' : ''}px-1 py-1 text-center align-middle border-b border-slate-100 dark:border-slate-800/70 ${k === hoje ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''} ${c ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''}`}>
                        {c && (
                          <div className="flex flex-col leading-tight">
                            {c.horimetro != null && <span className="font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmt(c.horimetro)}h</span>}
                            {c.km != null && <span className="text-[10px] text-blue-700 dark:text-blue-400 whitespace-nowrap">{fmt(c.km)}km</span>}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr><td colSpan={dias.length + 1} className="py-10 text-center text-zinc-400">Nenhuma placa encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5"><span className="font-bold text-emerald-700 dark:text-emerald-400">0000h</span> horímetro</span>
        <span className="flex items-center gap-1.5"><span className="text-blue-700 dark:text-blue-400">0000km</span> KM</span>
        <span>Passe o mouse na célula para ver quem atualizou.{podeEditar ? ' Clique numa célula preenchida para corrigir, ou numa vazia para lançar a leitura daquele dia.' : ''}</span>
      </div>

      {editando && <EditarLeituraModal leituras={editando} onClose={() => setEditando(null)} />}
      {novaLeitura && <EditarLeituraModal key={`${novaLeitura.placa}|${novaLeitura.data}`} leituras={[]} nova={novaLeitura} onClose={() => setNovaLeitura(null)} />}
    </div>
  )
}
