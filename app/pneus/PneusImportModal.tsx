'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  FileText,
  Search,
  Database
} from 'lucide-react'
import { importarInspecoesPneus } from './actions'

interface PreviewRow {
  placa: string
  data_inspecao: string
  km_atual: number | null
  de: number | null; dd: number | null
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null
  estepe: number | null
  condicao: string
  observacoes: string
  _ok: boolean
  _err?: string
}

const COL_ALIASES: Record<string, string> = {
  placa: "placa", "placa/frota": "placa", fleet: "placa", plate: "placa",
  data: "data_inspecao", "data inspecao": "data_inspecao", "data inspeção": "data_inspecao",
  "data da inspeção": "data_inspecao", date: "data_inspecao",
  km: "km_atual", "km atual": "km_atual", quilometragem: "km_atual", odometer: "km_atual",
  de: "de", dd: "dd",
  tei: "tei", tee: "tee", tdi: "tdi", tde: "tde",
  tei1: "tei1", tee1: "tee1", tdi1: "tdi1", tde1: "tde1",
  estepe: "estepe", step: "estepe", spare: "estepe",
  condicao: "condicao", "condição": "condicao", condition: "condicao", cond: "condicao",
  observacoes: "observacoes", "observações": "observacoes", obs: "observacoes",
}

function normalizeKey(k: string) {
  return k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function excelDateToISO(serial: number): string {
  const date = new Date(Math.round((serial - 25569) * 864e5));
  return date.toISOString().split("T")[0];
}

function normalizeDate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) return excelDateToISO(parseInt(s));
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  return s;
}

export default function PneusImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [rows, setRows] = useState<PreviewRow[]>([])
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState("")
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isOpen) {
      setRows([])
      setResult(null)
      setFileName("")
    }
  }, [isOpen])

  if (!isOpen) return null

  // SheetJS lazy load logic
  const [XLSX, setXLSX] = useState<any>(null)
  useEffect(() => {
    if ((window as any).XLSX) {
      setXLSX((window as any).XLSX)
    } else {
      const script = document.createElement("script")
      script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js"
      script.onload = () => setXLSX((window as any).XLSX)
      document.head.appendChild(script)
    }
  }, [])

  const processDataRows = (matrix: any[][]): PreviewRow[] => {
    if (!matrix.length) return []
    const headers = matrix[0].map(h => { const n = normalizeKey(String(h)); return COL_ALIASES[n] || n; })
    const dataRows = matrix.slice(1)
    
    return dataRows.filter(r => r.some(c => String(c ?? "").trim())).map(row => {
      const get = (key: string) => { const idx = headers.indexOf(key); return idx >= 0 ? (row[idx] ?? "") : ""; }
      const placa = String(get("placa")).trim().toUpperCase()
      const data_inspecao = normalizeDate(get("data_inspecao"))
      const ok = !!placa && !!data_inspecao
      return {
        placa, data_inspecao, km_atual: parseNum(get("km_atual")),
        de: parseNum(get("de")), dd: parseNum(get("dd")),
        tei: parseNum(get("tei")), tee: parseNum(get("tee")),
        tdi: parseNum(get("tdi")), tde: parseNum(get("tde")),
        tei1: parseNum(get("tei1")), tee1: parseNum(get("tee1")),
        tdi1: parseNum(get("tdi1")), tde1: parseNum(get("tde1")),
        estepe: parseNum(get("estepe")),
        condicao: String(get("condicao")).trim().toUpperCase() || "BOM",
        observacoes: String(get("observacoes")).trim(),
        _ok: ok,
        _err: !ok ? (!placa ? "Placa ausente" : "Data ausente") : undefined,
      }
    })
  }

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
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][]
        setRows(processDataRows(aoa))
      } catch (err) {
        setResult({ error: "Erro ao processar arquivo Excel." })
      } finally {
        setParsing(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleImport = async () => {
    const valid = rows.filter(r => r._ok)
    if (!valid.length) return
    
    setLoading(true)
    try {
      const res = await importarInspecoesPneus(valid)
      setResult(res)
      if (res && 'success' in res && res.success) {
        setTimeout(onClose, 2000)
      }
    } catch (err) {
      setResult({ error: "Erro ao enviar dados ao servidor." })
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    if (!XLSX) return
    const ws = XLSX.utils.json_to_sheet([
      { 'Placa': 'ABC1234', 'Data': '2024-03-20', 'Km': 15000, 'DE': 12, 'DD': 12, 'Condicao': 'BOM', 'Obs': 'Nova' }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'modelo_boletim_pneus.xlsx')
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-xl shadow-inner">
               <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Importar Boletins de Pneus</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium"> Carga em massa de inspeções via Excel (.xlsx) </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {result?.error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{result.error}</p>
            </div>
          )}

          {result?.success && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-start gap-3 text-emerald-600 dark:text-emerald-400 animate-in zoom-in">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Importação concluída com sucesso!</p>
                <p className="text-xs font-medium opacity-80">{result.importados} registros adicionados.</p>
              </div>
            </div>
          )}

          {rows.length === 0 && !parsing ? (
            <div className="space-y-8 py-10 flex flex-col items-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                <button 
                  onClick={downloadTemplate}
                  className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group"
                >
                  <Download className="text-zinc-400 group-hover:text-blue-500 transition-colors" size={32} />
                  <div className="text-center">
                    <span className="block text-base font-bold">1. Baixar Modelo</span>
                    <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Planilha modelo (.xlsx) com colunas corretas</span>
                  </div>
                </button>

                <button 
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group"
                >
                  <Upload className="text-zinc-400 group-hover:text-emerald-500 transition-colors" size={32} />
                  <div className="text-center">
                    <span className="block text-base font-bold">2. Enviar Arquivo</span>
                    <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Selecione seu arquivo preenchido</span>
                  </div>
                  <input type="file" ref={fileRef} onChange={handleFileUpload} accept=".xlsx,.xls" className="hidden" />
                </button>
              </div>

              <div className="w-full max-w-2xl p-5 bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-4">
                 <AlertCircle size={20} className="text-orange-500 shrink-0" />
                 <div className="text-sm space-y-1">
                   <p className="font-bold text-zinc-700 dark:text-zinc-300">Dicas para uma importação perfeita:</p>
                   <ul className="text-xs text-zinc-500 font-medium list-disc ml-5 space-y-0.5">
                     <li>Use o formato <b>AAAA-MM-DD</b> para datas.</li>
                     <li>A coluna <b>Placa</b> deve ser idêntica ao cadastro da frota.</li>
                     <li>As colunas de sulco (DE, DD, etc) aceitam números decimais (ex: 8.5).</li>
                   </ul>
                 </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-2">
                   <FileText size={18} className="text-zinc-400" />
                   <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{fileName}</span>
                   <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded font-black text-zinc-500 uppercase">{rows.length} Linhas</span>
                 </div>
                 <button onClick={() => setRows([])} className="text-xs font-bold text-red-500 hover:underline">Remover arquivo</button>
              </div>

              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <th className="px-4 py-2 font-black text-zinc-500">Status</th>
                      <th className="px-4 py-2 font-black text-zinc-500">Placa</th>
                      <th className="px-4 py-2 font-black text-zinc-500">Data</th>
                      <th className="px-4 py-2 font-black text-zinc-500">Km</th>
                      <th className="px-4 py-2 font-black text-zinc-500">Condição</th>
                      <th className="px-4 py-2 font-black text-zinc-500">DE</th>
                      <th className="px-4 py-2 font-black text-zinc-500">DD</th>
                      <th className="px-4 py-2 font-black text-zinc-500">Observações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900 font-medium">
                    {rows.slice(0, 15).map((row, i) => (
                      <tr key={i} className={!row._ok ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                        <td className="px-4 py-2">
                          {row._ok ? (
                            <span className="text-emerald-500 flex items-center gap-1 font-bold"><CheckCircle2 size={12} /> OK</span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1 font-bold" title={row._err}><AlertCircle size={12} /> Erro</span>
                          )}
                        </td>
                        <td className="px-4 py-2 font-bold">{row.placa}</td>
                        <td className="px-4 py-2">{row.data_inspecao}</td>
                        <td className="px-4 py-2">{row.km_atual}</td>
                        <td className="px-4 py-2">{row.condicao}</td>
                        <td className="px-4 py-2">{row.de}</td>
                        <td className="px-4 py-2">{row.dd}</td>
                        <td className="px-4 py-2 text-zinc-400 max-w-[100px] truncate">{row.observacoes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 15 && (
                  <div className="p-2 text-center bg-zinc-50/50 dark:bg-zinc-900/50 text-[10px] text-zinc-500 font-bold border-t border-zinc-200 dark:border-zinc-800">
                    Exibindo 15 de {rows.length} registros...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end items-center gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-all"
          >
            Cancelar
          </button>
          {rows.length > 0 && !result?.success && (
            <button 
              onClick={handleImport}
              disabled={loading || rows.filter(r => r._ok).length === 0}
              className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Database size={18} />
              )}
              Confirmar Importação ({rows.filter(r => r._ok).length})
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
