'use client'

import React, { useState } from 'react'
import { X, ShieldAlert, Send, Clock } from 'lucide-react'
import { solicitarExclusaoBacklog } from './actions'

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

  if (!isOpen) return null

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
        alert(res.error)
      } else {
        setEnviado(true)
        onSubmitted()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {enviado ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Clock size={26} className="text-emerald-500" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-50">
              Solicitação de Exclusão Solicitada
            </h3>
            <p className="text-xs font-bold text-zinc-500 leading-relaxed">
              Em até 24 horas será aceita pelo administrador.
            </p>
            <button
              onClick={handleClose}
              className="mt-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <ShieldAlert size={18} className="text-red-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-zinc-900 dark:text-zinc-50">
                    Solicitar Exclusão
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {items.length} item{items.length !== 1 ? 's' : ''} selecionado{items.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 max-h-32 overflow-y-auto space-y-1.5">
                {items.map(item => (
                  <p key={item.id} className="text-xs font-bold text-zinc-600 dark:text-zinc-300 truncate">
                    <span className="text-indigo-500">{item.frota || 'S/ FROTA'}</span> — {item.descricao || 'Sem descrição'}
                  </p>
                ))}
              </div>

              <p className="text-xs font-bold text-zinc-500 leading-relaxed">
                A exclusão desse(s) item(ns) precisa ser autorizada pelo administrador.
                Explique o motivo da solicitação abaixo.
              </p>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">
                  Motivo da solicitação
                </label>
                <textarea
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  rows={4}
                  placeholder="Explique por que deseja excluir este item..."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-5 border-t border-zinc-100 dark:border-zinc-900">
              <button
                onClick={handleClose}
                className="px-6 py-3 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              >
                Fechar o Modal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !motivo.trim()}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
              >
                <Send size={14} />
                {loading ? 'Enviando...' : 'Solicitar Exclusão'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
