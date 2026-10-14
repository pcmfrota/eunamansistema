'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, Download, Clock, Loader2 } from 'lucide-react'
import { nomeSistema, nomeSubsistema, nomeComponente } from './classificacaoTecnica'
import { salvarOuCompartilharBlob } from '@/lib/pdf-share'

function EunamanLogo({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M60 8 L66 18 L78 14 L78 26 L90 28 L86 40 L96 48 L88 56 L92 68 L80 70 L78 82 L66 80 L60 90
          L54 80 L42 82 L40 70 L28 68 L32 56 L24 48 L34 40 L30 28 L42 26 L42 14 L54 18 Z"
        fill="none" stroke="#1a5c1a" strokeWidth="4" strokeLinejoin="round"
      />
      <circle cx="60" cy="49" r="26" fill="#1a5c1a" />
      <text x="60" y="62" textAnchor="middle" fontSize="32" fontWeight="900" fill="#ffffff" fontFamily="Arial, sans-serif">E</text>
      <text x="60" y="102" textAnchor="middle" fontSize="13" fontWeight="900" fill="#1a1a1a" fontFamily="Arial, sans-serif" letterSpacing="1">EUNAMAN</text>
      <text x="60" y="114" textAnchor="middle" fontSize="7" fontWeight="700" fill="#1a5c1a" fontFamily="Arial, sans-serif" letterSpacing="1">FOREST SUPPORT EXPERT</text>
    </svg>
  )
}

function fmtData(v?: string | null): string {
  if (!v) return '—'
  const [data, hora] = String(v).split('T')
  const partes = data.split('-')
  if (partes.length < 3) return String(v)
  const [y, m, d] = partes
  return hora ? `${d}/${m}/${y} ${hora.slice(0, 5)}` : `${d}/${m}/${y}`
}

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

const Linha = ({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) => (
  <div className="flex flex-col gap-1 min-w-0">
    <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold truncate">{label}</span>
    <span className={`text-[13px] border-b border-dotted border-gray-300 pb-1 break-words ${bold ? 'font-black' : 'font-semibold'} text-gray-800`}>{value || '—'}</span>
  </div>
)

const SecTitle = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">{children}</div>
)

export default function BacklogFichaModal({ item, onClose }: { item: any; onClose: () => void }) {
  const [mounted, setMounted] = useState(false)
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!(window as any).html2pdf) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
      document.body.appendChild(script)
    }
  }, [])

  const aging = calcularDias(item)
  const fotosAntes: string[] = item.evidencia_imagens?.length ? item.evidencia_imagens : (item.evidencia_imagem ? [item.evidencia_imagem] : [])
  const fotosDepois: string[] = item.evidencia_imagens_conclusao || []

  const sistemaLabel = item.sistema_cod ? `${item.sistema_cod} – ${nomeSistema(item.sistema_cod)}` : '—'
  const subsistemaLabel = item.subsistema_cod ? `${item.subsistema_cod} – ${nomeSubsistema(item.subsistema_cod)}` : '—'
  const componenteLabel = item.componente_cod ? `${item.componente_cod} – ${nomeComponente(item.componente_cod)}` : '—'

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return

    const fotosHTML = (titulo: string, fotos: string[]) => fotos.length === 0 ? '' : `
      <div style="border-bottom:1px solid #111;">
        ${`<div style="background:#1a5c1a;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:4px 10px;">${titulo}</div>`}
        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:8px;padding:8px 10px;">
          ${fotos.map(f => `<div style="border:1px solid #e2e8f0;border-radius:4px;overflow:hidden;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;background:#000;">
            <img src="${f}" style="max-width:100%;max-height:100%;object-fit:cover;" />
          </div>`).join('')}
        </div>
      </div>`

    const secTitle = (t: string) => `<div style="background:#1a5c1a;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:4px 10px;">${t}</div>`
    const rows = (label: string, value: string, bold = false) =>
      `<div style="padding:0 8px 8px 8px;display:flex;flex-direction:column;gap:2px;flex:1;">
        <label style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${label}</label>
        <span style="font-size:12px;font-weight:${bold ? '900' : '600'};color:#111827;border-bottom:1px dotted #9ca3af;padding-bottom:2px;">${value || '—'}</span>
      </div>`

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>Backlog ${item.frota || ''}</title>
      <style>
        @page { size: A4 portrait; margin: 8mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body { font-family: Arial, sans-serif; font-size: 10px; background: #fff; color: #000; margin: 0; padding: 0; }
      </style>
      </head><body>
      <div style="border:1.5px solid #111; max-width: 100%; margin: 0 auto;">
        <div style="display:flex;align-items:center;border-bottom:2px solid #111;padding:8px 12px;gap:12px;">
          <div style="flex:1;text-align:center;">
            <h1 style="font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">FICHA DE BACKLOG</h1>
            <p style="font-size:10px;color:#6b7280;margin-top:3px;">EUNAMAN — CONTROLE DE MANUTENÇÃO DE FROTAS</p>
          </div>
          <div style="min-width:120px;text-align:right;">
            <p style="font-size:9px;color:#6b7280;text-transform:uppercase;font-weight:600;">Frota</p>
            <p style="font-size:14px;font-weight:900;font-family:monospace;">${item.frota || '-'}</p>
            <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:800;margin-top:4px;background:#fef9c3;color:#ca8a04;border:1px solid #fef08a;">${item.status || 'PENDENTE'}</span>
          </div>
        </div>

        <div style="border-bottom:1px solid #111;">
          ${secTitle('Identificação')}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows('Data de Evidência', fmtData(item.data_evidencia), true)}
            ${rows('Criticidade', item.criticidade === 'A' ? 'A - CRÍTICO' : 'B - NORMAL')}
            ${rows('Colaborador', item.colaborador)}
            ${rows('Origem', item.origem)}
          </div>
        </div>

        <div style="border-bottom:1px solid #111;">
          ${secTitle('Localização')}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows('Módulo', item.modulo)}
            ${rows('Tipo', item.tipo)}
            ${rows('TAG', item.tag)}
            ${rows('Campo / Base', item.campo_base)}
          </div>
          <div style="display:flex;padding:0 2px 8px 2px;">
            ${rows('Região x Programação', item.regiao_programa)}
          </div>
        </div>

        <div style="border-bottom:1px solid #111;">
          ${secTitle('Atividade & Classificação Técnica')}
          <div style="padding:8px 10px;min-height:40px;">
            <p style="font-size:11px;font-weight:600;color:#b45309;line-height:1.6;">${item.descricao || '—'}</p>
          </div>
          <div style="display:flex;padding:0 2px 8px 2px;">
            ${rows('Sistema', sistemaLabel)}
            ${rows('Subsistema', subsistemaLabel)}
            ${rows('Componente', componenteLabel)}
          </div>
          <div style="display:flex;padding:0 2px 8px 2px;">
            ${rows('Nº O.S', item.os)}
            ${rows('Tempo Estimado', item.tempo_execucao)}
          </div>
        </div>

        <div style="border-bottom:1px solid #111;">
          ${secTitle('Materiais & RC')}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows('Material', item.material)}
            ${rows('Nº RC', item.nr_rc)}
            ${rows('Fornecedor', item.fornecedor)}
          </div>
          <div style="display:flex;padding:0 2px 8px 2px;">
            ${rows('Mão de Obra', item.mao_obra)}
            ${rows('Detalhamento', item.detalhamento)}
            ${rows('Situação RC', item.situacao_rc)}
          </div>
        </div>

        <div style="border-bottom:1px solid #111;">
          ${secTitle('Programação & Conclusão')}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows('Previsão Programação', fmtData(item.data_programacao))}
            ${rows('Status Programação', item.status_programacao)}
            ${rows('Data de Conclusão', fmtData(item.data_conclusao))}
          </div>
          <div style="padding:6px 10px;min-height:24px;">
            <p style="font-size:10px;color:#374151;line-height:1.4;">${item.observacao || '—'}</p>
          </div>
        </div>

        ${fotosHTML('Evidência (Antes)', fotosAntes)}
        ${fotosHTML('Evidência (Após Conclusão)', fotosDepois)}

        <div style="display:flex;justify-content:space-between;padding:5px 10px;background:#f9fafb;border-top:1px solid #d1d5db;">
          <p style="font-size:9px;color:#9ca3af;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          <p style="font-size:9px;color:#6b7280;font-weight:700;">EUNAMAN — Sistema de Controle de Manutenção</p>
        </div>
      </div>
    </body></html>`)
    win.document.close()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  const handleBaixarPdf = async () => {
    const html2pdf = (window as any).html2pdf
    if (!html2pdf) {
      alert('Biblioteca de PDF ainda carregando. Aguarde alguns segundos e tente novamente.')
      return
    }
    setGerandoPdf(true)
    try {
      const element = document.getElementById('ficha-backlog-conteudo')
      const filename = `Backlog_${item.frota || 'registro'}.pdf`
      const blob: Blob = await html2pdf().set({
        margin: [5, 5, 5, 5],
        filename,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: { scale: 1.5, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(element).toPdf().output('blob')
      await salvarOuCompartilharBlob(blob, filename, `Backlog ${item.frota || ''}`, `Ficha de Backlog — ${item.frota || ''}`, 'download')
    } catch (err: any) {
      console.error('Erro ao gerar PDF da ficha de backlog:', err)
      alert('Erro ao gerar o PDF: ' + (err?.message || String(err)))
    } finally {
      setGerandoPdf(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />
        <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
          <div className="p-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-zinc-50">
            <div className="flex items-center gap-2">
              <EunamanLogo size={32} />
              <h2 className="font-black text-sm text-zinc-800 uppercase tracking-wide">Ficha de Backlog — {item.frota}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold transition-colors">
                <Printer size={14} /> Imprimir
              </button>
              <button onClick={handleBaixarPdf} disabled={gerandoPdf} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors">
                {gerandoPdf ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar PDF
              </button>
              <button onClick={onClose} className="p-2 hover:bg-zinc-200 rounded-full text-zinc-500 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            <div id="ficha-backlog-conteudo" className="bg-white text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div className="flex items-center border-b-2 border-gray-900 px-4 py-3 gap-3">
                <EunamanLogo size={48} />
                <div className="flex-1 text-center">
                  <h1 className="text-lg font-black tracking-widest uppercase">Ficha de Backlog</h1>
                  <p className="text-[10px] text-gray-500 mt-0.5">EUNAMAN — Controle de Manutenção de Frotas</p>
                </div>
                <div className="min-w-[110px] text-right">
                  <p className="text-[9px] text-gray-500 uppercase font-semibold">Frota</p>
                  <p className="text-sm font-black font-mono">{item.frota || '-'}</p>
                  <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold mt-1 bg-yellow-100 text-yellow-700 border border-yellow-200">{item.status || 'PENDENTE'}</span>
                </div>
              </div>

              {aging && (
                <div className="px-4 py-2 bg-indigo-50 border-b border-gray-900 flex items-center gap-2">
                  <Clock size={13} className="text-indigo-600" />
                  <span className="text-[11px] font-black text-indigo-700">
                    {aging.encerrado ? `Ficou ${aging.dias} dia${aging.dias !== 1 ? 's' : ''} em aberto (encerrado)` : `${aging.dias} dia${aging.dias !== 1 ? 's' : ''} pendente desde o lançamento`}
                  </span>
                </div>
              )}

              <div className="border-b border-gray-900">
                <SecTitle>Identificação</SecTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 py-3">
                  <Linha label="Data de Evidência" value={fmtData(item.data_evidencia)} bold />
                  <Linha label="Criticidade" value={item.criticidade === 'A' ? 'A - CRÍTICO' : 'B - NORMAL'} />
                  <Linha label="Colaborador" value={item.colaborador} />
                  <Linha label="Origem" value={item.origem} />
                </div>
              </div>

              <div className="border-b border-gray-900">
                <SecTitle>Localização</SecTitle>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 pt-3 pb-2">
                  <Linha label="Módulo" value={item.modulo} />
                  <Linha label="Tipo" value={item.tipo} />
                  <Linha label="TAG" value={item.tag} />
                  <Linha label="Campo / Base" value={item.campo_base} />
                </div>
                <div className="grid grid-cols-1 gap-4 px-4 pb-3">
                  <Linha label="Região x Programação" value={item.regiao_programa} />
                </div>
              </div>

              <div className="border-b border-gray-900">
                <SecTitle>Atividade &amp; Classificação Técnica</SecTitle>
                <div className="px-4 py-3 min-h-[48px]">
                  <p className="text-[11px] font-semibold text-amber-700 leading-relaxed whitespace-pre-wrap">{item.descricao || '—'}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pb-3">
                  <Linha label="Sistema" value={sistemaLabel} />
                  <Linha label="Subsistema" value={subsistemaLabel} />
                  <Linha label="Componente" value={componenteLabel} />
                </div>
                <div className="grid grid-cols-2 gap-4 px-4 pb-3">
                  <Linha label="Nº O.S" value={item.os} />
                  <Linha label="Tempo Estimado" value={item.tempo_execucao} />
                </div>
              </div>

              <div className="border-b border-gray-900">
                <SecTitle>Materiais &amp; RC</SecTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pt-3 pb-2">
                  <Linha label="Material" value={item.material} />
                  <Linha label="Nº RC" value={item.nr_rc} />
                  <Linha label="Fornecedor" value={item.fornecedor} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pb-3">
                  <Linha label="Mão de Obra" value={item.mao_obra} />
                  <Linha label="Detalhamento" value={item.detalhamento} />
                  <Linha label="Situação RC" value={item.situacao_rc} />
                </div>
              </div>

              <div className="border-b border-gray-900">
                <SecTitle>Programação &amp; Conclusão</SecTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 pt-3 pb-2">
                  <Linha label="Previsão Programação" value={fmtData(item.data_programacao)} />
                  <Linha label="Status Programação" value={item.status_programacao} />
                  <Linha label="Data de Conclusão" value={fmtData(item.data_conclusao)} />
                </div>
                <div className="px-4 pb-3 min-h-[28px]">
                  <p className="text-[10px] text-gray-600 leading-relaxed whitespace-pre-wrap">{item.observacao || '—'}</p>
                </div>
              </div>

              {fotosAntes.length > 0 && (
                <div className="border-b border-gray-900 bg-white">
                  <SecTitle>Evidência (Antes)</SecTitle>
                  <div className="grid grid-cols-2 gap-3 px-4 py-3">
                    {fotosAntes.map((foto, idx) => (
                      <button key={idx} type="button" onClick={() => setFotoExpandida(foto)} className="aspect-video rounded-md overflow-hidden border border-gray-300 bg-black cursor-zoom-in">
                        <img src={foto} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {fotosDepois.length > 0 && (
                <div className="border-b border-gray-900 bg-white">
                  <SecTitle>Evidência (Após Conclusão)</SecTitle>
                  <div className="grid grid-cols-2 gap-3 px-4 py-3">
                    {fotosDepois.map((foto, idx) => (
                      <button key={idx} type="button" onClick={() => setFotoExpandida(foto)} className="aspect-video rounded-md overflow-hidden border border-gray-300 bg-black cursor-zoom-in">
                        <img src={foto} alt={`Evidência conclusão ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50">
                <p className="text-[9px] text-gray-400">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                <p className="text-[9px] text-gray-500 font-semibold">EUNAMAN — Sistema de Controle de Manutenção</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {fotoExpandida && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-sm"
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
    </>,
    document.body
  )
}
