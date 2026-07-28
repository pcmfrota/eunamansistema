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
import { useOffline } from '@/components/offline-provider'
import { localDb } from '@/lib/offline-db'
import { SearchableSelect } from '@/components/SearchableSelect'

// ─── Types and Config ────────────────────────────────────────────────────────
type Placa = { id: string; placa: string; modulo: string | null }

const STEPS = [
  { id: 1, label: "Identificação",  icon: Tag,          color: "bg-indigo-500",  text: "text-indigo-600" },
  { id: 2, label: "Localização",    icon: MapPin,        color: "bg-blue-500",    text: "text-blue-600"   },
  { id: 3, label: "Atividade",      icon: Wrench,        color: "bg-amber-500",   text: "text-amber-600"  },
  { id: 4, label: "Materiais & RC", icon: ShoppingCart,  color: "bg-emerald-500", text: "text-emerald-600"},
  { id: 5, label: "Programação",    icon: Calendar,      color: "bg-rose-500",    text: "text-rose-600"   },
]

const getCurrentLocalDatetime = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const initialValues = {
  data_evidencia: getCurrentLocalDatetime(),
  status: 'PENDENTE',
  criticidade: 'B',
  semana: '', mes: '', ano: '', modulo: '', regiao_programa: '',
  frota: '', tag: '', tipo: '', descricao: '', origem: '',
  colaborador: '',
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

type Colaborador = { id: string; nome: string }

export default function BacklogModal({ 
  isOpen, 
  onClose, 
  placas,
  colaboradores,
  editData 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  placas: Placa[];
  colaboradores: Colaborador[];
  editData?: any;
}) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const isSubmitting = useRef(false)
  const { isOnline } = useOffline()
  const { form, setForm, clearDraft, hasContent } = useFormDraft('backlog', initialValues)

  useEffect(() => {
    if (editData) {
      setForm(editData)
    } else if (!form.data_evidencia) {
      // Garantir data atual se for novo e estiver vazio
      setForm(prev => ({ ...prev, data_evidencia: getCurrentLocalDatetime() }))
    }
  }, [editData, setForm, form.data_evidencia])

  // Auto-preencher data de conclusão ao encerrar
  useEffect(() => {
    if (form.status === 'ENCERRADO' && !form.data_conclusao) {
      setForm(prev => ({ ...prev, data_conclusao: getCurrentLocalDatetime() }))
    }
  }, [form.status, form.data_conclusao, setForm])

  // Helper para interpretar o valor salvo em tempo_execucao para Horas e Minutos
  const parseTempoToHM = (val: string) => {
    if (!val) return { horas: '', minutos: '' };
    const str = val.toLowerCase().trim();

    // Match "4h 30m" ou "4h30m"
    const matchHM = str.match(/^(\d+)\s*h(?:oras?)?\s*(?:(\d+)\s*m(?:in)?)?$/i);
    if (matchHM) {
      return { horas: matchHM[1] || '', minutos: matchHM[2] || '' };
    }

    // Match "30m" ou "30min"
    const matchM = str.match(/^(\d+)\s*m(?:in)?$/i);
    if (matchM) {
      return { horas: '', minutos: matchM[1] || '' };
    }

    // Match "4h" ou "4" ou "4.5h"
    const matchH = str.match(/^(\d+(?:[.,]\d+)?)\s*h?$/i);
    if (matchH) {
      const num = parseFloat(matchH[1].replace(',', '.'));
      if (!isNaN(num)) {
        const h = Math.floor(num);
        const m = Math.round((num - h) * 60);
        return { horas: h > 0 ? String(h) : '', minutos: m > 0 ? String(m) : '' };
      }
    }
    return { horas: '', minutos: '' };
  };

  const currentTempoHM = parseTempoToHM(form.tempo_execucao || '');

  const handleTempoHMChange = (hVal: string, mVal: string) => {
    const h = hVal !== '' ? parseInt(hVal, 10) : NaN;
    const m = mVal !== '' ? parseInt(mVal, 10) : NaN;

    let str = '';
    if (!isNaN(h) && h > 0 && !isNaN(m) && m > 0) {
      str = `${h}h ${m}m`;
    } else if (!isNaN(h) && h > 0) {
      str = `${h}h`;
    } else if (!isNaN(m) && m > 0) {
      str = `${m}m`;
    } else if (!isNaN(h) && h === 0 && !isNaN(m) && m > 0) {
      str = `${m}m`;
    } else if (!isNaN(h) && h >= 0) {
      str = `${h}h`;
    }

    setForm(prev => ({ ...prev, tempo_execucao: str }));
  };

  // Helper para formatar a data para o input datetime-local permitindo edição total de data e hora
  const formatToDatetimeLocal = (val?: string | null): string => {
    if (!val) return getCurrentLocalDatetime();
    const str = String(val).trim();
    // Se estiver em formato DD/MM/YYYY HH:mm ou DD/MM/YYYYTHH:mm
    const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\sT](\d{2}):(\d{2}))?/);
    if (matchBr) {
      const [, d, m, y, hh, mm] = matchBr;
      return `${y}-${m}-${d}T${hh || '00'}:${mm || '00'}`;
    }
    // Se estiver em formato YYYY-MM-DD HH:mm
    const matchIsoSpace = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (matchIsoSpace) {
      return `${matchIsoSpace[1]}T${matchIsoSpace[2]}`;
    }
    // Se já for YYYY-MM-DDTHH:mm...
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      return str.slice(0, 16);
    }
    // Fallback com Date
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    }
    return getCurrentLocalDatetime();
  };

  // Filtrar apenas veículos pesados e ativos
  const heavyActivePlacas = React.useMemo(() => {
    return (placas || []).filter(p => {
      if ((p as any).deleted_at) return false;
      const cat = ((p as any).categoria || 'PESADA').toString().toUpperCase();
      const isPesada = cat === 'PESADA' || cat === 'FROTA PESADA' || cat.includes('PESADA');
      const st = ((p as any).status || 'ATIVO').toString().toUpperCase();
      const isAtivo = st !== 'INATIVO' && st !== 'BAIXADO' && st !== 'DESATIVADO';
      return isPesada && isAtivo;
    });
  }, [placas]);

  if (!isOpen) return null

  const handleNext = () => step < 5 && setStep(step + 1)
  const handlePrev = () => step > 1 && setStep(step - 1)

  const handleSubmit = async () => {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)

    try {
      if (isOnline) {
        const res = await upsertBacklogItem(form)

        if (res.error) {
          alert('Erro ao salvar: ' + res.error)
          return
        }

        // Salva cópia atualizada no banco local (não-crítico)
        try {
          await localDb.put('backlog', res.data || form)
        } catch (cacheErr) {
          console.warn('[Cache] Falha ao atualizar IndexedDB:', cacheErr)
        }

        window.dispatchEvent(new CustomEvent('offline-db-updated-backlog'))
        clearDraft()
        onClose()
      } else {
        // Cenário offline
        const localItem = {
          ...form,
          id: form.id || `temp_backlog_${Date.now()}`,
          _isPendingSync: true
        }
        await localDb.put('backlog', localItem)
        await localDb.addToQueue('backlog', editData ? 'update' : 'create', localItem)

        window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'))
        window.dispatchEvent(new CustomEvent('offline-db-updated-backlog'))
        clearDraft()
        onClose()
      }
    } catch (error: any) {
      console.error('Erro inesperado ao concluir backlog:', error)
      alert('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
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
                        <div className="flex items-center gap-2">
                           <input
                              className={cn(inputCls, "flex-1 font-mono")}
                              type="datetime-local"
                              value={formatToDatetimeLocal(form.data_evidencia)}
                              onChange={e => setForm({...form, data_evidencia: e.target.value})}
                           />
                           <button
                              type="button"
                              onClick={() => setForm({...form, data_evidencia: getCurrentLocalDatetime()})}
                              className="px-3 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 rounded-xl text-xs font-black uppercase tracking-wider border border-zinc-200 dark:border-zinc-700 transition-colors shrink-0"
                              title="Inserir data e hora atual"
                           >
                              Agora
                           </button>
                        </div>
                     </Field>
                     <Field label="Criticidade">
                        <select className={inputCls} value={form.criticidade} onChange={e => setForm({...form, criticidade: e.target.value})}>
                          <option value="A">A - CRÍTICO</option>
                          <option value="B">B - NORMAL</option>
                        </select>
                     </Field>
                     <Field label="Tipo">
                        <input className={inputCls} placeholder="Ex: Corretiva" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} />
                     </Field>
                     <Field label="Colaborador / Mecânico">
                        <SearchableSelect 
                          options={(colaboradores || []).map(c => ({ value: c.nome, label: c.nome }))}
                          value={form.colaborador || ''} 
                          onChange={val => setForm({...form, colaborador: val})}
                        />
                     </Field>
                     <Field label="Origem">
                        <input className={inputCls} placeholder="Ex: Operador / Inspeção" value={form.origem} onChange={e => setForm({...form, origem: e.target.value})} />
                     </Field>
                  </div>
               )}

               {step === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <Field label="Frota (Placa)" span={2}>
                        <SearchableSelect 
                          options={heavyActivePlacas.map(p => ({ value: p.placa, label: `${p.placa}${p.modulo ? ` (${p.modulo})` : ''}` }))}
                          value={form.frota} 
                          onChange={val => {
                            const eq = heavyActivePlacas.find(p => p.placa === val);
                            setForm({...form, frota: val, modulo: eq?.modulo || ''});
                          }}
                        />
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
                        <div className="flex flex-col gap-2">
                           <div className="flex items-center gap-2">
                              {/* Horas */}
                              <div className="flex-1 relative">
                                 <input
                                    type="number"
                                    min="0"
                                    max="999"
                                    placeholder="0"
                                    className={cn(inputCls, "pr-8 font-mono")}
                                    value={currentTempoHM.horas}
                                    onChange={(e) => handleTempoHMChange(e.target.value, currentTempoHM.minutos)}
                                 />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">h</span>
                              </div>

                              <span className="font-black text-zinc-400 text-sm">:</span>

                              {/* Minutos */}
                              <div className="flex-1 relative">
                                 <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    placeholder="0"
                                    className={cn(inputCls, "pr-12 font-mono")}
                                    value={currentTempoHM.minutos}
                                    onChange={(e) => handleTempoHMChange(currentTempoHM.horas, e.target.value)}
                                 />
                                 <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-400 pointer-events-none">min</span>
                              </div>
                           </div>

                           {/* Presets Rápidos */}
                           <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider mr-0.5">Rápido:</span>
                              {['30m', '1h', '2h', '4h', '8h', '12h'].map((preset) => (
                                 <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, tempo_execucao: preset }))}
                                    className={cn(
                                       "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border",
                                       form.tempo_execucao === preset
                                          ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                                    )}
                                 >
                                    {preset}
                                 </button>
                              ))}
                           </div>
                        </div>
                     </Field>
                    <Field label="Status Atual" span={2}>
                       <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                          <option value="PENDENTE">🟡 PENDENTE</option>
                          <option value="PROGRAMADO">🟢 PROGRAMADO</option>
                          <option value="ENCERRADO">✅ ENCERRADO</option>
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
                         <input className={inputCls} type="datetime-local" value={form.data_programacao || ''} onChange={e => setForm({...form, data_programacao: e.target.value})} />
                     </Field>
                     <Field label="Status Programação">
                         <select className={inputCls} value={form.status_programacao || 'Não Programado'} onChange={e => setForm({...form, status_programacao: e.target.value})}>
                            <option>Não Programado</option>
                            <option>Em aberto</option>
                            <option>Programado</option>
                            <option>Executado</option>
                         </select>
                     </Field>
                     <Field label="Data de Conclusão (Opcional)">
                        <input 
                          className={inputCls} 
                          type="datetime-local" 
                          value={form.data_conclusao || ''} 
                          onChange={e => setForm({...form, data_conclusao: e.target.value})} 
                        />
                     </Field>
                     <Field label="Previsão Conclusão">
                        <input className={inputCls} type="datetime-local" value={form.previsao_conclusao || ''} onChange={e => setForm({...form, previsao_conclusao: e.target.value})} />
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
                 className="flex items-center gap-2 px-10 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
               >
                 {loading ? <><Clock size={16} className="animate-spin" /> Salvando...</> : 'CONCLUIR BACKLOG'}
               </button>
             )}
          </div>

        </div>
      </div>
    </div>
  )
}
