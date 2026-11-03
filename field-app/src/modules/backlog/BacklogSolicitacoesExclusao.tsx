'use client'

import React, { useState } from 'react'
import { Clock, Check, X as XIcon, User, MessageSquare, Inbox, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { responderSolicitacaoExclusao } from './actions'
import { Card } from '../../ui/primitives/ListRow'
import { EmptyState } from '../../ui/primitives/EmptyState'
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog'
import { useToast } from '../../ui/primitives/Toast'

function CritTag({ crit }: { crit?: string | null }) {
  const c = String(crit || 'B').toUpperCase().trim() === 'A' ? 'A' : 'B'
  return (
    <span className={cn(
      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
      c === 'A' ? "bg-red-500/15 text-red-400" : "bg-blue-500/15 text-blue-400"
    )}>
      {c}
    </span>
  )
}

function StatusTag({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDENTE: 'bg-amber-500/15 text-amber-400',
    APROVADO: 'bg-emerald-500/15 text-emerald-400',
    REJEITADO: 'bg-red-500/15 text-red-400',
  }
  return (
    <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", styles[status] || styles.PENDENTE)}>
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
  const [pendingConfirm, setPendingConfirm] = useState<{ id: string; aprovado: boolean } | null>(null)
  const toast = useToast()

  const pendentes = requests.filter(r => r.status === 'PENDENTE')
  const respondidas = requests.filter(r => r.status !== 'PENDENTE')

  const handleResponder = async (id: string, aprovado: boolean) => {
    setRespondingId(id)
    try {
      const res = await responderSolicitacaoExclusao(id, aprovado)
      if (res && 'error' in res && res.error) {
        toast.show(res.error, "error")
      } else {
        toast.show(aprovado ? "Exclusão aprovada." : "Solicitação rejeitada.", "success")
        onRefresh()
      }
    } finally {
      setRespondingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={28} className="text-indigo-500 animate-spin mb-3" />
        <p className="text-zinc-400 font-bold text-sm">Carregando solicitações...</p>
      </div>
    )
  }

  if (requests.length === 0) {
    return <EmptyState icon={Inbox} title="Nenhuma solicitação de exclusão" description="Tudo tranquilo por aqui" />
  }

  const renderCard = (req: any) => (
    <Card key={req.id} className="p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CritTag crit={req.backlog_criticidade} />
          <div>
            <p className="text-sm font-black text-zinc-50">{req.backlog_frota || 'S/ FROTA'}</p>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{req.backlog_modulo || 'N/A'}</p>
          </div>
        </div>
        <StatusTag status={req.status} />
      </div>

      <div>
        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Descrição do Item</p>
        <p className="text-xs font-bold text-zinc-300">{req.backlog_descricao || 'Item removido / sem descrição'}</p>
      </div>

      <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl p-3 flex gap-2.5">
        <MessageSquare size={14} className="text-indigo-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Motivo da Solicitação</p>
          <p className="text-xs font-bold text-zinc-300 leading-relaxed">{req.motivo}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-zinc-800">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
          <User size={12} />
          {req.solicitado_por_nome || 'Usuário'}
          <span className="mx-0.5 text-zinc-700">•</span>
          <Clock size={12} />
          {new Date(req.solicitado_em).toLocaleString('pt-BR')}
        </div>

        {req.status === 'PENDENTE' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPendingConfirm({ id: req.id, aprovado: false })}
              disabled={respondingId === req.id}
              className="flex items-center gap-1.5 px-3 text-[10px] font-black uppercase text-zinc-400 active:text-red-400 border border-zinc-800 rounded-xl disabled:opacity-40"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <XIcon size={13} /> Rejeitar
            </button>
            <button
              onClick={() => setPendingConfirm({ id: req.id, aprovado: true })}
              disabled={respondingId === req.id}
              className="flex items-center gap-1.5 px-3 bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase disabled:opacity-40"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <Check size={13} /> Aprovar
            </button>
          </div>
        )}
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
          Pendentes
          {pendentes.length > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[9px]">{pendentes.length}</span>
          )}
        </h3>
        {pendentes.length === 0 ? (
          <p className="text-xs font-bold text-zinc-500 py-2">Nenhuma solicitação pendente no momento.</p>
        ) : (
          <div className="space-y-2">{pendentes.map(renderCard)}</div>
        )}
      </div>

      {respondidas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Histórico</h3>
          <div className="space-y-2 opacity-80">{respondidas.map(renderCard)}</div>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { if (pendingConfirm) handleResponder(pendingConfirm.id, pendingConfirm.aprovado) }}
        title={pendingConfirm?.aprovado ? "Aprovar exclusão deste item?" : "Rejeitar esta solicitação?"}
        confirmLabel={pendingConfirm?.aprovado ? "Aprovar" : "Rejeitar"}
        destructive={!pendingConfirm?.aprovado}
      />
    </div>
  )
}
