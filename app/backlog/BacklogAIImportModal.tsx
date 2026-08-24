'use client'

import React, { useState, useRef } from 'react'
import { X, Sparkles, ImagePlus, AlertCircle, CheckCircle2, Trash2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { extrairPendenciasBacklogIA, lancarBacklogsExtraidos, type ItemBacklogExtraido } from './actions'

type ItemRevisao = ItemBacklogExtraido & { incluir: boolean }

const MAX_DIM = 800

function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      const img = new Image()
      img.onload = () => {
        try {
          let { width, height } = img
          if (width > height) {
            if (width > MAX_DIM) { height = height * (MAX_DIM / width); width = MAX_DIM }
          } else if (height > MAX_DIM) {
            width = width * (MAX_DIM / height); height = MAX_DIM
          }
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(dataUrl); return }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.6))
        } catch {
          resolve(dataUrl)
        }
      }
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
      img.src = dataUrl
    }
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

export default function BacklogAIImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [imagemBase64, setImagemBase64] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [itens, setItens] = useState<ItemRevisao[] | null>(null)
  const [placasDisponiveis, setPlacasDisponiveis] = useState<string[]>([])
  const [lancando, setLancando] = useState(false)
  const [sucesso, setSucesso] = useState<{ count: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const resetTudo = () => {
    setImagemBase64(null); setTexto(''); setErro(null); setItens(null); setSucesso(null); setPlacasDisponiveis([])
  }

  const handleClose = () => { resetTudo(); onClose() }

  const handleFile = async (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    try {
      const comprimida = await comprimirImagem(file)
      setImagemBase64(comprimida)
      setErro(null)
    } catch {
      setErro('Não foi possível processar a imagem colada.')
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))
    if (item) {
      e.preventDefault()
      handleFile(item.getAsFile())
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    handleFile(e.dataTransfer.files?.[0])
  }

  const handleAnalisar = async () => {
    setErro(null)
    setAnalisando(true)
    try {
      const res: any = await extrairPendenciasBacklogIA(imagemBase64, texto)
      if (res?.error) { setErro(res.error); return }
      setPlacasDisponiveis(res.placasDisponiveis || [])
      setItens((res.itens || []).map((i: ItemBacklogExtraido) => ({ ...i, incluir: !!i.placa })))
    } finally {
      setAnalisando(false)
    }
  }

  const atualizarItem = (idx: number, patch: Partial<ItemRevisao>) => {
    setItens(prev => prev ? prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)) : prev)
  }

  const removerItem = (idx: number) => {
    setItens(prev => (prev ? prev.filter((_, i) => i !== idx) : prev))
  }

  const itensMarcados = (itens || []).filter(i => i.incluir)

  const handleLancar = async () => {
    if (itensMarcados.length === 0) return
    setLancando(true)
    setErro(null)
    try {
      const res: any = await lancarBacklogsExtraidos(itensMarcados, imagemBase64)
      if (res?.error) { setErro(res.error); return }
      setSucesso({ count: res.count })
      setTimeout(handleClose, 2000)
    } finally {
      setLancando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div
        onPaste={handlePaste}
        className="bg-white dark:bg-zinc-950 w-full max-w-5xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 rounded-2xl shadow-inner">
              <Sparkles size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Lançar via Print</h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">IA lê o print/mensagem do WhatsApp e sugere os itens de Backlog</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {erro && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-4 text-red-600 dark:text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{erro}</p>
            </div>
          )}

          {sucesso ? (
            <div className="p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl flex flex-col items-center gap-4 text-emerald-600 dark:text-emerald-400 animate-in zoom-in">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-full scale-125">
                <CheckCircle2 size={32} />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-black tracking-tight uppercase">Lançado!</h4>
                <p className="text-sm font-bold opacity-80">{sucesso.count} itens adicionados ao backlog como PENDENTE.</p>
              </div>
            </div>
          ) : itens === null ? (
            <div className="space-y-6">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                tabIndex={0}
                className="cursor-pointer flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all outline-none focus:border-indigo-500"
              >
                {imagemBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagemBase64} alt="Print colado" className="max-h-64 rounded-xl border border-zinc-200 dark:border-zinc-800" />
                ) : (
                  <>
                    <ImagePlus size={32} className="text-zinc-300" />
                    <p className="text-sm font-black text-zinc-700 dark:text-zinc-300">Cole (Ctrl+V), arraste ou clique para escolher o print</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </div>

              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onPaste={handlePaste}
                placeholder="Cole aqui o texto da mensagem do WhatsApp (opcional, mas ajuda bastante a IA)..."
                rows={5}
                className="w-full p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mx-2">
                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{itens.length} itens identificados — revise antes de lançar</span>
                <button onClick={() => setItens(null)} className="text-[10px] font-black text-indigo-500 uppercase hover:underline">Analisar outro print</button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-3 py-3 w-8"></th>
                      <th className="px-3 py-3 font-black text-zinc-400 uppercase">Placa</th>
                      <th className="px-3 py-3 font-black text-zinc-400 uppercase">Descrição</th>
                      <th className="px-3 py-3 font-black text-zinc-400 uppercase w-28">Criticidade</th>
                      <th className="px-3 py-3 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {itens.map((item, idx) => (
                      <tr key={idx} className={cn('transition-colors', !item.incluir && 'opacity-40')}>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="checkbox"
                            checked={item.incluir}
                            onChange={(e) => atualizarItem(idx, { incluir: e.target.checked })}
                            className="w-4 h-4 mt-1.5"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={item.placa || ''}
                            onChange={(e) => atualizarItem(idx, { placa: e.target.value || null })}
                            className={cn(
                              'px-2 py-1.5 rounded-lg text-xs font-black border outline-none w-32 bg-white dark:bg-zinc-950',
                              item.placa ? 'border-zinc-200 dark:border-zinc-800' : 'border-amber-400 text-amber-600'
                            )}
                          >
                            <option value="">— selecione —</option>
                            {placasDisponiveis.map(p => (<option key={p} value={p}>{p}</option>))}
                          </select>
                          {!item.placa && item.placa_detectada_bruta && (
                            <p className="text-[9px] text-amber-600 font-bold mt-1">Lido: &quot;{item.placa_detectada_bruta}&quot;</p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <textarea
                            value={item.descricao}
                            onChange={(e) => atualizarItem(idx, { descricao: e.target.value })}
                            rows={2}
                            className="w-full px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-bold bg-transparent outline-none resize-none"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            value={item.criticidade}
                            onChange={(e) => atualizarItem(idx, { criticidade: e.target.value as 'A' | 'B' })}
                            className="px-2 py-1.5 rounded-lg text-xs font-black border border-zinc-200 dark:border-zinc-800 outline-none bg-white dark:bg-zinc-950"
                          >
                            <option value="A">A - CRÍTICO</option>
                            <option value="B">B - NORMAL</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button onClick={() => removerItem(idx)} className="text-zinc-400 hover:text-red-500 mt-1.5">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end items-center gap-4 flex-shrink-0">
          <button onClick={handleClose} className="px-6 py-2.5 text-sm font-black text-zinc-500 hover:text-zinc-700 transition-all uppercase tracking-widest">Cancelar</button>
          {itens === null ? (
            <button
              onClick={handleAnalisar}
              disabled={analisando || (!imagemBase64 && !texto.trim())}
              className="flex items-center gap-3 px-10 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-500/20 active:scale-95 transition-all"
            >
              {analisando ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {analisando ? 'ANALISANDO...' : 'ANALISAR COM IA'}
            </button>
          ) : !sucesso && (
            <button
              onClick={handleLancar}
              disabled={lancando || itensMarcados.length === 0}
              className="flex items-center gap-3 px-10 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-sm font-black shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
            >
              {lancando ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {lancando ? 'LANÇANDO...' : `LANÇAR ${itensMarcados.length} ITENS NO BACKLOG`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
