'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { History, Search, RefreshCcw, User, Clock, Database, X, Eye, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getHistoricoExclusoes } from './actions'
import { PremiumLoader } from '@/components/premium-loader'

function OrigemTag({ origem }: { origem: string }) {
  const isAprovado = origem === 'SOLICITACAO_APROVADA'
  return (
    <span className={cn(
      "px-2.5 py-1 rounded border text-[8px] font-black uppercase tracking-widest shadow-sm whitespace-nowrap",
      isAprovado
        ? "bg-[#dcfce7] text-[#16a34a] dark:bg-emerald-950/40 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-900/50"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
    )}>
      {isAprovado ? 'Solicitação Aprovada' : 'Exclusão Direta'}
    </span>
  )
}

export default function HistoricoExclusoesClient() {
  const [registros, setRegistros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterModulo, setFilterModulo] = useState('')
  const [verSnapshot, setVerSnapshot] = useState<any | null>(null)

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res: any = await getHistoricoExclusoes(1000)
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

  const modulosUnicos = useMemo(
    () => Array.from(new Set(registros.map(r => r.modulo))).filter(Boolean).sort(),
    [registros]
  )

  const filtrados = useMemo(() => {
    const q = search.toLowerCase().trim()
    return registros.filter(r => {
      const matchModulo = !filterModulo || r.modulo === filterModulo
      const matchBusca = !q ||
        r.descricao?.toLowerCase().includes(q) ||
        r.excluido_por_nome?.toLowerCase().includes(q) ||
        r.modulo?.toLowerCase().includes(q)
      return matchModulo && matchBusca
    })
  }, [registros, search, filterModulo])

  if (errorMsg) {
    return (
      <div className="p-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-red-200 dark:border-red-900/40 gap-3">
          <ShieldAlert size={40} className="text-red-400" />
          <p className="text-red-500 font-bold text-sm">{errorMsg}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 md:p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg">
            <History size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">Histórico de Exclusões</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold mt-0.5">Registro de tudo que foi excluído no sistema</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-indigo-600 hover:border-indigo-500/30 transition-all shadow-sm self-start md:self-auto"
        >
          <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por descrição ou quem excluiu..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
        <select
          value={filterModulo}
          onChange={e => setFilterModulo(e.target.value)}
          className="px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer"
        >
          <option value="">Todos os Módulos</option>
          {modulosUnicos.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] py-16 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <PremiumLoader type="squares-sequential" text="Carregando histórico" subtext="Buscando registros de exclusão..." />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <Database size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
          <p className="text-zinc-500 font-bold">Nenhuma exclusão registrada</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Quando</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Módulo</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Descrição</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Excluído Por</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Origem</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {filtrados.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-all">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <Clock size={13} className="text-zinc-400" />
                        {new Date(r.excluido_em).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                        {r.modulo}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 line-clamp-2">{r.descricao || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <User size={13} className="text-zinc-400" />
                        {r.excluido_por_nome || 'Sistema'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <OrigemTag origem={r.origem} />
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setVerSnapshot(r)}
                        className="p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-zinc-400 hover:text-indigo-600 rounded-xl transition-all"
                        title="Ver dados completos"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-900 text-xs text-zinc-400 font-bold">
            {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Modal de snapshot completo */}
      {verSnapshot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl max-h-[85vh] rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-900">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-50">{verSnapshot.modulo}</h3>
                <p className="text-xs font-bold text-zinc-400">{verSnapshot.descricao || 'Sem descrição'}</p>
              </div>
              <button onClick={() => setVerSnapshot(null)} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="font-black text-zinc-400 uppercase tracking-widest block mb-1">Tabela</span>{verSnapshot.tabela_origem}</div>
                <div><span className="font-black text-zinc-400 uppercase tracking-widest block mb-1">Id do Registro</span>{verSnapshot.registro_id || '—'}</div>
                <div><span className="font-black text-zinc-400 uppercase tracking-widest block mb-1">Excluído Por</span>{verSnapshot.excluido_por_nome || 'Sistema'}</div>
                <div><span className="font-black text-zinc-400 uppercase tracking-widest block mb-1">Quando</span>{new Date(verSnapshot.excluido_em).toLocaleString('pt-BR')}</div>
              </div>
              <div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Dados do Registro Excluído</span>
                <pre className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-[11px] font-mono text-zinc-600 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {verSnapshot.dados ? JSON.stringify(verSnapshot.dados, null, 2) : 'Sem snapshot disponível'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
