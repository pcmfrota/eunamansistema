'use client'

import { useEffect, useRef, useState } from 'react'
import { X, FileDown, Share2 } from 'lucide-react'

interface FichaPreviewModalProps {
  html: string
  onClose: () => void
  onDownload: () => void
  // Opcional: quando informado, mostra um botão "Compartilhar" que gera o mesmo PDF e abre
  // o menu de compartilhamento do sistema (WhatsApp etc.) com o arquivo já anexado.
  onShare?: () => void
  // Largura (em px) que o HTML foi desenhado pra ter — mesma largura do container invisível
  // usado por quem gera o PDF (pdfBoletim.ts, pdfFichaOS.ts, etc: sempre 800). Usada só pra
  // encolher a pré-visualização até caber na tela (celular/tablet) sem cortar nada nas bordas
  // nem precisar de scroll lateral — o PDF de verdade sempre sai no tamanho cheio.
  designWidth?: number
}

// Mostra o mesmo HTML usado na geração de uma ficha em PDF (pdfBoletim.ts, pdfFicha.ts, etc.),
// dentro de um modal com fundo branco simulando a página — pra conferir antes de baixar.
// Compartilhado entre módulos (Pneus, Lavagens, OS, ...) que geram fichas em PDF.
export default function FichaPreviewModal({ html, onClose, onDownload, onShare, designWidth = 800 }: FichaPreviewModalProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined)

  useEffect(() => {
    const medir = () => {
      const wrapper = wrapperRef.current
      const content = contentRef.current
      if (!wrapper || !content) return
      const disponivel = wrapper.clientWidth
      const novaEscala = disponivel > 0 ? Math.min(1, disponivel / designWidth) : 1
      setScale(novaEscala)
      setScaledHeight(content.scrollHeight * novaEscala)
    }

    medir()
    const ro = new ResizeObserver(medir)
    if (wrapperRef.current) ro.observe(wrapperRef.current)

    // Fotos/assinaturas (base64) mudam a altura real só depois de carregar — remedir quando
    // cada <img> terminar, e também com um fallback por tempo pra pegar o que passar batido.
    const imgs = contentRef.current?.querySelectorAll('img') ?? []
    imgs.forEach((img) => img.addEventListener('load', medir))
    const t = setTimeout(medir, 400)

    return () => {
      ro.disconnect()
      imgs.forEach((img) => img.removeEventListener('load', medir))
      clearTimeout(t)
    }
  }, [html, designWidth])

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 w-full min-w-0 max-w-3xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col my-4 max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] animate-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">Pré-visualização da Ficha</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        <div ref={wrapperRef} className="p-4 overflow-y-auto custom-scrollbar flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900">
          {/* Wrapper com a altura já encolhida — sem isso, o scale no filho (que não muda o
              espaço reservado no layout) deixaria uma folga em branco do tamanho original. */}
          <div className="mx-auto" style={{ width: designWidth * scale, height: scaledHeight }}>
            <div
              ref={contentRef}
              className="bg-white shadow-md origin-top-left"
              style={{ width: designWidth, transform: `scale(${scale})` }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
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
