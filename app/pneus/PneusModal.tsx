'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Save, AlertCircle, Info, ChevronDown, Camera, FileDown, CheckCircle2, Eye } from 'lucide-react'
import { registrarInspecaoCompleta, atualizarInspecao } from './actions'
import { useFormDraft } from '@/hooks/use-form-draft'
import { useOffline } from '@/components/offline-provider'
import { localDb, serializeFormData } from '@/lib/offline-db'
import { SearchableSelect } from '@/components/SearchableSelect'
import { gerarFichaPneusPDF, gerarHtmlFichaPneus } from './pdfBoletim'
import FichaPreviewModal from '@/components/FichaPreviewModal'
import { useAuth } from '@/components/auth-context'

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

// Cada posição tem 3 pontos de medição do sulco: Sulco 1 (lado direito), Sulco 2 (meio —
// é o campo sem sufixo, o mesmo que já existia e alimenta o Dashboard/gráficos principais)
// e Sulco 3 (lado esquerdo). Essa lista achatada é usada pra montar o estado do formulário
// e pra ler/parsear os valores de forma genérica, em vez de repetir os 33 campos à mão.
const SULCO_FIELDS: string[] = POSI_LABELS.flatMap(([, key]) => [`${key}_s1`, key, `${key}_s3`])

const getCurrentLocalDatetime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const INITIAL_FORM: Record<string, string> = {
  equipamento_id: '',
  data_inspecao: getCurrentLocalDatetime(),
  km_atual: '',
  horimetro_registro: '',
  condicao: 'BOM',
  observacoes: '',
  ...Object.fromEntries(SULCO_FIELDS.map(f => [f, '']))
}

// Converte os campos de sulco do form (strings) pra número (ou null se vazio) — usado
// tanto pra montar o payload offline quanto o cache local otimista.
function parseSulcosForm(form: Record<string, string>) {
  const out: Record<string, number | null> = {}
  for (const f of SULCO_FIELDS) out[f] = form[f] ? parseFloat(form[f]) : null
  return out
}

export default function PneusModal({ 
  isOpen, 
  onClose, 
  equipamentos, 
  editData, 
  onSuccess 
}: PneusModalProps) {
  const { isOnline } = useOffline()
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Preenchido só após salvar com sucesso — troca o formulário pela tela de "Boletim
  // registrado" com a opção de baixar a ficha em PDF.
  const [savedRecord, setSavedRecord] = useState<any | null>(null)
  const [showPreview, setShowPreview] = useState(false)

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
        horimetro_registro: editData.horimetro_registro?.toString() || '',
        condicao: editData.condicao || 'BOM',
        observacoes: editData.observacoes || '',
        ...Object.fromEntries(SULCO_FIELDS.map(f => [f, editData[f] != null ? String(editData[f]) : '']))
      })
    } else if (isLoaded && !hasContent) {
      setForm(INITIAL_FORM)
    }
  }, [editData, isLoaded, setForm])

  // --- Automatic Condition Analysis ---
  // Considera o pior valor entre os 3 sulcos (direito/meio/esquerdo) de todas as posições —
  // um lado bem desgastado não pode passar despercebido só porque o meio ainda está bom.
  useEffect(() => {
    const values = SULCO_FIELDS.map(k => parseFloat((form as any)[k])).filter(v => !isNaN(v));

    if (values.length === 0) return;

    const min = Math.min(...values);
    let autoCond = 'BOM';
    if (min < 3) autoCond = 'TROCAR';
    else if (min <= 5) autoCond = 'CRITICO';
    else if (min <= 9) autoCond = 'REGULAR';

    if (form.condicao !== autoCond) {
      setForm(prev => ({ ...prev, condicao: autoCond }));
    }
  }, [...SULCO_FIELDS.map(f => (form as any)[f])]);

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      Object.entries(form).forEach(([key, value]) => formData.append(key, value))

      const eq = equipamentos.find(eq => eq.id === form.equipamento_id)
      // Nome de quem está registrando, pra mostrar/gerar a ficha mesmo offline (sem servidor
      // pra devolver o registrado_por_nome calculado lá) — o valor de verdade, gravado no
      // banco, é sempre o do usuário autenticado no momento em que o servidor processa.
      const registradoPorLocal = (profile as any)?.full_name || (profile as any)?.nome || null

      const handleSaveOffline = async () => {
        const serialized = serializeFormData(formData)

        if (editData?.id) {
          // Editar offline
          const updated = {
            ...editData,
            ...form,
            km_atual: form.km_atual ? parseFloat(form.km_atual) : null,
            horimetro_registro: form.horimetro_registro ? parseFloat(form.horimetro_registro) : null,
            ...parseSulcosForm(form),
            equipamentos: eq ? { placa: eq.placa, tipo: eq.tipo } : editData.equipamentos,
            _isPendingSync: true
          }
          await localDb.put("pneus_inspecao", updated)
          await localDb.addToQueue("pneu", "update", { id: editData.id, ...serialized })
          setSavedRecord(updated)
        } else {
          // Criar offline
          const tempId = `temp_pneu_${Date.now()}`
          const newInspecao = {
            id: tempId,
            ...form,
            km_atual: form.km_atual ? parseFloat(form.km_atual) : null,
            horimetro_registro: form.horimetro_registro ? parseFloat(form.horimetro_registro) : null,
            ...parseSulcosForm(form),
            registrado_por_nome: registradoPorLocal,
            equipamentos: eq ? { placa: eq.placa, tipo: eq.tipo } : undefined,
            _isPendingSync: true
          }
          await localDb.put("pneus_inspecao", newInspecao)
          await localDb.addToQueue("pneu", "create", serialized)
          setSavedRecord(newInspecao)
        }

        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"))
        window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"))

        clearDraft()
        onSuccess()
      };

      if (isOnline) {
        try {
          let result
          if (editData?.id) {
            result = await atualizarInspecao(editData.id, formData)
          } else {
            result = await registrarInspecaoCompleta(formData)
          }

          if (result && 'error' in result) {
            console.warn("[Pneus] Falha ao salvar online, tentando offline...", result.error);
            await handleSaveOffline();
          } else {
            // O servidor devolve o registro já salvo (com id gerado, nome de quem registrou
            // e placa do equipamento) — evita uma segunda consulta só pra gerar a ficha.
            const saved = (result as any)?.data
            const newLocal = saved || {
              id: editData?.id || `ins_${Date.now()}`,
              ...form,
              km_atual: form.km_atual ? parseFloat(form.km_atual) : null,
              horimetro_registro: form.horimetro_registro ? parseFloat(form.horimetro_registro) : null,
              ...parseSulcosForm(form),
              registrado_por_nome: registradoPorLocal,
              equipamentos: eq ? { placa: eq.placa, tipo: eq.tipo } : undefined
            }
            await localDb.put("pneus_inspecao", newLocal)
            window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"))

            clearDraft()
            onSuccess()
            setSavedRecord(newLocal)
          }
        } catch (err: any) {
          console.error("[Pneus] Erro critico no salvamento online, caindo para offline:", err);
          await handleSaveOffline();
        }
      } else {
        await handleSaveOffline();
      }
    } catch (err) {
      setError('Erro ao processar requisição.')
    } finally {
      setLoading(false)
    }
  }

  // Fecha o modal e limpa o estado de "sucesso" pra próxima vez que for aberto (registrar
  // um novo boletim) mostrar o formulário em vez da tela de ficha salva.
  const handleClose = () => {
    setSavedRecord(null)
    setShowPreview(false)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      // Não interromper Enter em botões ou textareas
      if (target.tagName.toLowerCase() === 'textarea' || target.tagName.toLowerCase() === 'button' || target.getAttribute('type') === 'file') {
        return;
      }
      e.preventDefault();
      const form = e.currentTarget;
      const elements = Array.from(form.elements).filter(
        el => (el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement || el instanceof HTMLButtonElement) && !(el as any).disabled
      ) as HTMLElement[];
      const index = elements.indexOf(target);
      if (index > -1 && elements[index + 1]) {
        elements[index + 1].focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300 overflow-y-auto">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col my-4 max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
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
            onClick={handleClose}
            className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-full transition-colors text-zinc-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {savedRecord ? (
          <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-full shadow-inner">
              <CheckCircle2 size={40} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold tracking-tight">Boletim registrado com sucesso!</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                {savedRecord.equipamentos?.placa && <>Placa <span className="font-bold text-zinc-700 dark:text-zinc-300">{savedRecord.equipamentos.placa}</span> · </>}
                Registrado por <span className="font-bold text-zinc-700 dark:text-zinc-300">{savedRecord.registrado_por_nome || 'Você'}</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl transition-all"
              >
                <Eye size={18} />
                Ver Ficha
              </button>
              <button
                onClick={() => gerarFichaPneusPDF(savedRecord)}
                className="flex items-center gap-2 px-6 py-3 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all"
              >
                <FileDown size={18} />
                Baixar Ficha em PDF
              </button>
            </div>
          </div>
        ) : (
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-3 text-red-600 dark:text-red-400 animate-in slide-in-from-top-2">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <form id="pneus-form" onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex flex-col gap-1.5 md:flex-1 md:min-w-[180px]">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Equipamento *</label>
                <div className="relative">
                  <SearchableSelect 
                    name="equipamento_id"
                    options={equipamentos.map(eq => ({ value: eq.id, label: eq.placa }))}
                    value={form.equipamento_id}
                    onChange={val => setForm(prev => ({ ...prev, equipamento_id: val }))}
                    placeholder="Selecione"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 md:w-auto shrink-0">
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
              <div className="flex flex-col gap-1.5 md:w-1/4">
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
              <div className="flex flex-col gap-1.5 md:w-1/4">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Horímetro</label>
                <input 
                  name="horimetro_registro" 
                  type="number" 
                  value={form.horimetro_registro}
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

              {/* Cada posição tem 3 medições: Sulco 1 (lado direito), Sulco 2 (meio — campo
                  sem sufixo, o mesmo do Dashboard/gráficos principais) e Sulco 3 (lado
                  esquerdo). Isso ajuda a identificar desgaste irregular de um lado só. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POSI_LABELS.map(([label, key]) => (
                  <div
                    key={key}
                    className="flex flex-col gap-1.5 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all focus-within:ring-2 focus-within:ring-orange-500/30 focus-within:border-orange-500"
                  >
                    <span className="text-[10px] font-black text-orange-500 dark:text-orange-400">{label}</span>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Dir.</span>
                        <input
                          name={`${key}_s1`}
                          type="number"
                          step="0.1"
                          min="0"
                          value={form[`${key}_s1` as keyof typeof form]}
                          onChange={handleInputChange}
                          placeholder="--"
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-sm w-full outline-none text-zinc-900 dark:text-zinc-100 font-bold placeholder-zinc-300 dark:placeholder-zinc-700"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Meio</span>
                        <input
                          name={key}
                          type="number"
                          step="0.1"
                          min="0"
                          value={form[key as keyof typeof form]}
                          onChange={handleInputChange}
                          placeholder="--"
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-sm w-full outline-none text-zinc-900 dark:text-zinc-100 font-bold placeholder-zinc-300 dark:placeholder-zinc-700"
                        />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wide">Esq.</span>
                        <input
                          name={`${key}_s3`}
                          type="number"
                          step="0.1"
                          min="0"
                          value={form[`${key}_s3` as keyof typeof form]}
                          onChange={handleInputChange}
                          placeholder="--"
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1.5 text-sm w-full outline-none text-zinc-900 dark:text-zinc-100 font-bold placeholder-zinc-300 dark:placeholder-zinc-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col gap-1.5 md:w-1/3">
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
              <div className="flex flex-col gap-1.5 md:w-1/3">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                   <Camera size={14} className="text-orange-500" /> Câmera / Foto
                </label>
                <div className="relative flex items-center">
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    className="w-full text-[10px] sm:text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-orange-500/10 file:text-orange-600 hover:file:bg-orange-500/20 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 md:w-1/3">
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
        )}

        {/* Footer */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
          {savedRecord ? (
            <div className="flex justify-end w-full">
              <button
                onClick={handleClose}
                className="px-8 py-2.5 text-sm font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-xl shadow-lg shadow-orange-500/20 transition-all"
              >
                Fechar
              </button>
            </div>
          ) : (
          <>
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
              onClick={handleClose}
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
          </>
          )}
        </div>
      </div>

      {showPreview && savedRecord && (
        <FichaPreviewModal
          html={gerarHtmlFichaPneus(savedRecord)}
          onClose={() => setShowPreview(false)}
          onDownload={() => gerarFichaPneusPDF(savedRecord)}
        />
      )}
    </div>
  )
}
