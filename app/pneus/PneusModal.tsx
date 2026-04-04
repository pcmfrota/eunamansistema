'use client'

import { useState, useEffect } from 'react'
import { X, Save, AlertCircle, Info, ChevronDown } from 'lucide-react'
import { registrarInspecaoCompleta, atualizarInspecao } from './actions'
import { useFormDraft } from '@/hooks/use-form-draft'

interface PneusModalProps {
  isOpen: boolean
  onClose: () => void
  equipamentos: any[]
  editData?: any
  onSuccess: () => void
}

const POSI_LABELS: [string, string][] = [
  ["DE", "de"], ["DD", "dd"],
  ["TEI", "tei"], ["TEE", "tee"],
  ["TDI", "tdi"], ["TDE", "tde"],
  ["TEI1", "tei1"], ["TEE1", "tee1"],
  ["TDI1", "tdi1"], ["TDE1", "tde1"],
  ["ESTEPE", "estepe"],
]

const getCurrentLocalDatetime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const INITIAL_FORM = {
  equipamento_id: '',
  data_inspecao: getCurrentLocalDatetime(),
  km_atual: '',
  condicao: 'BOM',
  observacoes: '',
  de: '', dd: '', tei: '', tee: '', tdi: '', tde: '',
  tei1: '', tee1: '', tdi1: '', tde1: '', estepe: ''
}

export default function PneusModal({ 
  isOpen, 
  onClose, 
  equipamentos, 
  editData, 
  onSuccess 
}: PneusModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { 
    form, 
    setForm, 
    handleInputChange, 
    clearDraft, 
    hasContent, 
    isLoaded 
  } = useFormDraft(editData ? null : 'pneus-new', INITIAL_FORM)

  useEffect(() => {
    if (editData) {
      setForm({
        equipamento_id: editData.equipamento_id || '',
        data_inspecao: editData.data_inspecao?.slice(0, 16) || INITIAL_FORM.data_inspecao,
        km_atual: editData.km_atual?.toString() || '',
        condicao: editData.condicao || 'BOM',
        observacoes: editData.observacoes || '',
        de: editData.de?.toString() || '',
        dd: editData.dd?.toString() || '',
        tei: editData.tei?.toString() || '',
        tee: editData.tee?.toString() || '',
        tdi: editData.tdi?.toString() || '',
        tde: editData.tde?.toString() || '',
        tei1: editData.tei1?.toString() || '',
        tee1: editData.tee1?.toString() || '',
        tdi1: editData.tdi1?.toString() || '',
        tde1: editData.tde1?.toString() || '',
        estepe: editData.estepe?.toString() || ''
      })
    } else if (isLoaded && !hasContent) {
      setForm(INITIAL_FORM)
    }
  }, [editData, isLoaded, setForm])

  // --- Automatic Condition Analysis ---
  useEffect(() => {
    const fields = ['de', 'dd', 'tei', 'tee', 'tdi', 'tde', 'tei1', 'tee1', 'tdi1', 'tde1', 'estepe'];
    const values = fields.map(k => parseFloat((form as any)[k])).filter(v => !isNaN(v));
    
    if (values.length === 0) return;

    const min = Math.min(...values);
    let autoCond = 'BOM';
    if (min < 3) autoCond = 'TROCAR';
    else if (min <= 5) autoCond = 'CRITICO';
    else if (min <= 9) autoCond = 'REGULAR';

    if (form.condicao !== autoCond) {
      setForm(prev => ({ ...prev, condicao: autoCond }));
    }
  }, [form.de, form.dd, form.tei, form.tee, form.tdi, form.tde, form.tei1, form.tee1, form.tdi1, form.tde1, form.estepe]);

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
        result = await atualizarInspecao(editData.id, formData)
      } else {
        result = await registrarInspecaoCompleta(formData)
      }

      if (result && 'error' in result) {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col my-8 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400 rounded-xl shadow-inner">
               <Info size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {editData ? 'Editar Inspeção' : 'Novo Boletim de Pneu'}
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium"> Controle detalhado de sulcos por posição </p>
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
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="pneus-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Equipamento *</label>
                <div className="relative">
                  <select 
                    name="equipamento_id" 
                    value={form.equipamento_id}
                    onChange={handleInputChange}
                    required 
                    className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none font-medium"
                  >
                    <option value="">Selecione</option>
                    {equipamentos.map(eq => <option key={eq.id} value={eq.id}>{eq.placa}</option>)}
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Data *</label>
                <input 
                  name="data_inspecao" 
                  type="datetime-local" 
                  value={form.data_inspecao}
                  onChange={handleInputChange}
                  required 
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none font-medium text-zinc-900 dark:text-zinc-100" 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Km Atual</label>
                <input 
                  name="km_atual" 
                  type="number" 
                  value={form.km_atual}
                  onChange={handleInputChange}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none font-medium text-zinc-900 dark:text-zinc-100" 
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em]">Sulcos por Posição (mm)</h3>
                <span className="text-[10px] text-zinc-400 italic font-medium">* Deixe vazio se não aplicável</span>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {POSI_LABELS.map(([label, key]) => (
                  <div 
                    key={key} 
                    className={`flex flex-col gap-1 pill-group group ${key === 'estepe' ? 'col-span-2 sm:col-span-1' : ''}`}
                  >
                    <div className="flex items-center gap-2 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all group-within:ring-2 group-within:ring-orange-500/30 group-within:border-orange-500">
                      <span className="text-[10px] font-black text-orange-500 dark:text-orange-400 w-8 shrink-0 text-center border-r border-zinc-200 dark:border-zinc-800 mr-2">{label}</span>
                      <input 
                        name={key} 
                        type="number" 
                        step="0.1" 
                        min="0" 
                        value={form[key as keyof typeof form]}
                        onChange={handleInputChange}
                        placeholder="--" 
                        className="bg-transparent text-sm w-full outline-none text-zinc-900 dark:text-zinc-100 font-bold placeholder-zinc-300 dark:placeholder-zinc-700" 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Condição Geral</label>
                <div className="relative">
                  <select 
                    name="condicao" 
                    value={form.condicao}
                    onChange={handleInputChange}
                    className="w-full pl-3 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none font-bold"
                  >
                    <option value="BOM">BOM</option>
                    <option value="REGULAR">REGULAR</option>
                    <option value="CRITICO">CRÍTICO</option>
                    <option value="TROCAR">TROCAR</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Observações</label>
                <textarea 
                  name="observacoes" 
                  value={form.observacoes}
                  onChange={handleInputChange}
                  rows={1} 
                  placeholder="Notas adicionais..." 
                  className="w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none resize-none font-medium h-[42px]" 
                />
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
          <div>
            {!editData && hasContent && (
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
            <button 
              form="pneus-form"
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {editData ? 'Salvar Edição' : 'Registrar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
