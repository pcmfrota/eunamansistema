'use client'

import React, { useState } from 'react'
import { ShieldAlert, Send, Clock } from 'lucide-react'
import { solicitarExclusaoBacklog } from './actions'
import { BottomSheet } from '../../ui/primitives/BottomSheet'
import { useToast } from '../../ui/primitives/Toast'

export default function BacklogSolicitarExclusaoModal({
  isOpen,
  items,
  onClose,
  onSubmitted,
}: {
  isOpen: boolean
  items: any[]
  onClose: () => void
  onSubmitted: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const toast = useToast()

  const handleClose = () => {
    setMotivo('')
    setEnviado(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!motivo.trim()) return
    setLoading(true)
    try {
      const res = await solicitarExclusaoBacklog(items.map(i => i.id), motivo)
      if ('error' in res && res.error) {
        toast.show(res.error, "error")
      } else {
        setEnviado(true)
        onSubmitted()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet open={isOpen} onClose={handleClose} title={enviado ? undefined : "Solicitar Exclusão"}>
      {enviado ? (
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-900/40 flex items-center justify-center">
            <Clock size={24} className="text-emerald-500" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-zinc-50">
            Solicitação Enviada
          </h3>
          <p className="text-xs font-bold text-zinc-500 leading-relaxed">
            Em até 24 horas será avaliada pelo administrador.
          </p>
          <button
            onClick={handleClose}
            className="mt-1 w-full px-8 py-3 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase"
            style={{ minHeight: "var(--tap-min)" }}
          >
            Fechar
          </button>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <ShieldAlert size={13} className="text-red-400" />
            {items.length} item{items.length !== 1 ? 's' : ''} selecionado{items.length !== 1 ? 's' : ''}
          </p>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3.5 max-h-32 overflow-y-auto space-y-1.5">
            {items.map(item => (
              <p key={item.id} className="text-xs font-bold text-zinc-300 truncate">
                <span className="text-indigo-400">{item.frota || 'S/ FROTA'}</span> — {item.descricao || 'Sem descrição'}
              </p>
            ))}
          </div>

          <p className="text-xs font-bold text-zinc-500 leading-relaxed">
            A exclusão desse(s) item(ns) precisa ser autorizada pelo administrador. Explique o motivo abaixo.
          </p>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5 ml-1">
              Motivo da solicitação
            </label>
            <textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              rows={4}
              placeholder="Explique por que deseja excluir este item..."
              className="w-full px-3.5 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-zinc-600 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim()}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 active:bg-red-700 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase"
            style={{ minHeight: "var(--tap-min)" }}
          >
            <Send size={14} />
            {loading ? 'Enviando...' : 'Solicitar Exclusão'}
          </button>
        </div>
      )}
    </BottomSheet>
  )
}
