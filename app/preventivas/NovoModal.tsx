'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Save, 
  Plus, 
  History, 
  AlertCircle, 
  FileSpreadsheet, 
  Download, 
  Upload,
  ChevronDown,
  Gauge
} from 'lucide-react'
import { registrarHorimetro } from './actions'
import { useFormDraft } from '@/hooks/use-form-draft'
import * as XLSX from 'xlsx'

interface Equipamento {
  id: string
  placa: string
  modelo: string
  ultimoHist?: number
}

interface NovoModalProps {
  equipamentos: Equipamento[]
}

const INITIAL_FORM = {
  equipamento_id: '',
  data_referencia: (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  })(),
  horimetro_inicial: '',
  horimetro_final: '',
  observacoes: ''
}

export default function NovoModal({ equipamentos }: NovoModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'form' | 'import'>('form')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { 
    form, 
    setForm, 
    handleInputChange, 
    clearDraft, 
    hasContent, 
    isLoaded 
  } = useFormDraft('apontamento-preventivas', INITIAL_FORM)

  useEffect(() => {
    if (form.equipamento_id) {
       const eq = equipamentos.find(e => e.id === form.equipamento_id)
       if (eq && !form.horimetro_inicial) {
         setForm(prev => ({ ...prev, horimetro_inicial: eq.ultimoHist?.toString() || '' }))
       }
    }
  }, [form.equipamento_id, equipamentos, setForm])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => formData.append(key, value))

      const result = await registrarHorimetro(formData)

      if ('error' in result) {
        setError(result.error)
      } else {
        clearDraft()
        setIsOpen(false)
        // O revalidatePath nas actions deve cuidar da atualização
      }
    } catch (err) {
      setError('Erro ao processar requisição.')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Placa': 'ABC-1234', 'Data': '2024-03-20', 'H. Inicial': 1000.5, 'H. Final': 1010.5, 'Obs': 'Monitoramento' }
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, 'modelo_importacao_horimetros.xlsx')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)
        console.log('Dados importados:', data)
        // Aqui poderia chamar uma action de importação em massa se existisse
        alert('Importação em massa via Excel processada (Simulação). Para produção, use o formulário manual por enquanto.')
        setIsOpen(false)
      } catch (err) {
        setError('Erro ao ler arquivo Excel.')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all active:scale-95 group"
      >
        <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
        Novo Apontamento
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-xl">
                  <Gauge size={22} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Novo Apontamento</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Registro diário de horímetro para atualização de preventivas</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50/30 dark:bg-zinc-900/30">
              <button 
                onClick={() => setActiveTab('form')}
                className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'form' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                Manual
              </button>
              <button 
                onClick={() => setActiveTab('import')}
                className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'import' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
              >
                Excel
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[70vh] p-6 custom-scrollbar">
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              {activeTab === 'form' ? (
                <form id="horimetro-form" onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Equipamento <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <select
                          name="equipamento_id"
                          value={form.equipamento_id}
                          onChange={handleInputChange}
                          required
                          className="w-full pl-3 pr-10 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                        >
                          <option value="">Selecione...</option>
                          {equipamentos.sort((a,b) => a.placa.localeCompare(b.placa)).map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.placa} - {eq.modelo}</option>
                          ))}
                        </select>
                        <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Data Referência <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        name="data_referencia"
                        value={form.data_referencia}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Horímetro Inicial <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="horimetro_inicial"
                        value={form.horimetro_inicial}
                        onChange={handleInputChange}
                        required
                        step="0.1"
                        min="0"
                        className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Horímetro Final <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        name="horimetro_final"
                        value={form.horimetro_final}
                        onChange={handleInputChange}
                        required
                        step="0.1"
                        min="0"
                        className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1">Observações</label>
                    <textarea
                      name="observacoes"
                      value={form.observacoes}
                      onChange={handleInputChange}
                      rows={3}
                      placeholder="Anomalias, ocorrências ou justificativas..."
                      className="w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    />
                  </div>

                  {form.horimetro_inicial && form.horimetro_final && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl flex justify-between items-center animate-in slide-in-from-bottom-2">
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">Total de Horas:</span>
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {(parseFloat(form.horimetro_final) - parseFloat(form.horimetro_inicial)).toFixed(1)} h
                      </span>
                    </div>
                  )}
                </form>
              ) : (
                <div className="space-y-8 py-4">
                   <div className="flex flex-col items-center text-center space-y-4">
                     <div className="p-4 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full">
                       <FileSpreadsheet size={32} />
                     </div>
                     <div>
                       <h3 className="font-bold text-lg">Importação em Massa</h3>
                       <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">Use nossa planilha para atualizar o horímetro de toda a frota rapidamente.</p>
                     </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <button onClick={handleDownloadTemplate} className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                       <Download className="text-zinc-400 group-hover:text-emerald-500" size={24} />
                       <span className="text-sm font-bold">1. Baixar Modelo</span>
                     </button>
                     <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all group">
                       <Upload className="text-zinc-400 group-hover:text-emerald-500" size={24} />
                       <span className="text-sm font-bold">2. Enviar Planilha</span>
                       <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                     </button>
                   </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end items-center gap-3">
              <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-all">Cancelar</button>
              {activeTab === 'form' && (
                <button 
                  form="horimetro-form"
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={18} />}
                  Registrar Apontamento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
