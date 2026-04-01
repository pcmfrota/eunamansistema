'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  ArrowRight,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { importarBacklog } from './actions'

export default function BacklogImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState("")
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [XLSX, setXLSX] = useState<any>(null)

  useEffect(() => {
    if (isOpen && !XLSX) {
      if ((window as any).XLSX) {
        setXLSX((window as any).XLSX)
      } else {
        const script = document.createElement("script")
        script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"
        script.onload = () => setXLSX((window as any).XLSX)
        document.head.appendChild(script)
      }
    }
  }, [isOpen, XLSX])

  if (!isOpen) return null

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !XLSX) return

    setParsing(true)
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)
        setRows(data)
      } catch (err) {
        setResult({ error: "Erro ao processar arquivo Excel." })
      } finally {
        setParsing(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleConfirm = async () => {
    setLoading(true)
    const res = await importarBacklog(rows)
    if (res.success) {
      setResult(res)
      setTimeout(onClose, 2000)
    } else {
      setResult({ error: res.error })
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex-shrink-0">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-2xl shadow-inner">
               <FileSpreadsheet size={22} />
             </div>
             <div>
               <h2 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">Importação em Massa</h2>
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Alimentação do Backlog via Excel</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full text-zinc-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {result?.error ? (
             <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-start gap-4 text-red-600 dark:text-red-400">
               <AlertCircle size={20} className="shrink-0 mt-0.5" />
               <p className="text-sm font-bold">{result.error}</p>
             </div>
          ) : result?.success ? (
             <div className="mb-6 p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-3xl flex flex-col items-center gap-4 text-emerald-600 dark:text-emerald-400 animate-in zoom-in">
               <div className="p-3 bg-emerald-100 dark:bg-emerald-900/40 rounded-full scale-125">
                 <CheckCircle2 size={32} />
               </div>
               <div className="text-center">
                 <h4 className="text-lg font-black tracking-tight uppercase">Sucesso Total!</h4>
                 <p className="text-sm font-bold opacity-80">{result.count} novos itens adicionados ao backlog.</p>
               </div>
             </div>
          ) : null}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-8">
               <div className="w-full max-w-lg grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group">
                     <Download size={32} className="text-zinc-300 group-hover:text-emerald-500" />
                     <div className="text-center">
                        <span className="block text-xs font-black uppercase text-zinc-400">Step 1</span>
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">Baixar Modelo</span>
                     </div>
                  </button>
                  <button 
                    onClick={() => fileRef.current?.click()}
                    className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all group"
                  >
                     <Upload size={32} className="text-zinc-300 group-hover:text-indigo-500 transition-colors" />
                     <div className="text-center">
                        <span className="block text-xs font-black uppercase text-zinc-400">Step 2</span>
                        <span className="text-sm font-black text-zinc-700 dark:text-zinc-300">Carregar Dados</span>
                     </div>
                     <input type="file" ref={fileRef} onChange={handleFileUpload} accept=".xlsx,.xls" className="hidden" />
                  </button>
               </div>

               <div className="w-full max-w-lg p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-4">
                  <AlertCircle size={20} className="text-indigo-500 shrink-0" />
                  <div className="space-y-1">
                     <p className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200">Requisitos do Arquivo</p>
                     <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
                       Utilize as colunas: <b>Frota, Descrição, Criticidade, Módulo</b>. Sistemas de datas devem seguir o padrão AAAA-MM-DD para garantir a integridade do banco.
                     </p>
                  </div>
               </div>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="flex items-center justify-between mx-2">
                  <div className="flex items-center gap-2">
                    <FileText size={18} className="text-indigo-500" />
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{fileName}</span>
                    <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[9px] font-black text-indigo-500 uppercase">{rows.length} registros</span>
                  </div>
                  <button onClick={() => setRows([])} className="text-[10px] font-black text-red-500 uppercase hover:underline">Substituir</button>
               </div>
               
               <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden font-medium">
                  <table className="w-full text-left text-[11px]">
                     <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                        <tr>
                           <th className="px-4 py-3 font-black text-zinc-400 uppercase">Frota</th>
                           <th className="px-4 py-3 font-black text-zinc-400 uppercase">Descrição</th>
                           <th className="px-4 py-3 font-black text-zinc-400 uppercase">Criticidade</th>
                           <th className="px-4 py-3 font-black text-zinc-400 uppercase">Módulo</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                        {rows.slice(0, 15).map((row, i) => (
                           <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                              <td className="px-4 py-3 font-black text-zinc-900 dark:text-zinc-100">{row.Frota || row.frota || row.Placa}</td>
                              <td className="px-4 py-3 truncate max-w-[200px] font-bold text-zinc-600 dark:text-zinc-400">{row.Descrição || row.descricao}</td>
                              <td className="px-4 py-3 font-black text-center text-indigo-500">{row.Criticidade || row.criticidade || 'B'}</td>
                              <td className="px-4 py-3 text-zinc-400">{row.Módulo || row.modulo}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                  {rows.length > 15 && (
                     <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 text-center text-[9px] font-black text-zinc-400 uppercase tracking-tighter border-t border-zinc-100 dark:border-zinc-900">
                        Exibindo apenas os 15 primeiros de {rows.length}...
                     </div>
                  )}
               </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end items-center gap-4 flex-shrink-0">
           <button onClick={onClose} className="px-6 py-2.5 text-sm font-black text-zinc-500 hover:text-zinc-700 transition-all uppercase tracking-widest">Cancelar</button>
           {rows.length > 0 && !result?.success && (
              <button 
                onClick={handleConfirm}
                disabled={loading}
                className="flex items-center gap-3 px-10 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {loading ? <Database size={18} className="animate-spin" /> : <Database size={18} />}
                PROCESSAR IMPORTAÇÃO
              </button>
           )}
        </div>
      </div>
    </div>
  )
}
