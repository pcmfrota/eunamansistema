'use client'

import { X, FileDown, Share2 } from 'lucide-react'

interface FichaPreviewModalProps {
  html: string
  onClose: () => void
  onDownload: () => void
  // Opcional: quando informado, mostra um botão "Compartilhar" que gera o mesmo PDF e abre
  // o menu de compartilhamento do sistema (WhatsApp etc.) com o arquivo já anexado.
  onShare?: () => void
}

// Mostra o mesmo HTML usado na geração de uma ficha em PDF (pdfBoletim.ts, pdfFicha.ts, etc.),
// dentro de um modal com fundo branco simulando a página — pra conferir antes de baixar.
// Compartilhado entre módulos (Pneus, Lavagens, ...) que geram fichas em PDF.
export default function FichaPreviewModal({ html, onClose, onDownload, onShare }: FichaPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-3xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col my-4 max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] animate-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">Pré-visualização da Ficha</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1 bg-zinc-100 dark:bg-zinc-900">
          <div className="bg-white shadow-md mx-auto" style={{ maxWidth: '210mm' }} dangerouslySetInnerHTML={{ __html: html }} />
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-all"
          >
            Fechar
          </button>
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-xl transition-all"
            >
              <Share2 size={18} />
              Compartilhar
            </button>
          )}
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all"
          >
            <FileDown size={18} />
            Baixar PDF
          </button>
        </div>
      </div>
    </div>
  )
}
