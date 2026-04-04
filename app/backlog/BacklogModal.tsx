'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Tag, 
  MapPin, 
  Wrench, 
  ShoppingCart, 
  Calendar,
  Layers,
  ArrowRight,
  Clock,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormDraft } from '@/hooks/use-form-draft'
import { upsertBacklogItem } from './actions'

// ─── Types and Config ────────────────────────────────────────────────────────
type Placa = { id: string; placa: string; modulo: string | null }

const STEPS = [
  { id: 1, label: "Identificação",  icon: Tag,          color: "bg-indigo-500",  text: "text-indigo-600" },
  { id: 2, label: "Localização",    icon: MapPin,        color: "bg-blue-500",    text: "text-blue-600"   },
  { id: 3, label: "Atividade",      icon: Wrench,        color: "bg-amber-500",   text: "text-amber-600"  },
  { id: 4, label: "Materiais & RC", icon: ShoppingCart,  color: "bg-emerald-500", text: "text-emerald-600"},
  { id: 5, label: "Programação",    icon: Calendar,      color: "bg-rose-500",    text: "text-rose-600"   },
]

const initialValues = {
  data_evidencia: new Date().toISOString().split('T')[0],
  status: 'Aberta',
  criticidade: 'B',
  semana: '', mes: '', ano: '', modulo: '', regiao_programa: '',
  frota: '', tag: '', tipo: '', descricao: '', origem: '',
  tempo_execucao: '', campo_base: '', os: '', material: '',
  nr_rc: '', nr_ordem: '', fornecedor: '', detalhamento: '',
  data_rc: '', data_nec_material: '', previsao_material: '',
  situacao_rc: '', dias_abertura: '', data_programacao: '',
  status_programacao: 'Não Programado', previsao_conclusao: '',
  data_conclusao: '', delta: '', dias_resolucao: '', observacao: ''
}

// ─── Component Helpers ────────────────────────────────────────────────────────
function Field({ label, children, span = 1 }: { label: string, children: React.ReactNode, span?: number }) {
  return (
    <div className={cn("space-y-1.5", span === 2 && "col-span-1 md:col-span-2")}>
       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{label}</label>
       {children}
    </div>
  )
}

const inputCls = "w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700"

export default function BacklogModal({ 
  isOpen, 
  onClose, 
  placas,
  editData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  placas: Placa[];
  editData?: any;
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const { form, setForm, clearDraft, hasContent } = useFormDraft('backlog', initialValues)

  useEffect(() => {
    if (editData) {
      setForm(editData)
    } else if (!form.data_evidencia) {
      // Garantir data atual se for novo e estiver vazio
      setForm(prev => ({ ...prev, data_evidencia: new Date().toISOString().split('T')[0] }))
    }
  }, [editData, setForm, form.data_evidencia])

  // Auto-preencher data de conclusão ao encerrar
  useEffect(() => {
    if (form.status === 'Encerrada' && !form.data_conclusao) {
      setForm(prev => ({ ...prev, data_conclusao: new Date().toISOString().split('T')[0] }))
    }
  }, [form.status, form.data_conclusao, setForm])

  if (!isOpen) return null

  const handleNext = () => step < 5 && setStep(step + 1)
  const handlePrev = () => step > 1 && setStep(step - 1)

  const handleSubmit = async () => {
    setLoading(true)
    const res = await upsertBacklogItem(form)
    if (res.success) {
      clearDraft()
      onClose()
    } else {
      alert("Erro: " + res.error)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row h-[90vh] overflow-hidden">
        
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 bg-zinc-50 dark:bg-zinc-900/50 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3 mb-6">
             <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
                <Layers size={22} />
             </div>
             <div>
               <h3 className="text-sm font-black tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">Gestão Backlog</h3>
               <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Procedimento</p>
             </div>
          </div>

          <div className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar">
            {STEPS.map((s, i) => {
              const active = step === s.id
              const done = step > s.id
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={cn(
                    "flex-1 md:flex-none flex items-center gap-3 p-3 rounded-2xl transition-all border outline-none",
                    active ? "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                    active ? s.color + " text-white" : done ? "bg-indigo-100 text-indigo-600" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"
                  )}>
                    {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                  </div>
                  <div className="hidden md:block text-left">
                     <span className={cn("block text-[10px] font-black uppercase tracking-tighter", active ? s.text : "text-zinc-400")}>Etapa {s.id}</span>
                     <span className={cn("text-xs font-bold whitespace-nowrap", active ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-500")}>{s.label}</span>
                  </div>
                </button>
              )
            })}
          </div>

          <div className="mt-auto hidden md:block">
             {hasContent && (
               <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <p>Rascunho automático ativo em seu navegador.</p>
                    <button onClick={clearDraft} className="mt-2 text-[10px] font-black underline hover:no-underline">LIMPAR AGORA</button>
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Form Body */}
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-zinc-950">
          
          <div className="p-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between">
             <div>
                <h2 className="text-xl font-black text-zinc-800 dark:text-zinc-100 tracking-tight">{STEPS[step-1].label}</h2>
                <p className="text-xs text-zinc-500 font-bold tracking-tight">Complete os campos obrigatórios para avançar</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-400 transition-colors">
               <X size={22} />
             </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto space-y-8 animate-in slide-in-from-bottom-2 duration-300">
               
               {step === 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Field label="Data de Evidência" span={2}>
                        <input className={inputCls} type="date" value={form.data_evidencia} onChange={e => setForm({...form, data_evidencia: e.target.value})} />
                     </Field>
                     <Field label="Criticidade">
                        <select className={inputCls} value={form.criticidade} onChange={e => setForm({...form, criticidade: e.target.value})}>
                          <option value="A">A - CRÍTICO</option>
                          <option value="B">B - ALTO</option>
                        </select>
                     </Field>
                     <Field label="Tipo">
                        <input className={inputCls} placeholder="Ex: Corretiva" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} />
                     </Field>
                     <Field label="Origem" span={2}>
                        <input className={inputCls} placeholder="Ex: Operador / Inspeção" value={form.origem} onChange={e => setForm({...form, origem: e.target.value})} />
                     </Field>
                  </div>
               )}

               {step === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Field label="Frota (Placa)" span={2}>
                        <select className={inputCls} value={form.frota} onChange={e => {
                          const eq = placas.find(p => p.placa === e.target.value);
                          setForm({...form, frota: e.target.value, modulo: eq?.modulo || ''});
                        }}>
                          <option value="">Selecione...</option>
                          {placas.map(p => <option key={p.id} value={p.placa}>{p.placa}</option>)}
                        </select>
                     </Field>
                     <Field label="Módulo">
                        <input className={inputCls} placeholder="Selecione a placa..." value={form.modulo} onChange={e => setForm({...form, modulo: e.target.value})} />
                     </Field>
                     <Field label="TAG">
                        <input className={inputCls} placeholder="Identificador" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} />
                     </Field>
                     <Field label="Campo / Base" span={2}>
                        <input className={inputCls} placeholder="Localização física" value={form.campo_base} onChange={e => setForm({...form, campo_base: e.target.value})} />
                     </Field>
                  </div>
               )}

               {step === 3 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Descrição da Atividade" span={2}>
                       <textarea className={cn(inputCls, "min-h-[120px] resize-none")} placeholder="Detalhe a falha detectada..." value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
                    </Field>
                    <Field label="Nº O.S (Opcional)">
                       <input className={inputCls} placeholder="Ex: 5042" value={form.os} onChange={e => setForm({...form, os: e.target.value})} />
                    </Field>
                    <Field label="Tempo Estimado">
                       <input className={inputCls} placeholder="Ex: 4h" value={form.tempo_execucao} onChange={e => setForm({...form, tempo_execucao: e.target.value})} />
                    </Field>
                    <Field label="Status Atual" span={2}>
                       <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                          <option value="Aberta">🟡 Aberta</option>
                          <option value="Em Andamento">🔵 Em Andamento</option>
                          <option value="Encerrada">✅ Encerrada</option>
                       </select>
                    </Field>
                 </div>
               )}

               {step === 4 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Field label="Material Necessário" span={2}>
                       <input className={inputCls} placeholder="Ex: Kit Vedação" value={form.material} onChange={e => setForm({...form, material: e.target.value})} />
                    </Field>
                    <Field label="Nº RC">
                       <input className={inputCls} placeholder="Nr Requisição" value={form.nr_rc} onChange={e => setForm({...form, nr_rc: e.target.value})} />
                    </Field>
                    <Field label="Fornecedor">
                       <input className={inputCls} placeholder="Nome Fornecedor" value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} />
                    </Field>
                    <Field label="Situacao RC" span={2}>
                       <input className={inputCls} placeholder="Ex: Autorizado" value={form.situacao_rc} onChange={e => setForm({...form, situacao_rc: e.target.value})} />
                    </Field>
                 </div>
               )}

               {step === 5 && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Field label="Previsão Programação">
                         <input className={inputCls} type="date" value={form.data_programacao || ''} onChange={e => setForm({...form, data_programacao: e.target.value})} />
                     </Field>
                     <Field label="Status Programação">
                         <select className={inputCls} value={form.status_programacao || 'Não Programado'} onChange={e => setForm({...form, status_programacao: e.target.value})}>
                            <option>Não Programado</option>
                            <option>Programado</option>
                            <option>Executado</option>
                         </select>
                     </Field>
                     <Field label="Data de Conclusão (Opcional)">
                        <input 
                          className={inputCls} 
                          type="date" 
                          value={form.data_conclusao || ''} 
                          onChange={e => setForm({...form, data_conclusao: e.target.value})} 
                        />
                     </Field>
                     <Field label="Previsão Conclusão">
                        <input className={inputCls} type="date" value={form.previsao_conclusao || ''} onChange={e => setForm({...form, previsao_conclusao: e.target.value})} />
                     </Field>
                     <Field label="Observações de Programação" span={2}>
                        <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={form.observacao || ''} onChange={e => setForm({...form, observacao: e.target.value})} />
                     </Field>
                    <div className="col-span-2 p-6 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 text-center">
                       <p className="text-sm font-black text-zinc-900 dark:text-zinc-100">Pronto para salvar no sistema?</p>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Todos os dados serão sincronizados agora</p>
                    </div>
                 </div>
               )}

            </div>
          </div>

          {/* Footer Controls */}
          <div className="p-8 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
             <button
               onClick={handlePrev}
               disabled={step === 1}
               className="flex items-center gap-2 px-6 py-2.5 text-sm font-black text-zinc-500 hover:text-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
             >
               <ChevronLeft size={18} /> ANTERIOR
             </button>
             
             <div className="flex gap-1.5 overflow-hidden">
                {[1,2,3,4,5].map(s => (
                  <div key={s} className={cn("h-1.5 rounded-full transition-all duration-500", step === s ? "w-8 bg-indigo-500" : s < step ? "w-3 bg-indigo-200" : "w-1.5 bg-zinc-200 dark:bg-zinc-800")} />
                ))}
             </div>

             {step < 5 ? (
               <button
                 onClick={handleNext}
                 className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-500/20 active:scale-95 transition-all group"
               >
                 AVANÇAR <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
               </button>
             ) : (
               <button
                 onClick={handleSubmit}
                 disabled={loading}
                 className="flex items-center gap-2 px-10 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-500/30 transition-all font-bold"
               >
                 {loading ? <Clock size={16} className="animate-spin" /> : "CONCLUIR BACKLOG"}
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  )
}
