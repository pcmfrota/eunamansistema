'use client'

import React, { useState } from 'react'
import { Clock, Check, X as XIcon, User, MessageSquare, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { responderSolicitacaoExclusao } from './actions'

function CritTag({ crit }: { crit?: string | null }) {
  const c = String(crit || 'B').toUpperCase().trim() === 'A' ? 'A' : 'B'
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border shadow-sm",
      c === 'A'
        ? "bg-[#fde8e8] text-[#e74c3c] dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/50"
        : "bg-[#ebf5fb] text-[#2563eb] dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/50"
    )}>
      {c}
    </span>
  )
}

function StatusTag({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDENTE: 'bg-[#fef9c3] text-[#ca8a04] dark:bg-yellow-950/40 dark:text-yellow-400 border-[#fef08a] dark:border-yellow-900/50',
    APROVADO: 'bg-[#dcfce7] text-[#16a34a] dark:bg-emerald-950/40 dark:text-emerald-400 border-[#bbf7d0] dark:border-emerald-900/50',
    REJEITADO: 'bg-[#fde8e8] text-[#e74c3c] dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/50',
  }
  return (
    <span className={cn("px-2.5 py-1 rounded border text-[8px] font-black uppercase tracking-widest shadow-sm", styles[status] || styles.PENDENTE)}>
      {status}
    </span>
  )
}

export default function BacklogSolicitacoesExclusao({
  requests,
  loading,
  onRefresh,
}: {
  requests: any[]
  loading: boolean
  onRefresh: () => void
}) {
  const [respondingId, setRespondingId] = useState<string | null>(null)

  const pendentes = requests.filter(r => r.status === 'PENDENTE')
  const respondidas = requests.filter(r => r.status !== 'PENDENTE')

  const handleResponder = async (id: string, aprovado: boolean) => {
    const label = aprovado ? 'aprovar a exclusão' : 'rejeitar a solicitação'
    if (!confirm(`Confirma ${label} deste item do backlog?`)) return
    setRespondingId(id)
    try {
      const res = await responderSolicitacaoExclusao(id, aprovado)
      if (res && 'error' in res && res.error) {
        alert(res.error)
      } else {
        onRefresh()
      }
    } finally {
      setRespondingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800">
        <Loader2 size={32} className="text-indigo-500 animate-spin mb-3" />
        <p className="text-zinc-500 font-bold text-sm">Carregando solicitações...</p>
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
        <Inbox size={48} className="text-zinc-200 dark:text-zinc-800 mb-4" />
        <p className="text-zinc-500 font-bold">Nenhuma solicitação de exclusão</p>
        <p className="text-[10px] text-zinc-400 uppercase tracking-widest mt-1">Tudo tranquilo por aqui</p>
      </div>
    )
  }

  const renderCard = (req: any) => (
    <div
      key={req.id}
      className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <CritTag crit={req.backlog_criticidade} />
          <div>
            <p className="text-sm font-black text-zinc-900 dark:text-zinc-50">{req.backlog_frota || 'S/ FROTA'}</p>
            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{req.backlog_modulo || 'N/A'}</p>
          </div>
        </div>
        <StatusTag status={req.status} />
      </div>

      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Descrição do Item</p>
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{req.backlog_descricao || 'Item removido / sem descrição'}</p>
      </div>

      <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3.5 flex gap-2.5">
        <MessageSquare size={15} className="text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">Motivo da Solicitação</p>
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-300 leading-relaxed">{req.motivo}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-zinc-100 dark:border-zinc-900">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
          <User size={13} className="text-zinc-400" />
          {req.solicitado_por_nome || 'Usuário'}
          <span className="mx-1 text-zinc-300">•</span>
          <Clock size={13} className="text-zinc-400" />
          {new Date(req.solicitado_em).toLocaleString('pt-BR')}
        </div>

        {req.status === 'PENDENTE' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleResponder(req.id, false)}
              disabled={respondingId === req.id}
              className="flex items-center gap-1.5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-600 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 transition-all disabled:opacity-40"
            >
              <XIcon size={13} /> Rejeitar
            </button>
            <button
              onClick={() => handleResponder(req.id, true)}
              disabled={respondingId === req.id}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm transition-all disabled:opacity-40 active:scale-95"
            >
              <Check size={13} /> Aprovar Exclusão
            </button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3 flex items-center gap-2">
          Pendentes
          {pendentes.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[9px]">{pendentes.length}</span>
          )}
        </h3>
        {pendentes.length === 0 ? (
          <p className="text-xs font-bold text-zinc-400 py-4">Nenhuma solicitação pendente no momento.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {pendentes.map(renderCard)}
          </div>
        )}
      </div>

      {respondidas.length > 0 && (
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-3">Histórico</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-80">
            {respondidas.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  )
}
