'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  CheckCircle2,
  Tag,
  MapPin,
  Wrench,
  ShoppingCart,
  Calendar,
  Layers,
  Clock,
  AlertCircle,
  Camera,
  Clipboard
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFormDraft } from '@/hooks/use-form-draft'
import { upsertBacklogItem } from './actions'
import { useOffline } from '@/components/offline-provider'
import { localDb } from '@/lib/offline-db'
import { SearchableSelect } from '@/components/SearchableSelect'
import {
  SISTEMAS,
  subsistemasDoSistema,
  componentesDoSubsistema,
  ORIGENS,
  MAO_DE_OBRA_SUGESTOES,
  DETALHAMENTO_PEDIDO_SUGESTOES,
  calcularTipoPedido,
  calcularSituacaoRC
} from './classificacaoTecnica'

// ─── Types and Config ────────────────────────────────────────────────────────
type Placa = { id: string; placa: string; modulo: string | null; area?: string | null; tipo?: string | null }

const SECOES = [
  { id: "identificacao", label: "Identificação", icon: Tag, color: "bg-indigo-500" },
  { id: "localizacao", label: "Localização", icon: MapPin, color: "bg-blue-500" },
  { id: "atividade", label: "Atividade & Classificação Técnica", icon: Wrench, color: "bg-amber-500" },
  { id: "materiais", label: "Materiais & RC", icon: ShoppingCart, color: "bg-emerald-500" },
  { id: "programacao", label: "Programação & Conclusão", icon: Calendar, color: "bg-rose-500" },
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
  data_conclusao: '', delta: '', dias_resolucao: '', observacao: '',
  evidencia_imagens: [] as string[],
  sistema_cod: null as number | null,
  subsistema_cod: null as number | null,
  componente_cod: null as number | null,
  mao_obra: ''
}

// Redimensiona/comprime pro mesmo padrão já usado nas fotos de O.S (máx. 800px,
// JPEG 60%) — evita payloads gigantes indo pro banco e pra fila de sincronização
// offline, tanto vindo de um arquivo escolhido quanto de uma imagem colada.
function comprimirImagem(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
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

function SectionHeader({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-3 pb-3 mb-5 border-b border-zinc-100 dark:border-zinc-900">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0", color)}>
        <Icon size={17} />
      </div>
      <h3 className="text-sm font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-200">{label}</h3>
    </div>
  )
}

const inputCls = "w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-700"
// Campos que vem automaticamente do cadastro da placa (Módulo/Área) — somente leitura,
// pra não desalinhar do que está registrado na Base de Frotas.
const readOnlyCls = "w-full px-4 py-3 bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold text-zinc-500 dark:text-zinc-400 outline-none cursor-not-allowed placeholder:text-zinc-300 dark:placeholder:text-zinc-700"

// Data OU rótulo (ex: "SEM PREVISÃO") — alguns prazos nem sempre têm data definida ainda.
function DataOuRotulo({ value, onChange, rotulos }: { value: string; onChange: (v: string) => void; rotulos: string[] }) {
  const ehData = /^\d{4}-\d{2}-\d{2}/.test(value || '')
  return (
    <div className="flex flex-col gap-2">
      <input
        type="date"
        className={cn(inputCls, "font-mono")}
        value={ehData ? value.split('T')[0] : ''}
        onChange={e => onChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-1.5">
        {rotulos.map(r => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
              value === r
                ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            )}
          >
            {r}
          </button>
        ))}
      </div>
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
  const [loading, setLoading] = useState(false)
  const isSubmitting = useRef(false)
  const { isOnline } = useOffline()
  const { form, setForm, clearDraft, hasContent } = useFormDraft('backlog', initialValues)
  const formBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editData) {
      setForm(editData)
    } else {
      // Garantir data atual se for novo e estiver vazio
      setForm(prev => (prev.data_evidencia ? prev : { ...prev, data_evidencia: getCurrentLocalDatetime() }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editData, setForm])

  // Auto-preencher data de conclusão ao encerrar
  useEffect(() => {
    if (form.status === 'ENCERRADO' && !form.data_conclusao) {
      setForm(prev => ({ ...prev, data_conclusao: getCurrentLocalDatetime() }))
    }
  }, [form.status, form.data_conclusao, setForm])

  // Situação da RC: auto (ATENDE / NÃO ATENDE / SEM PREVISÃO / SEM REQUISIÇÃO), recalculada
  // sempre que os dados de material mudam — nunca digitada à mão.
  useEffect(() => {
    const auto = calcularSituacaoRC({
      dataNecessidade: form.data_nec_material,
      nrRc: form.nr_rc,
      previsaoMaterial: form.previsao_material
    })
    if (auto !== form.situacao_rc) {
      setForm(prev => ({ ...prev, situacao_rc: auto }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.data_nec_material, form.nr_rc, form.previsao_material])

  const tipoPedido = calcularTipoPedido(form.data_evidencia, form.data_nec_material)

  // ── Evidência (Foto): upload ou colar (Ctrl+V), até 2 fotos ──
  const fotosEvidencia: string[] = form.evidencia_imagens || []
  const [fotoProcessando, setFotoProcessando] = useState(false)

  const adicionarFotoEvidencia = async (blob: Blob) => {
    if (fotosEvidencia.length >= 2) return
    setFotoProcessando(true)
    try {
      const dataUrl = await comprimirImagem(blob)
      setForm(prev => ({ ...prev, evidencia_imagens: [...(prev.evidencia_imagens || []), dataUrl] }))
    } catch (err) {
      console.error('Erro ao processar foto de evidência:', err)
    } finally {
      setFotoProcessando(false)
    }
  }

  const removerFotoEvidencia = (idx: number) => {
    setForm(prev => ({ ...prev, evidencia_imagens: (prev.evidencia_imagens || []).filter((_: string, i: number) => i !== idx) }))
  }

  // Colar (Ctrl+V) uma imagem da área de transferência enquanto o modal está aberto — só
  // intercepta quando o clipboard realmente tem uma imagem, pra não atrapalhar colar texto
  // normalmente em qualquer campo da tela.
  useEffect(() => {
    if (!isOpen) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (blob) {
            e.preventDefault()
            adicionarFotoEvidencia(blob)
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fotosEvidencia.length])

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

  const subsistemasDisponiveis = React.useMemo(() => subsistemasDoSistema(form.sistema_cod), [form.sistema_cod])
  const componentesDisponiveis = React.useMemo(() => componentesDoSubsistema(form.subsistema_cod), [form.subsistema_cod])

  if (!isOpen) return null

  // Enter pula pro próximo campo em vez de tentar enviar o formulário — não avança a
  // partir de textarea (precisa permitir quebra de linha) nem de botões (presets, fotos).
  const handleKeyDownAdvance = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const target = e.target as HTMLElement
    if (target.tagName === 'TEXTAREA' || target.tagName === 'BUTTON') return
    e.preventDefault()
    const container = formBodyRef.current
    if (!container) return
    const campos = Array.from(
      container.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([disabled]):not([readonly]), select:not([disabled]), textarea:not([disabled])'
      )
    ).filter(el => el.offsetParent !== null)
    const idx = campos.indexOf(target)
    if (idx > -1 && idx < campos.length - 1) {
      const proximo = campos[idx + 1]
      proximo.focus()
      if ('select' in proximo && typeof (proximo as HTMLInputElement).select === 'function') {
        try { (proximo as HTMLInputElement).select() } catch {}
      }
    }
  }

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
      alert("Backlog salvo com sucesso (Offline)!");
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

          // Salva cópia atualizada no banco local (não-crítico)
          try {
            await localDb.put('backlog', res.data || form)
          } catch (cacheErr) {
            console.warn('[Cache] Falha ao atualizar IndexedDB:', cacheErr)
          }

          window.dispatchEvent(new CustomEvent('offline-db-updated-backlog'))
          clearDraft()
          onClose()
          alert("Backlog salvo com sucesso!");
        } catch (err: any) {
          console.error("[Backlog] Erro critico no salvamento online, caindo para offline:", err);
          await handleSaveOffline();
        }
      } else {
        await handleSaveOffline();
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
      <div className="bg-white dark:bg-zinc-950 w-full max-w-3xl rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-900 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20">
              <Layers size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-100 uppercase">
                {editData ? 'Editar Backlog' : 'Novo Backlog'}
              </h2>
              <p className="text-xs text-zinc-500 font-bold tracking-tight">Preencha os campos — aperte Enter para pular pro próximo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-zinc-400 transition-colors">
            <X size={22} />
          </button>
        </div>

        {/* Form Body — página única, com rascunho automático */}
        <div
          ref={formBodyRef}
          onKeyDown={handleKeyDownAdvance}
          className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar space-y-8"
        >
          {hasContent && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                <p>Rascunho automático ativo em seu navegador.</p>
                <button onClick={clearDraft} className="mt-1 text-[10px] font-black underline hover:no-underline">LIMPAR AGORA</button>
              </div>
            </div>
          )}

          {/* ── Identificação ── */}
          <section>
            <SectionHeader icon={SECOES[0].icon} label={SECOES[0].label} color={SECOES[0].color} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Data de Evidência" span={2}>
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
              <Field label="Colaborador / Mecânico">
                <SearchableSelect
                  options={(colaboradores || []).map(c => ({ value: c.nome, label: c.nome }))}
                  value={form.colaborador || ''}
                  onChange={val => setForm({...form, colaborador: val})}
                />
              </Field>
              <Field label="Origem">
                <input
                  className={inputCls}
                  list="backlog-origens"
                  placeholder="Ex: GAOS, IS, OPA..."
                  value={form.origem}
                  onChange={e => setForm({...form, origem: e.target.value})}
                />
                <datalist id="backlog-origens">
                  {ORIGENS.map(o => <option key={o.cod} value={o.cod}>{o.nome}</option>)}
                </datalist>
              </Field>
            </div>
          </section>

          {/* ── Localização ── */}
          <section>
            <SectionHeader icon={SECOES[1].icon} label={SECOES[1].label} color={SECOES[1].color} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Frota (Placa)" span={2}>
                <SearchableSelect
                  options={heavyActivePlacas.map(p => ({ value: p.placa, label: `${p.placa}${p.modulo ? ` (${p.modulo})` : ''}` }))}
                  value={form.frota}
                  onChange={val => {
                    const eq = heavyActivePlacas.find(p => p.placa === val);
                    setForm({...form, frota: val, modulo: eq?.modulo || '', tipo: eq?.tipo || ''});
                  }}
                />
              </Field>
              <Field label="Módulo">
                <input className={readOnlyCls} readOnly placeholder="Selecione a placa..." value={form.modulo} title="Vem automaticamente do cadastro da placa na Base de Frotas" />
              </Field>
              <Field label="Tipo">
                <input className={readOnlyCls} readOnly placeholder="Selecione a placa..." value={form.tipo} title="Vem automaticamente do cadastro da placa na Base de Frotas (Comboio, Munck, Multifuncional, Pipa...)" />
              </Field>
              <Field label="TAG">
                <input className={inputCls} placeholder="Identificador" value={form.tag} onChange={e => setForm({...form, tag: e.target.value})} />
              </Field>
              <Field label="Campo / Base" span={2}>
                <select className={inputCls} value={form.campo_base || ''} onChange={e => setForm({...form, campo_base: e.target.value})}>
                  <option value="">Onde será feita a manutenção?</option>
                  <option value="CAMPO">CAMPO</option>
                  <option value="BASE">BASE</option>
                </select>
              </Field>
            </div>
          </section>

          {/* ── Atividade & Classificação Técnica ── */}
          <section>
            <SectionHeader icon={SECOES[2].icon} label={SECOES[2].label} color={SECOES[2].color} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Descrição da Atividade" span={2}>
                <textarea className={cn(inputCls, "min-h-[100px] resize-none")} placeholder="Detalhe a falha detectada..." value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} />
              </Field>

              <Field label="Sistema">
                <select
                  className={inputCls}
                  value={form.sistema_cod ?? ''}
                  onChange={e => {
                    const cod = e.target.value ? Number(e.target.value) : null
                    setForm(prev => ({ ...prev, sistema_cod: cod, subsistema_cod: null, componente_cod: null }))
                  }}
                >
                  <option value="">Selecione...</option>
                  {SISTEMAS.map(s => <option key={s.cod} value={s.cod}>{s.cod} – {s.nome}</option>)}
                </select>
              </Field>
              <Field label="Subsistema">
                <select
                  className={inputCls}
                  value={form.subsistema_cod ?? ''}
                  disabled={!form.sistema_cod}
                  onChange={e => {
                    const cod = e.target.value ? Number(e.target.value) : null
                    setForm(prev => ({ ...prev, subsistema_cod: cod, componente_cod: null }))
                  }}
                >
                  <option value="">{form.sistema_cod ? 'Selecione...' : 'Escolha o Sistema primeiro'}</option>
                  {subsistemasDisponiveis.map(s => <option key={s.cod} value={s.cod}>{s.cod} – {s.nome}</option>)}
                </select>
              </Field>
              <Field label="Componente" span={2}>
                <select
                  className={inputCls}
                  value={form.componente_cod ?? ''}
                  disabled={!form.subsistema_cod}
                  onChange={e => setForm(prev => ({ ...prev, componente_cod: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">{form.subsistema_cod ? 'Selecione...' : 'Escolha o Subsistema primeiro'}</option>
                  {componentesDisponiveis.map(c => <option key={c.cod} value={c.cod}>{c.cod} – {c.nome}</option>)}
                </select>
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
              <Field label={`Evidência (Foto) — ${fotosEvidencia.length}/2`} span={2}>
                <div className="grid grid-cols-2 gap-3">
                  {fotosEvidencia.map((foto, idx) => (
                    <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
                      <img src={foto} alt={`Evidência ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removerFotoEvidencia(idx)}
                        title="Remover foto"
                        className="absolute top-1.5 right-1.5 p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow"
                      >
                        <X size={12} className="stroke-[3]" />
                      </button>
                    </div>
                  ))}
                  {fotosEvidencia.length < 2 && (
                    <label
                      htmlFor="backlog-foto-evidencia-input"
                      className="aspect-video rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-amber-400 dark:hover:border-amber-600 transition-colors text-center px-2"
                    >
                      {fotoProcessando ? (
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Processando...</span>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-zinc-400">
                            <Camera size={18} />
                            <Clipboard size={16} />
                          </div>
                          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Adicionar ou Colar (Ctrl+V)</span>
                        </>
                      )}
                      <input
                        id="backlog-foto-evidencia-input"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) adicionarFotoEvidencia(file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </Field>
            </div>
          </section>

          {/* ── Materiais & RC ── */}
          <section>
            <SectionHeader icon={SECOES[3].icon} label={SECOES[3].label} color={SECOES[3].color} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Material Necessário" span={2}>
                <input className={inputCls} placeholder="Ex: Kit Vedação" value={form.material} onChange={e => setForm({...form, material: e.target.value})} />
              </Field>
              <Field label="Nº RC">
                <input className={inputCls} placeholder="Nr Requisição" value={form.nr_rc} onChange={e => setForm({...form, nr_rc: e.target.value})} />
              </Field>
              <Field label="Nº Ordem">
                <input className={inputCls} placeholder="Nr Ordem de Compra" value={form.nr_ordem} onChange={e => setForm({...form, nr_ordem: e.target.value})} />
              </Field>
              <Field label="Fornecedor" span={2}>
                <input className={inputCls} placeholder="Nome Fornecedor" value={form.fornecedor} onChange={e => setForm({...form, fornecedor: e.target.value})} />
              </Field>
              <Field label="Mão de Obra">
                <input
                  className={inputCls}
                  list="backlog-mao-de-obra"
                  placeholder="Ex: Solda, Terceiro..."
                  value={form.mao_obra}
                  onChange={e => setForm({...form, mao_obra: e.target.value})}
                />
                <datalist id="backlog-mao-de-obra">
                  {MAO_DE_OBRA_SUGESTOES.map(m => <option key={m} value={m} />)}
                </datalist>
              </Field>
              <Field label="Detalhamento do Pedido">
                <input
                  className={inputCls}
                  list="backlog-detalhamento"
                  placeholder="Ex: Aguardando Fornecedor..."
                  value={form.detalhamento}
                  onChange={e => setForm({...form, detalhamento: e.target.value})}
                />
                <datalist id="backlog-detalhamento">
                  {DETALHAMENTO_PEDIDO_SUGESTOES.map(d => <option key={d} value={d} />)}
                </datalist>
              </Field>
              <Field label="Data da RC">
                <input className={cn(inputCls, "font-mono")} type="date" value={(form.data_rc || '').split('T')[0]} onChange={e => setForm({...form, data_rc: e.target.value})} />
              </Field>
              <Field label="Data Necessidade do Material">
                <input className={cn(inputCls, "font-mono")} type="date" value={(form.data_nec_material || '').split('T')[0]} onChange={e => setForm({...form, data_nec_material: e.target.value})} />
              </Field>
              <Field label="Previsão do Material" span={2}>
                <DataOuRotulo
                  value={form.previsao_material}
                  onChange={v => setForm({...form, previsao_material: v})}
                  rotulos={["SEM PREVISÃO", "AGUARDANDO PROGRAMAÇÃO"]}
                />
              </Field>

              {(tipoPedido || form.situacao_rc) && (
                <div className="col-span-1 md:col-span-2 flex flex-wrap gap-2">
                  {tipoPedido && (
                    <span className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                      tipoPedido === 'URGENTE' ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400"
                      : tipoPedido === 'NORMAL' ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40 text-amber-600 dark:text-amber-400"
                      : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/40 text-blue-600 dark:text-blue-400"
                    )}>
                      Tipo de Pedido: {tipoPedido}
                    </span>
                  )}
                  {form.situacao_rc && (
                    <span className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border",
                      form.situacao_rc === 'ATENDE' ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400"
                      : form.situacao_rc === 'NÃO ATENDE' ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400"
                      : "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500"
                    )}>
                      Situação RC: {form.situacao_rc}
                    </span>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* ── Programação & Conclusão ── */}
          <section>
            <SectionHeader icon={SECOES[4].icon} label={SECOES[4].label} color={SECOES[4].color} />
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
                <DataOuRotulo
                  value={form.previsao_conclusao}
                  onChange={v => setForm({...form, previsao_conclusao: v})}
                  rotulos={["PENDENTE", "AGUARDANDO PROGRAMAÇÃO", "PENDENTE MONTAR PROGRAMAÇÃO"]}
                />
              </Field>
              <Field label="Observações de Programação" span={2}>
                <textarea className={cn(inputCls, "min-h-[80px] resize-none")} value={form.observacao || ''} onChange={e => setForm({...form, observacao: e.target.value})} />
              </Field>
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-black text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
          >
            CANCELAR
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-2 px-10 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-black shadow-xl shadow-indigo-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? <><Clock size={16} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={16} /> SALVAR BACKLOG</>}
          </button>
        </div>

      </div>
    </div>
  )
}
