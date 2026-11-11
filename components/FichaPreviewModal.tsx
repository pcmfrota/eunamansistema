'use client'

import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
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
  // Foto/assinatura/logo em que o usuário tocou na ficha — mostrada ampliada por cima de tudo.
  const [imagemAmpliada, setImagemAmpliada] = useState<string | null>(null)

  // useLayoutEffect (não useEffect): mede e aplica a escala ANTES do navegador pintar a
  // tela. Com useEffect, a primeira pintura saía sempre em escala 1 (ficha "no zoom",
  // cortada) e só um instante depois é que a escala certa entrava — dava pra ver os dois
  // tamanhos em sequência. Com useLayoutEffect, quem abre o modal já vê direto no tamanho
  // final, sem esse "pulo".
  useLayoutEffect(() => {
    const medir = () => {
      const wrapper = wrapperRef.current
      const content = contentRef.current
      if (!wrapper || !content) return
      const disponivel = wrapper.clientWidth
      // 0.95 (não a razão exata): arredondamento de sub-pixel do transform:scale deixava o
      // conteúdo escalado alguns px MAIOR que o espaço medido, vazando pra fora do cartão à
      // direita (sem nada cortando, já que nada aqui tinha overflow-x definido) — essa margem
      // de segurança de 5% garante que sempre sobre uma folga, mesmo com esse arredondamento.
      const novaEscala = disponivel > 0 ? Math.min(1, (disponivel / designWidth) * 0.95) : 1
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

  // Delegação de evento: o conteúdo da ficha vem de um HTML cru (dangerouslySetInnerHTML),
  // então um onClick em cada <img> individual não dá — um único listener no container pai,
  // checando o alvo do clique, cobre todas as fotos/assinaturas/logo sem precisar tocar nos
  // geradores de HTML de cada módulo (pdfBoletim.ts, pdfFichaOS.ts, etc.).
  const handleContentClick = (e: MouseEvent<HTMLDivElement>) => {
    const alvo = e.target as HTMLElement
    if (alvo.tagName === 'IMG') {
      setImagemAmpliada((alvo as HTMLImageElement).src)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 w-full min-w-0 max-w-3xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col my-4 max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden animate-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <h2 className="text-sm font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-300">Pré-visualização da Ficha</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        <div
          ref={wrapperRef}
          className="p-4 overflow-y-auto overflow-x-hidden custom-scrollbar flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-900 flex justify-center"
        >
          {/* flex justify-center (não mx-auto): centraliza pelo espaço real do wrapper em vez
              de depender dos dois lados (pai/filho) concordarem em px exatos — com mx-auto,
              qualquer diferença mínima entre a largura calculada e a renderizada de fato
              (sub-pixel, scrollbar, etc.) deixava a ficha visivelmente puxada pra um lado.
              shrink-0: impede o próprio flex de encolher essa largura já calculada. */}
          <div className="shrink-0" style={{ width: designWidth * scale, height: scaledHeight }}>
            <div
              ref={contentRef}
              onClick={handleContentClick}
              className="ficha-preview-content bg-white shadow-md origin-top-left"
              style={{ width: designWidth, transform: `scale(${scale})` }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>
        <style>{'.ficha-preview-content img { cursor: zoom-in; }'}</style>

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

      {/* Imagem ampliada — fica por cima do próprio modal (z maior), fecha tocando em qualquer
          lugar ou no X. Mesma foto/assinatura/logo que veio da ficha, só maior pra conferir. */}
      {imagemAmpliada && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 animate-in fade-in duration-150"
          onClick={() => setImagemAmpliada(null)}
        >
          <button
            onClick={() => setImagemAmpliada(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X size={24} />
          </button>
          <img
            src={imagemAmpliada}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}
