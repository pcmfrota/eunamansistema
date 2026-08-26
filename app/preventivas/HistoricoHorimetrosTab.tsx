'use client'

import { useEffect, useMemo, useState } from 'react'
import { History, Search, RefreshCcw, User, Clock, Database, ArrowRight } from 'lucide-react'
import { getHistoricoHorimetros } from './actions'
import { PremiumLoader } from '@/components/premium-loader'

type HistoricoItem = {
  id: string
  equipamento_id: string | null
  placa: string
  tipo: string | null
  categoria: string | null
  unidade: 'h' | 'km'
  valor_anterior: number | null
  valor_novo: number
  origem: 'NOVO_APONTAMENTO' | 'EDICAO_MANUAL'
  observacoes: string | null
  atualizado_por_nome: string | null
  atualizado_em: string
}

function OrigemTag({ origem }: { origem: string }) {
  const isApontamento = origem === 'NOVO_APONTAMENTO'
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase whitespace-nowrap ${
      isApontamento
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
    }`}>
      {isApontamento ? 'Novo Apontamento' : 'Edição na Tabela'}
    </span>
  )
}

export default function HistoricoHorimetrosTab() {
  const [registros, setRegistros] = useState<HistoricoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [origemFilter, setOrigemFilter] = useState('')

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res: any = await getHistoricoHorimetros(1000)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setRegistros(res.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    return registros.filter(r => {
      const matchOrigem = !origemFilter || r.origem === origemFilter
      const matchBusca = !q ||
        r.placa?.toLowerCase().includes(q) ||
        r.atualizado_por_nome?.toLowerCase().includes(q) ||
        r.tipo?.toLowerCase().includes(q)
      return matchOrigem && matchBusca
    })
  }, [registros, search, origemFilter])

  if (errorMsg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 glass-card rounded-xl border border-dashed border-red-200 dark:border-red-900/40 gap-3">
        <Database size={36} className="text-red-400" />
        <p className="text-red-500 font-bold text-sm">{errorMsg}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 justify-between flex-wrap">
        <div className="flex items-center gap-2">
          <History size={16} className="text-blue-500" />
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-300">Histórico de Atualizações — Horímetro e KM</h3>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
          title="Atualizar"
        >
          <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
          <input type="text" placeholder="Buscar placa ou usuário..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white/50 dark:bg-slate-900/50 text-sm text-text-primary outline-none hover:border-slate-300 dark:hover:border-slate-600 transition-colors" />
        </div>
        <select value={origemFilter} onChange={e => setOrigemFilter(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white/50 dark:bg-slate-900/50 text-sm text-text-secondary outline-none hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
          <option value="">Todas as Origens</option>
          <option value="NOVO_APONTAMENTO">Novo Apontamento</option>
          <option value="EDICAO_MANUAL">Edição na Tabela</option>
        </select>
        <span className="text-xs text-text-muted">{filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] glass-card rounded-xl">
          <PremiumLoader type="squares-sequential" text="Carregando histórico" subtext="Buscando atualizações de horímetro/km..." />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 glass-card rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
          <Database size={40} className="text-zinc-200 dark:text-zinc-800 mb-3" />
          <p className="text-zinc-500 font-semibold text-sm">Nenhuma atualização registrada</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-slate-800/50">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/50 dark:bg-slate-900/30 text-text-muted text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left">Quando</th>
                <th className="px-4 py-3 text-left">Placa</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Anterior → Novo</th>
                <th className="px-4 py-3 text-left">Origem</th>
                <th className="px-4 py-3 text-left">Atualizado Por</th>
                <th className="px-4 py-3 text-left">Observações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filtrados.map(r => (
                <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-4 py-3 text-xs text-zinc-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-zinc-400" />
                      {new Date(r.atualizado_em).toLocaleString('pt-BR')}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400">{r.placa}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{r.tipo || '-'}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-400">{r.valor_anterior ?? '-'}{r.unidade}</span>
                      <ArrowRight size={11} className="text-zinc-300" />
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{r.valor_novo}{r.unidade}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><OrigemTag origem={r.origem} /></td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <User size={12} className="text-zinc-400" />
                      {r.atualizado_por_nome || 'Sistema'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-xs truncate">{r.observacoes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
