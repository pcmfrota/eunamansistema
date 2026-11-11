// @ts-nocheck
'use client'

// Redesenho nativo (Fase 5) — mesma lógica de negócio do BacklogModal original (ver
// app/backlog/BacklogModal.tsx), só a casca visual mudou de modal centralizado
// (fixed inset-0 h-[90vh]) pra BottomSheet fullHeight. O wizard de 5 passos continua
// igual, só o indicador de passos virou uma faixa horizontal (sempre visível, não só em
// telas largas) em vez de sidebar lateral.
import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Tag,
  MapPin,
  Wrench,
  ShoppingCart,
  Calendar,
  Clock,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormDraft } from '@/hooks/use-form-draft'
import { upsertBacklogItem } from './actions'
import { useOffline } from '@/components/offline-provider'
import { localDb } from '@/lib/offline-db'
import { SearchableSelect } from '@/components/SearchableSelect'
import { useNativeCamera, compressPhoto } from '../../lib/nativeCamera'
import { BottomSheet } from '../../ui/primitives/BottomSheet'
import { useToast } from '../../ui/primitives/Toast'
import { Camera, Image as ImageIcon, Maximize2, X } from 'lucide-react'

// ─── Types and Config ────────────────────────────────────────────────────────
type Placa = { id: string; placa: string; modulo: string | null; area?: string | null }

const STEPS = [
  { id: 1, label: "Identificação",  icon: Tag,          color: "bg-indigo-600" },
  { id: 2, label: "Localização",    icon: MapPin,        color: "bg-blue-600"   },
  { id: 3, label: "Atividade",      icon: Wrench,        color: "bg-amber-600"  },
  { id: 4, label: "Materiais & RC", icon: ShoppingCart,  color: "bg-emerald-600"},
  { id: 5, label: "Programação",    icon: Calendar,      color: "bg-rose-600"   },
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
  nr_rc: '', nr_ordem: '', fornecedor: '', detalhamento: 'AG. REQUISIÇÃO',
  data_rc: '', data_nec_material: '', previsao_material: '',
  situacao_rc: '', dias_abertura: '', data_programacao: '',
  status_programacao: 'Não Programado', previsao_conclusao: '',
  data_conclusao: '', delta: '', dias_resolucao: '', observacao: '',
  evidencia_imagens: [] as string[],
  evidencia_imagens_conclusao: [] as string[],
}

// ─── Component Helpers ────────────────────────────────────────────────────────
function Field({ label, children, span = 1 }: { label: string, children: React.ReactNode, span?: number }) {
  return (
    <div className={cn("space-y-1.5", span === 2 && "col-span-2")}>
       <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 ml-1">{label}</label>
       {children}
    </div>
  )
}

const inputCls = "w-full px-3.5 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-600"
// Campos que vem automaticamente do cadastro da placa (Módulo/Área) — somente leitura.
const readOnlyCls = "w-full px-3.5 py-3 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-500 outline-none cursor-not-allowed placeholder:text-zinc-700"

// Grupo de até 2 fotos de evidência — mesmo recorte do app WEB (app/backlog/BacklogModal.tsx),
// reaproveitado pra evidência de Atividade e pra evidência de Conclusão. Toque abre a câmera
// nativa direto (não a galeria) — ver skill de padronização de câmera; "Galeria" fica como
// opção secundária explícita, só pra quando a foto já existe em outro app.
function GrupoFotosEvidencia({
  fotos,
  processando,
  onCapturar,
  onGaleria,
  onRemover,
  onExpandir,
}: {
  fotos: string[]
  processando: boolean
  onCapturar: () => void
  onGaleria: (file: File) => void
  onRemover: (idx: number) => void
  onExpandir: (foto: string) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="grid grid-cols-2 gap-3">
      {fotos.map((foto, idx) => (
        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-zinc-800 bg-black">
          <img src={foto} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" onClick={() => onExpandir(foto)} />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemover(idx) }}
            className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 active:bg-red-700 text-white rounded-full shadow"
            style={{ minWidth: "28px", minHeight: "28px" }}
          >
            <X size={12} className="stroke-[3]" />
          </button>
        </div>
      ))}
      {fotos.length < 2 && (
        <button
          type="button"
          onClick={onCapturar}
          disabled={processando}
          className="aspect-video rounded-xl border-2 border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {processando ? (
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Processando...</span>
          ) : (
            <>
              <Camera size={20} className="text-zinc-500" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tirar Foto</span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                className="flex items-center gap-1 text-[9px] font-bold text-zinc-500 underline underline-offset-2 mt-0.5"
              >
                <ImageIcon size={10} /> ou escolher da galeria
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onGaleria(file)
              e.target.value = ''
            }}
          />
        </button>
      )}
    </div>
  )
}

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
  const toast = useToast()
  const { form, setForm, clearDraft, hasContent } = useFormDraft('backlog', initialValues)

  // ── Fotos de evidência (Atividade / Conclusão) — câmera nativa (EunamanCamera) com
  // fallback de galeria. `campoFotoAtivo` guarda qual dos dois grupos recebe a próxima foto.
  const [fotoProcessando, setFotoProcessando] = useState(false)
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null)

  const adicionarFoto = async (dataUrlOuBlob: string | Blob, campo: 'evidencia_imagens' | 'evidencia_imagens_conclusao') => {
    const atual: string[] = (form as any)[campo] || []
    if (atual.length >= 2) return
    setFotoProcessando(true)
    try {
      const dataUrl = typeof dataUrlOuBlob === 'string'
        ? dataUrlOuBlob
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(dataUrlOuBlob)
          })
      const compressed = await compressPhoto(dataUrl)
      setForm(prev => ({ ...prev, [campo]: [...(((prev as any)[campo]) || []), compressed] }))
    } catch (err) {
      console.error('Erro ao processar foto de evidência:', err)
    } finally {
      setFotoProcessando(false)
    }
  }

  const removerFoto = (campo: 'evidencia_imagens' | 'evidencia_imagens_conclusao', idx: number) => {
    setForm(prev => ({ ...prev, [campo]: (((prev as any)[campo]) || []).filter((_: string, i: number) => i !== idx) }))
  }

  const { openCamera: capturarEvidencia } = useNativeCamera('eunaman_backlog_active_field', (alvo, compressedDataUrl) => {
    const campo = alvo as 'evidencia_imagens' | 'evidencia_imagens_conclusao'
    setForm(prev => {
      const atual: string[] = (prev as any)[campo] || []
      if (atual.length >= 2) return prev
      return { ...prev, [campo]: [...atual, compressedDataUrl] }
    })
  })

  useEffect(() => {
    if (!isOpen) return
    setStep(1)
    if (editData) {
      setForm(editData)
    } else {
      setForm(prev => (prev.data_evidencia ? prev : { ...prev, data_evidencia: getCurrentLocalDatetime() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData, isOpen, setForm])

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

    const matchHM = str.match(/^(\d+)\s*h(?:oras?)?\s*(?:(\d+)\s*m(?:in)?)?$/i);
    if (matchHM) {
      return { horas: matchHM[1] || '', minutos: matchHM[2] || '' };
    }

    const matchM = str.match(/^(\d+)\s*m(?:in)?$/i);
    if (matchM) {
      return { horas: '', minutos: matchM[1] || '' };
    }

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
    const matchBr = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[\sT](\d{2}):(\d{2}))?/);
    if (matchBr) {
      const [, d, m, y, hh, mm] = matchBr;
      return `${y}-${m}-${d}T${hh || '00'}:${mm || '00'}`;
    }
    const matchIsoSpace = str.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
    if (matchIsoSpace) {
      return `${matchIsoSpace[1]}T${matchIsoSpace[2]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      return str.slice(0, 16);
    }
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

  const handleNext = () => step < 5 && setStep(step + 1)
  const handlePrev = () => step > 1 && setStep(step - 1)

  const handleSubmit = async () => {
    if (isSubmitting.current) return
    isSubmitting.current = true
    setLoading(true)

    const handleSaveOffline = async () => {
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
      toast.show("Backlog salvo com sucesso (Offline)!", "success");
    };

    try {
      if (isOnline) {
        try {
          const res = await upsertBacklogItem(form)

          if (res.error) {
            console.warn("[Backlog] Falha ao salvar online, tentando offline...", res.error);
            await handleSaveOffline();
            return;
          }

          try {
            await localDb.put('backlog', res.data || form)
          } catch (cacheErr) {
            console.warn('[Cache] Falha ao atualizar IndexedDB:', cacheErr)
          }

          window.dispatchEvent(new CustomEvent('offline-db-updated-backlog'))
          clearDraft()
          onClose()
          toast.show("Backlog salvo com sucesso!", "success");
        } catch (err: any) {
          console.error("[Backlog] Erro critico no salvamento online, caindo para offline:", err);
          await handleSaveOffline();
        }
      } else {
        await handleSaveOffline();
      }
    } catch (error: any) {
      console.error('Erro inesperado ao concluir backlog:', error)
      toast.show('Erro inesperado. Tente novamente.', "error")
    } finally {
      setLoading(false)
      isSubmitting.current = false
    }
  }

  return (
    <BottomSheet open={isOpen} onClose={onClose} title={STEPS[step - 1].label} fullHeight>
      <div className="space-y-5 pb-4">
        {/* Faixa de passos — horizontal, sempre visível (era sidebar lateral no desktop) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          {STEPS.map((s) => {
            const active = step === s.id
            const done = step > s.id
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                className={cn(
                  "shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all",
                  active ? "opacity-100" : "opacity-50"
                )}
                style={{ minWidth: "64px" }}
              >
                <div className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all text-white",
                  active ? s.color : done ? "bg-indigo-900/60 text-indigo-300" : "bg-zinc-800 text-zinc-500"
                )}>
                  {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                </div>
                <span className={cn("text-[8px] font-black uppercase tracking-tight text-center leading-tight", active ? "text-zinc-100" : "text-zinc-500")}>
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-zinc-500 font-bold -mt-3">Complete os campos obrigatórios para avançar</p>

        {hasContent && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-900/40 rounded-2xl flex items-start gap-2.5">
            <AlertCircle size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] font-bold text-amber-400">
              <p>Rascunho automático ativo neste aparelho.</p>
              <button onClick={clearDraft} className="mt-1 text-[10px] font-black underline">LIMPAR AGORA</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Data de Evidência">
              <div className="flex items-center gap-2">
                <input
                  className={cn(inputCls, "flex-1 font-mono")}
                  type="datetime-local"
                  value={formatToDatetimeLocal(form.data_evidencia)}
                  onChange={e => setForm(prev => ({...prev, data_evidencia: e.target.value}))}
                />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({...prev, data_evidencia: getCurrentLocalDatetime()}))}
                  className="px-3 bg-zinc-800 active:bg-indigo-950/40 text-zinc-300 active:text-indigo-400 rounded-xl text-xs font-black uppercase border border-zinc-700 shrink-0"
                  style={{ minHeight: "var(--tap-min)" }}
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
          <div className="grid grid-cols-1 gap-4">
            <Field label="Frota (Placa)">
              <SearchableSelect
                options={heavyActivePlacas.map(p => ({ value: p.placa, label: `${p.placa}${p.modulo ? ` (${p.modulo})` : ''}` }))}
                value={form.frota}
                onChange={val => {
                  const eq = heavyActivePlacas.find(p => p.placa === val);
                  setForm({...form, frota: val, modulo: eq?.modulo || '', campo_base: eq?.area || ''});
                }}
              />
            </Field>
            <Field label="Módulo">
              <input className={readOnlyCls} readOnly placeholder="Selecione a placa..." value={form.modulo} title="Vem automaticamente do cadastro da placa na Base de Frotas" />
            </Field>
            <Field label="TAG">
              <input className={inputCls} placeholder="Identificador" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} />
            </Field>
            <Field label="Campo / Base">
              <input className={readOnlyCls} readOnly placeholder="Selecione a placa..." value={form.campo_base} title="Vem automaticamente do cadastro da placa na Base de Frotas" />
            </Field>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Descrição da Atividade">
              <textarea className={cn(inputCls, "min-h-[100px] resize-none")} placeholder="Detalhe a falha detectada..." value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
            </Field>
            <Field label="Nº O.S (Opcional)">
              <input className={inputCls} placeholder="Ex: 5042" value={form.os} onChange={e => setForm({...form, os: e.target.value})} />
            </Field>
            <Field label="Tempo Estimado">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500 pointer-events-none">h</span>
                  </div>
                  <span className="font-black text-zinc-500 text-sm">:</span>
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
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-zinc-500 pointer-events-none">min</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider mr-0.5">Rápido:</span>
                  {['30m', '1h', '2h', '4h', '8h', '12h'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, tempo_execucao: preset }))}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border",
                        form.tempo_execucao === preset
                          ? "bg-indigo-600 text-white border-indigo-500"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700 active:bg-zinc-700"
                      )}
                      style={{ minHeight: "36px" }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            </Field>
            <Field label="Status Atual">
              <select className={inputCls} value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="PENDENTE">🟡 PENDENTE</option>
                <option value="PROGRAMADO">🟢 PROGRAMADO</option>
                <option value="ENCERRADO">✅ ENCERRADO</option>
              </select>
            </Field>
            <Field label={`Evidência (Foto) — ${(form.evidencia_imagens || []).length}/2`}>
              <GrupoFotosEvidencia
                fotos={form.evidencia_imagens || []}
                processando={fotoProcessando}
                onCapturar={() => capturarEvidencia('evidencia_imagens', () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"))}
                onGaleria={(file) => adicionarFoto(file, 'evidencia_imagens')}
                onRemover={(idx) => removerFoto('evidencia_imagens', idx)}
                onExpandir={setFotoExpandida}
              />
            </Field>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 gap-4">
            <Field label="Material Necessário">
              <input className={inputCls} placeholder="Ex: Kit Vedação" value={form.material} onChange={e => setForm({...form, material: e.target.value})} />
            </Field>
            <Field label="Nº RC">
              <input className={inputCls} placeholder="Nr Requisição" value={form.nr_rc} onChange={e => setForm({...form, nr_rc: e.target.value})} />
            </Field>
            <Field label="Fornecedor">
              <input className={inputCls} placeholder="Nome Fornecedor" value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} />
            </Field>
            <Field label="Situação RC">
              <input className={inputCls} placeholder="Ex: Autorizado" value={form.situacao_rc} onChange={e => setForm({...form, situacao_rc: e.target.value})} />
            </Field>
          </div>
        )}

        {step === 5 && (
          <div className="grid grid-cols-1 gap-4">
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
            <Field label="Observações de Programação">
              <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={form.observacao || ''} onChange={e => setForm({...form, observacao: e.target.value})} />
            </Field>
            <Field label={`Evidência Após Conclusão — ${(form.evidencia_imagens_conclusao || []).length}/2`}>
              <GrupoFotosEvidencia
                fotos={form.evidencia_imagens_conclusao || []}
                processando={fotoProcessando}
                onCapturar={() => capturarEvidencia('evidencia_imagens_conclusao', () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"))}
                onGaleria={(file) => adicionarFoto(file, 'evidencia_imagens_conclusao')}
                onRemover={(idx) => removerFoto('evidencia_imagens_conclusao', idx)}
                onExpandir={setFotoExpandida}
              />
            </Field>
            <div className="p-5 bg-zinc-900 rounded-2xl border border-zinc-800 text-center">
              <p className="text-sm font-black text-zinc-100">Pronto para salvar no sistema?</p>
              <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Todos os dados serão sincronizados agora</p>
            </div>
          </div>
        )}

        {/* Controles de navegação do wizard */}
        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 text-xs font-black text-zinc-400 disabled:opacity-30"
            style={{ minHeight: "var(--tap-min)" }}
          >
            <ChevronLeft size={16} /> ANTERIOR
          </button>

          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(s => (
              <div key={s} className={cn("h-1.5 rounded-full transition-all", step === s ? "w-6 bg-indigo-500" : s < step ? "w-2 bg-indigo-900" : "w-1.5 bg-zinc-800")} />
            ))}
          </div>

          {step < 5 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-black"
              style={{ minHeight: "var(--tap-min)" }}
            >
              AVANÇAR <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-1.5 px-5 bg-indigo-600 active:bg-indigo-700 text-white rounded-xl text-xs font-black disabled:opacity-60"
              style={{ minHeight: "var(--tap-min)" }}
            >
              {loading ? <><Clock size={14} className="animate-spin" /> Salvando...</> : 'CONCLUIR'}
            </button>
          )}
        </div>
      </div>

      {fotoExpandida && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/95 p-4" onClick={() => setFotoExpandida(null)}>
          <button
            onClick={() => setFotoExpandida(null)}
            className="absolute top-6 right-6 p-3 bg-zinc-900 text-white rounded-full border border-zinc-800"
            style={{ minWidth: "44px", minHeight: "44px" }}
          >
            <X size={18} />
          </button>
          <img src={fotoExpandida} className="max-w-full max-h-full object-contain rounded-xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </BottomSheet>
  )
}
