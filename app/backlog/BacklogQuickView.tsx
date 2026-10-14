'use client'

import { useState } from 'react'
import { X, Clock, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mesma regra de "dias em aberto" já usada no dashboard (BacklogDashboard.tsx): conta de
// data_evidencia (quando foi lançado) até data_conclusao (se já encerrado) ou até hoje.
function calcularDias(item: any): { dias: number; encerrado: boolean } | null {
  if (!item?.data_evidencia) return null
  const statusLower = String(item.status || '').toLowerCase()
  const encerrado = ['encerrado', 'encerrada', 'concluido', 'concluído', 'concluida', 'concluída'].includes(statusLower)
  const start = new Date(item.data_evidencia.split('T')[0])
  const end = encerrado && item.data_conclusao ? new Date(item.data_conclusao.split('T')[0]) : new Date()
  const diff = end.getTime() - start.getTime()
  const dias = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  return { dias, encerrado }
}

export default function BacklogQuickView({
  item,
  onClose,
  onEdit,
}: {
  item: any | null
  onClose: () => void
  onEdit: (item: any) => void
}) {
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null)

  if (!item) return null

  // Prioriza as novas fotos manuais (até 2); cai pro campo legado singular usado pelo
  // fluxo de importação via WhatsApp/IA quando não há nenhuma foto manual.
  const fotos: string[] =
    item.evidencia_imagens && item.evidencia_imagens.length > 0
      ? item.evidencia_imagens
      : item.evidencia_imagem
        ? [item.evidencia_imagem]
        : []
  const fotosConclusao: string[] = item.evidencia_imagens_conclusao || []

  const aging = calcularDias(item)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-900 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{item.modulo || 'N/A'}</p>
            <h2 className="text-lg font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{item.frota}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {aging && (
            <div
              className={cn(
                'flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-black',
                aging.encerrado
                  ? 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  : aging.dias > 30
                    ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400'
                    : aging.dias > 15
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400'
                      : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400'
              )}
            >
              <Clock size={16} className="shrink-0" />
              {aging.encerrado
                ? `Ficou ${aging.dias} dia${aging.dias !== 1 ? 's' : ''} em aberto (encerrado)`
                : `${aging.dias} dia${aging.dias !== 1 ? 's' : ''} pendente desde o lançamento`}
            </div>
          )}

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Descrição da Atividade</p>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
              {item.descricao || '—'}
            </p>
          </div>

          {fotos.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Evidência</p>
              <div className={cn('grid gap-2', fotos.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {fotos.map((foto, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFotoExpandida(foto)}
                    className="block aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black cursor-zoom-in"
                    title="Clique para ampliar"
                  >
                    <img src={foto} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {fotosConclusao.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5">Evidência Após Conclusão</p>
              <div className={cn('grid gap-2', fotosConclusao.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
                {fotosConclusao.map((foto, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setFotoExpandida(foto)}
                    className="block aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black cursor-zoom-in"
                    title="Clique para ampliar"
                  >
                    <img src={foto} alt={`Evidência conclusão ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-zinc-100 dark:border-zinc-900 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={() => onEdit(item)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-sm"
          >
            <Edit3 size={14} /> Editar
          </button>
        </div>
      </div>

      {fotoExpandida && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-sm"
          onClick={() => setFotoExpandida(null)}
        >
          <button
            type="button"
            onClick={() => setFotoExpandida(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={22} />
          </button>
          <img src={fotoExpandida} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
