'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, Search, RefreshCcw, Clock, Globe, Monitor, Database } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTentativasAcesso } from './actions'
import { PremiumLoader } from '@/components/premium-loader'

type Tentativa = {
  id: string
  email: string
  sucesso: boolean
  motivo: string | null
  ip: string | null
  user_agent: string | null
  created_at: string
}

export default function TentativasAcessoClient() {
  const [tentativas, setTentativas] = useState<Tentativa[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'Todos' | 'Sucesso' | 'Falha'>('Todos')

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const res: any = await getTentativasAcesso(500)
      if (res.error) {
        setErrorMsg(res.error)
      } else {
        setTentativas(res.data || [])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtradas = useMemo(() => {
    const q = search.toLowerCase().trim()
    return tentativas.filter(t => {
      const matchStatus = filterStatus === 'Todos' || (filterStatus === 'Sucesso' ? t.sucesso : !t.sucesso)
      const matchBusca = !q || t.email?.toLowerCase().includes(q) || t.ip?.toLowerCase().includes(q)
      return matchStatus && matchBusca
    })
  }, [tentativas, search, filterStatus])

  const resumo = useMemo(() => ({
    total: tentativas.length,
    sucesso: tentativas.filter(t => t.sucesso).length,
    falha: tentativas.filter(t => !t.sucesso).length,
  }), [tentativas])

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
          <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">Tentativas de Acesso</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold mt-0.5">Registro de todo login tentado no sistema (sucesso e falha)</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-red-600 hover:border-red-500/30 transition-all shadow-sm self-start md:self-auto"
        >
          <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Total Carregado</p>
          <p className="text-xl font-black text-zinc-900 dark:text-zinc-50">{resumo.total}</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Sucesso</p>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{resumo.sucesso}</p>
        </div>
        <div className="bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-red-200 dark:border-red-900/50 shadow-sm">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1">Falha</p>
          <p className="text-xl font-black text-red-600 dark:text-red-400">{resumo.falha}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Buscar por e-mail ou IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value as any)}
          className="px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest outline-none cursor-pointer"
        >
          <option value="Todos">Todos os Status</option>
          <option value="Sucesso">Só Sucesso</option>
          <option value="Falha">Só Falha</option>
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] py-16 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <PremiumLoader type="squares-sequential" text="Carregando tentativas" subtext="Buscando registros de acesso..." />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
          <Database size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
          <p className="text-zinc-500 font-bold">Nenhuma tentativa de acesso registrada</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Quando</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">E-mail</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 text-center">Status</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Motivo</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">IP</th>
                  <th className="px-4 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400">Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {filtradas.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-all">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                        <Clock size={13} className="text-zinc-400" />
                        {new Date(t.created_at).toLocaleString('pt-BR')}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{t.email}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest border whitespace-nowrap",
                        t.sucesso
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-900/30"
                          : "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-900/30"
                      )}>
                        {t.sucesso ? <ShieldCheck size={11} /> : <ShieldAlert size={11} />}
                        {t.sucesso ? 'SUCESSO' : 'FALHA'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 line-clamp-2">{t.motivo || '—'}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        <Globe size={12} className="text-zinc-400" />
                        {t.ip || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 max-w-[220px]">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 truncate" title={t.user_agent || ''}>
                        <Monitor size={12} className="text-zinc-400 shrink-0" />
                        <span className="truncate">{t.user_agent || '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-900 text-xs text-zinc-400 font-bold">
            {filtradas.length} registro{filtradas.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}
