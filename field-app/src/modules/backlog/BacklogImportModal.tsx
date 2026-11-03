'use client'

import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Database,
  FileText
} from 'lucide-react'
import { importarBacklog } from './actions'
import { BottomSheet } from '../../ui/primitives/BottomSheet'

export default function BacklogImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState("")
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

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
    if ('success' in res && res.success) {
      setResult(res)
      setTimeout(onClose, 2000)
    } else {
      setResult({ error: 'error' in res ? res.error : 'Erro desconhecido' })
    }
    setLoading(false)
  }

  const handleClose = () => {
    setRows([])
    setResult(null)
    setFileName("")
    onClose()
  }

  return (
    <BottomSheet open={isOpen} onClose={handleClose} title="Importação em Massa" fullHeight>
      <div className="space-y-4 pb-2">
        {result?.error ? (
          <div className="p-3.5 bg-red-950/30 border border-red-900/40 rounded-xl flex items-start gap-3 text-red-400">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <p className="text-xs font-bold">{result.error}</p>
          </div>
        ) : result?.success ? (
          <div className="p-5 bg-emerald-950/30 border border-emerald-900/40 rounded-2xl flex flex-col items-center gap-3 text-emerald-400">
            <div className="p-2.5 bg-emerald-900/40 rounded-full">
              <CheckCircle2 size={28} />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-black tracking-tight uppercase">Sucesso Total!</h4>
              <p className="text-xs font-bold opacity-80">{result.count} novos itens adicionados ao backlog.</p>
            </div>
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="w-full grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center gap-2.5 p-5 border border-dashed border-zinc-700 rounded-2xl active:border-emerald-600 active:bg-emerald-950/20">
                <Download size={26} className="text-zinc-600" />
                <div className="text-center">
                  <span className="block text-[9px] font-black uppercase text-zinc-500">Passo 1</span>
                  <span className="text-xs font-black text-zinc-200">Baixar Modelo</span>
                </div>
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-2.5 p-5 border border-dashed border-zinc-700 rounded-2xl active:border-indigo-500 active:bg-indigo-950/20"
              >
                <Upload size={26} className="text-zinc-600" />
                <div className="text-center">
                  <span className="block text-[9px] font-black uppercase text-zinc-500">Passo 2</span>
                  <span className="text-xs font-black text-zinc-200">{parsing ? "Carregando..." : "Carregar Dados"}</span>
                </div>
                <input type="file" ref={fileRef} onChange={handleFileUpload} accept=".xlsx,.xls" className="hidden" />
              </button>
            </div>

            <div className="w-full p-4 bg-zinc-900 rounded-2xl border border-zinc-800 flex gap-3">
              <AlertCircle size={18} className="text-indigo-400 shrink-0" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-zinc-200">Requisitos do Arquivo</p>
                <p className="text-[10px] text-zinc-500 font-bold leading-relaxed">
                  Utilize as colunas: <b className="text-zinc-300">Frota, Descrição, Criticidade, Módulo</b>. Datas devem seguir o padrão AAAA-MM-DD.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-indigo-400 shrink-0" />
                <span className="text-xs font-black text-zinc-200 truncate">{fileName}</span>
                <span className="px-2 py-0.5 bg-zinc-800 rounded text-[9px] font-black text-indigo-400 uppercase shrink-0">{rows.length} registros</span>
              </div>
              <button onClick={() => setRows([])} className="text-[10px] font-black text-red-400 uppercase shrink-0">Substituir</button>
            </div>

            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-zinc-900 border-b border-zinc-800">
                    <tr>
                      <th className="px-3 py-2 font-black text-zinc-500 uppercase">Frota</th>
                      <th className="px-3 py-2 font-black text-zinc-500 uppercase">Descrição</th>
                      <th className="px-3 py-2 font-black text-zinc-500 uppercase">Crit.</th>
                      <th className="px-3 py-2 font-black text-zinc-500 uppercase">Módulo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {rows.slice(0, 15).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-black text-zinc-100">{row.Frota || row.frota || row.Placa}</td>
                        <td className="px-3 py-2 truncate max-w-[140px] font-bold text-zinc-400">{row.Descrição || row.descricao}</td>
                        <td className="px-3 py-2 font-black text-center text-indigo-400">{row.Criticidade || row.criticidade || 'B'}</td>
                        <td className="px-3 py-2 text-zinc-500">{row.Módulo || row.modulo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 15 && (
                <p className="px-3 py-2 bg-zinc-900/60 text-center text-[9px] font-black text-zinc-500 uppercase border-t border-zinc-800">
                  Exibindo apenas os 15 primeiros de {rows.length}...
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={handleClose} className="flex-1 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800 active:bg-zinc-700" style={{ minHeight: "var(--tap-min)" }}>
            Cancelar
          </button>
          {rows.length > 0 && !result?.success && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 text-white text-xs font-black"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <Database size={15} className={loading ? "animate-spin" : ""} />
              Processar
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}
