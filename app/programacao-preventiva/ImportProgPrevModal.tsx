"use client"

import React, { useRef, useState } from "react"
import * as XLSX from "xlsx"
import { X, Upload, Download, FileSpreadsheet, CheckCircle2, AlertCircle, Database, FileText } from "lucide-react"
import { importarProgSemanal } from "./actions"

export default function ImportProgPrevModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<any[]>([])
  const [fileName, setFileName] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  const handleClose = () => {
    setRows([])
    setFileName("")
    setResult(null)
    onClose()
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]

        // Lê como matriz bruta (sem assumir que a linha 1 tem os cabeçalhos), pois a
        // planilha real costuma ter uma linha de título/banner (ex: "PROGRAMAÇÃO DA
        // PREVENTIVA", em célula mesclada) acima da linha com os nomes das colunas.
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][]

        const headerRowIndex = raw.findIndex(row =>
          row.some(cell => String(cell || "").toUpperCase().trim() === "PLACA")
        )

        if (headerRowIndex === -1) {
          setResult({ error: 'Não foi possível encontrar a coluna "PLACA" na planilha. Verifique se o arquivo está no formato esperado.' })
          setRows([])
          return
        }

        const headers = raw[headerRowIndex].map(h => String(h || "").trim())
        const data = raw.slice(headerRowIndex + 1).map(rowArr => {
          const obj: Record<string, any> = {}
          headers.forEach((h, i) => {
            if (h) obj[h] = rowArr[i]
          })
          return obj
        })

        setRows(data)
      } catch (err) {
        setResult({ error: "Erro ao ler o arquivo Excel." })
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        "ANO": 2026, "MÊS": "1° AGOSTO", "SEM.": "S32", "PLACA": "ROE8F63", "MÓDULO": "7",
        "TIPO": "COMBOIO", "DT. INICIAL": "03/08/2026", "DT. FINAL": "09/08/2026", "QTD DIA": 7,
        "HORAS": "13.000", "STATUS": "PROGRAMADO", "%": "0%", "HORÍMETRO DO DIA": "",
        "TIPO DE MANUTENÇÃO": "PREVENTIVA",
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Modelo")
    XLSX.writeFile(wb, "modelo_programacao_preventiva.xlsx")
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const res: any = await importarProgSemanal(rows)
      if (res?.error) {
        setResult({ error: res.error })
      } else {
        setResult(res)
        window.dispatchEvent(new CustomEvent("offline-db-updated-prev_prog_semanal"))
        setTimeout(handleClose, 2000)
      }
    } catch (err: any) {
      setResult({ error: err?.message || "Erro ao importar planilha." })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-gray-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 text-green-700 rounded-2xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-gray-900">Importar Programação</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Mesmo formato da planilha externa da equipe</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8">
          {result?.error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 text-red-600">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-bold">{result.error}</p>
            </div>
          )}
          {result?.success && (
            <div className="mb-6 p-6 bg-emerald-50 border border-emerald-200 rounded-3xl flex flex-col items-center gap-3 text-emerald-700 animate-in zoom-in">
              <CheckCircle2 size={32} />
              <p className="text-sm font-bold text-center">
                {result.count} lançamento{result.count !== 1 ? "s" : ""} importado{result.count !== 1 ? "s" : ""}
                {result.anos?.length ? ` (ano${result.anos.length !== 1 ? "s" : ""} ${result.anos.join(", ")})` : ""}.
              </p>
            </div>
          )}

          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-8 py-10">
              <div className="w-full max-w-lg grid grid-cols-2 gap-6">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-green-500 hover:bg-green-50/50 transition-all group"
                >
                  <Download size={28} className="text-gray-300 group-hover:text-green-500" />
                  <span className="text-sm font-black text-gray-700">Baixar Modelo</span>
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-indigo-500 hover:bg-indigo-50/50 transition-all group"
                >
                  <Upload size={28} className="text-gray-300 group-hover:text-indigo-500" />
                  <span className="text-sm font-black text-gray-700">Carregar Planilha</span>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                </button>
              </div>
              <div className="w-full max-w-lg p-5 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3">
                <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 font-bold leading-relaxed">
                  Atenção: a importação substitui TODOS os lançamentos já cadastrados para o(s) ano(s)
                  presentes na planilha. Os removidos ficam registrados no Histórico de Exclusões.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-indigo-500" />
                  <span className="text-xs font-black text-gray-800">{fileName}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-[9px] font-black text-indigo-600">{rows.length} linhas</span>
                </div>
                <button onClick={() => setRows([])} className="text-[10px] font-black text-red-500 uppercase hover:underline">
                  Substituir arquivo
                </button>
              </div>
              <div className="border border-gray-200 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {["Ano", "Mês", "Sem.", "Placa", "Módulo", "Tipo", "Status"].map(h => (
                        <th key={h} className="px-3 py-2.5 font-black text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 15).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-bold text-gray-700">{row["ANO"] ?? row["Ano"] ?? row["ano"] ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row["MÊS"] ?? row["Mês"] ?? row["mes"] ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row["SEM."] ?? row["Sem."] ?? row["semana"] ?? "—"}</td>
                        <td className="px-3 py-2 font-black text-gray-900">{row["PLACA"] ?? row["Placa"] ?? row["placa"] ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row["MÓDULO"] ?? row["Módulo"] ?? row["modulo"] ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row["TIPO"] ?? row["Tipo"] ?? row["tipo"] ?? "—"}</td>
                        <td className="px-3 py-2 text-gray-500">{row["STATUS"] ?? row["Status"] ?? row["status"] ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 15 && (
                  <div className="px-4 py-2 bg-gray-50 text-center text-[9px] font-black text-gray-400 uppercase border-t border-gray-100">
                    Exibindo 15 de {rows.length}...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
          <button onClick={handleClose} className="px-6 py-2.5 text-sm font-black text-gray-500 hover:text-gray-700 uppercase tracking-widest transition-colors">
            Cancelar
          </button>
          {rows.length > 0 && !result?.success && (
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-700 text-white rounded-2xl text-sm font-black shadow-lg disabled:opacity-50 transition-all active:scale-95"
            >
              <Database size={16} className={loading ? "animate-spin" : ""} />
              {loading ? "Importando..." : "Confirmar Importação"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
