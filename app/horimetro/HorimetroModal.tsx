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
  Search,
  ChevronDown
} from 'lucide-react'
import { registrarHorimetro, atualizarHorimetro } from './actions'
import { useFormDraft } from '@/hooks/use-form-draft'
import * as XLSX from 'xlsx'
import { SearchableSelect } from '@/components/SearchableSelect'

interface HorimetroModalProps {
  isOpen: boolean
  onClose: () => void
  equipamentos: any[]
  editData?: any
  onSuccess: () => void
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

export default function HorimetroModal({ 
  isOpen, 
  onClose, 
  equipamentos, 
  editData, 
  onSuccess 
}: HorimetroModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'form' | 'import'>('form')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Use draft persistent hook for NEW entries only
  const { 
    form, 
    setForm, 
    handleInputChange, 
    clearDraft, 
    hasContent, 
    isLoaded 
  } = useFormDraft(editData ? null : 'horimetro-new', INITIAL_FORM)

  // Sync form with editData when editing
  useEffect(() => {
    if (editData) {
      setForm({
        equipamento_id: editData.equipamento_id || '',
        data_referencia: editData.data_referencia?.split('T')[0] || INITIAL_FORM.data_referencia,
        horimetro_inicial: editData.horimetro_inicial?.toString() || '',
        horimetro_final: editData.horimetro_final?.toString() || '',
        observacoes: editData.observacoes || ''
      })
    } else if (isLoaded && !hasContent) {
      setForm(INITIAL_FORM)
    }
  }, [editData, isLoaded, setForm])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => formData.append(key, value))

      let result
      if (editData?.id) {
        result = await atualizarHorimetro(editData.id, formData)
      } else {
        result = await registrarHorimetro(formData)
      }

      if ('error' in result) {
        setError(result.error)
      } else {
        clearDraft()
        onSuccess()
        onClose()
      }
    } catch (err) {
      setError('Erro ao processar requisição.')
    } finally {
      setLoading(false)
    }
  }

  // EXCEL IMPORT LOGIC
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

        // Basic validation and mapping
        const processed = data.map((row: any) => ({
          placa: row.Placa || row.placa,
          data: row.Data || row.data || INITIAL_FORM.data_referencia,
          inicial: row['H. Inicial'] || row.horimetro_inicial,
          final: row['H. Final'] || row.horimetro_final,
          obs: row.Obs || row.observacoes || ''
        }))

        // Call bulk action (to be implemented)
        console.log('Importing:', processed)
        // const result = await importarHorimetros(processed);
        // ... handled locally for now or via a new action
        
        onSuccess()
        onClose()
      } catch (err) {
        setError('Erro ao ler arquivo Excel.')
      } finally {
        setLoading(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300">
      <div 
        className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400 rounded-xl shadow-inner">
              {editData ? <History size={22} /> : <Plus size={22} />}
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {editData ? 'Editar Apontamento' : 'Novo Apontamento'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium"> Registro diário de horímetro de equipamentos </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        {!editData && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-6 bg-zinc-50/30 dark:bg-zinc-900/30">
            <button 
              onClick={() => setActiveTab('form')}
              className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'form' ? 'border-blue-500 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
            >
              Manual
            </button>
            <button 
              onClick={() => setActiveTab('import')}
              className={`px-4 py-3 text-sm font-semibold transition-all border-b-2 ${activeTab === 'import' ? 'border-blue-500 text-blue-600' : 'border-transparent text-zinc-500 hover:text-zinc-700'}`}
            >
              Carga em Massa (Excel)
            </button>
          </div>
        )}

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
                {/* Equipamento */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Equipamento <span className="text-red-500">*</span></label>
                  <div className="relative">
                    <SearchableSelect 
                      name="equipamento_id"
                      options={equipamentos.map(eq => ({ value: eq.id, label: `${eq.placa} - ${eq.modelo}` }))}
                      value={form.equipamento_id}
                      onChange={val => setForm(prev => ({ ...prev, equipamento_id: val }))}
                    />
                  </div>
                </div>

                {/* Data */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Data Referência <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    name="data_referencia"
                    value={form.data_referencia}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                {/* Horímetro Inicial */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Horímetro Inicial <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="horimetro_inicial"
                    value={form.horimetro_inicial}
                    onChange={handleInputChange}
                    required
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>

                {/* Horímetro Final */}
                <div className="space-y-2">
                  <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Horímetro Final <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    name="horimetro_final"
                    value={form.horimetro_final}
                    onChange={handleInputChange}
                    required
                    step="0.1"
                    min="0"
                    placeholder="0.0"
                    className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                  />
                </div>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Observações</label>
                <textarea
                  name="observacoes"
                  value={form.observacoes}
                  onChange={handleInputChange}
                  rows={3}
                  placeholder="Registre qualquer anomalia ou observação relevante..."
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none font-medium"
                />
              </div>

              {/* Preview da diferença de horas */}
              {form.horimetro_inicial && form.horimetro_final && (
                 <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-xl">
                   <div className="flex justify-between items-center">
                     <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Horas Trabalhadas (Calculado):</span>
                     <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                       {(parseFloat(form.horimetro_final) - parseFloat(form.horimetro_inicial)).toFixed(1)} hrs
                     </span>
                   </div>
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
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm">
                    Utilize nossa planilha modelo para carregar múltiplos apontamentos de uma só vez.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={handleDownloadTemplate}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all group"
                >
                  <Download className="text-zinc-400 group-hover:text-blue-500" size={24} />
                  <div className="text-center">
                    <span className="block text-sm font-bold">1. Baixar Modelo</span>
                    <span className="text-xs text-zinc-400 font-medium">Arquivo Excel (.xlsx)</span>
                  </div>
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all group"
                >
                  <Upload className="text-zinc-400 group-hover:text-emerald-500" size={24} />
                  <div className="text-center">
                    <span className="block text-sm font-bold">2. Enviar Planilha</span>
                    <span className="text-xs text-zinc-400 font-medium">Selecione o arquivo preenchido</span>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".xlsx, .xls"
                    className="hidden"
                  />
                </button>
              </div>
              
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="flex gap-3">
                  <AlertCircle size={18} className="text-zinc-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">Dicas para Importação</h4>
                    <ul className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1 ml-4 list-disc font-medium">
                      <li>Use exatamente a <b>Placa</b> cadastrada no sistema.</li>
                      <li>Datas no formato <b>AAAA-MM-DD</b> ou Data do Excel.</li>
                      <li>Horímetros devem conter apenas números.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
          <div>
            {!editData && activeTab === 'form' && hasContent && (
              <button 
                onClick={clearDraft}
                className="text-xs font-semibold text-zinc-500 hover:text-red-500 flex items-center gap-1.5 transition-colors"
                title="Limpar rascunho salvo"
              >
                Limpar Rascunho
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-all"
            >
              Cancelar
            </button>
            {activeTab === 'form' && (
              <button 
                form="horimetro-form"
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save size={18} />
                )}
                {editData ? 'Salvar Edição' : 'Registrar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
