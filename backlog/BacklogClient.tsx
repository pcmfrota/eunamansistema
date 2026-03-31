"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText, Upload, Download, Plus, Search, ChevronDown,
  BarChart2, ClipboardList, X,
  CheckCircle2, ChevronRight, MapPin, Wrench, ShoppingCart,
  Calendar, Tag, Clock, Layers, AlertTriangle
} from 'lucide-react';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';


// ─── Types ────────────────────────────────────────────────────────────────────
type Placa = { id: string; placa: string; modulo: string | null };

// ─── Helpers ──────────────────────────────────────────────────────────────────
/** Retorna o número da semana ISO (1-53) de uma data */
function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = [
  { id: 1, label: "Identificação",  icon: Tag,          color: "violet" },
  { id: 2, label: "Localização",    icon: MapPin,        color: "blue"   },
  { id: 3, label: "Atividade",      icon: Wrench,        color: "amber"  },
  { id: 4, label: "Materiais & RC", icon: ShoppingCart,  color: "green"  },
  { id: 5, label: "Programação",    icon: Calendar,      color: "rose"   },
];

const colorMap: Record<string, { active: string; dot: string; badge: string }> = {
  violet: { active: "text-violet-400", dot: "bg-violet-500", badge: "bg-violet-500/15 text-violet-300 border-violet-500/30" },
  blue:   { active: "text-blue-400",   dot: "bg-blue-500",   badge: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  amber:  { active: "text-amber-400",  dot: "bg-amber-500",  badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  green:  { active: "text-green-400",  dot: "bg-green-500",  badge: "bg-green-500/15 text-green-300 border-green-500/30" },
  rose:   { active: "text-rose-400",   dot: "bg-rose-500",   badge: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

// ─── Field ────────────────────────────────────────────────────────────────────
const fieldCls = "w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/50 transition-all";
const labelCls = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5";

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: number }) {
  return (
    <div className={span === 2 ? "col-span-2" : ""}>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

// ─── Criticidade: apenas A e B ────────────────────────────────────────────────
const CRITS = [
  { label: "A", desc: "Crítico", color: "bg-red-500/20 border-red-500/50 text-red-300 hover:bg-red-500/30",    ring: "ring-red-500/50"    },
  { label: "B", desc: "Alto",    color: "bg-orange-500/20 border-orange-500/50 text-orange-300 hover:bg-orange-500/30", ring: "ring-orange-500/50" },
];

function CriticidadeSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CRITS.map(c => (
        <button key={c.label} type="button" onClick={() => onChange(c.label)}
          className={cn(
            "flex flex-col items-center py-4 rounded-xl border text-xs font-bold transition-all",
            c.color,
            value === c.label ? `ring-2 ring-offset-1 ring-offset-slate-900 scale-[1.03] ${c.ring}` : "opacity-60 hover:opacity-100"
          )}>
          <span className="text-2xl font-black mb-1">{c.label}</span>
          <span className="text-[11px] font-medium opacity-80">{c.desc}</span>
          {value === c.label && (
            <span className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-white/10">Selecionada</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Custom Select (funciona no tema escuro do modal) ────────────────────────
function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Selecione...",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(fieldCls, "flex items-center justify-between text-left pr-3")}>
        <span className={value ? "text-white" : "text-slate-500"}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown size={14} className={cn("text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: '#161b2e' }}>
          {options.map(opt => (
            <button key={opt.value} type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left hover:bg-white/5",
                opt.value === value ? "text-violet-400 bg-violet-500/10" : "text-white"
              )}>
              {opt.label}
              {opt.value === value && <CheckCircle2 size={13} className="text-violet-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlacaSearchSelect({
  placas,
  value,
  onChange,
}: {
  placas: Placa[];
  value: string;
  onChange: (placa: string, modulo: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? placas.filter(p => p.placa.toLowerCase().includes(query.toLowerCase()))
    : placas;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = placas.find(p => p.placa === value);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className={cn(fieldCls, "flex items-center justify-between text-left pr-3")}>
        <span className={value ? "text-white" : "text-slate-500"}>
          {value || "Selecione ou busque a placa..."}
        </span>
        <ChevronDown size={14} className={cn("text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: '#161b2e' }}>
          {/* Search input */}
          <div className="p-2 border-b border-white/8">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar placa..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-white/10 bg-white/5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">Nenhuma placa encontrada</div>
            ) : (
              filtered.map(p => (
                <button key={p.id} type="button"
                  onClick={() => { onChange(p.placa, p.modulo); setOpen(false); setQuery(''); }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors text-left hover:bg-white/5",
                    p.placa === value ? "text-violet-400 bg-violet-500/10" : "text-white"
                  )}>
                  <span className="font-semibold">{p.placa}</span>
                  {p.modulo && <span className="text-[11px] text-slate-500">{p.modulo}</span>}
                  {p.placa === value && <CheckCircle2 size={13} className="text-violet-400" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 1: Identificação ────────────────────────────────────────────────────
function StepIdentificacao({ form, setForm }: any) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // Quando a data muda, recalcula semana automaticamente
  const handleDataChange = (dateStr: string) => {
    const d = parseLocalDate(dateStr);
    if (d) {
      const semana = getISOWeek(d);
      const mes = d.getMonth() + 1;
      const ano = d.getFullYear();
      setForm((f: any) => ({ ...f, dataEvidencia: dateStr, semana, mes, ano }));
    } else {
      setForm((f: any) => ({ ...f, dataEvidencia: dateStr }));
    }
  };

  // Init
  useEffect(() => {
    if (!form.dataEvidencia) handleDataChange(todayStr);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Data primeiro para calcular semana */}
      <Field label="Data da Evidência" span={2}>
        <input type="date"
          value={form.dataEvidencia || todayStr}
          onChange={e => handleDataChange(e.target.value)}
          className={fieldCls} />
      </Field>

      <Field label="Semana (ISO calculada)">
        <div className="relative">
          <input type="number" readOnly
            value={form.semana || getISOWeek(today)}
            className={cn(fieldCls, "opacity-70 cursor-default font-bold text-violet-300")} />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-medium">AUTO</span>
        </div>
      </Field>

      <Field label="Mês">
        <input type="number" readOnly
          value={form.mes || (today.getMonth() + 1)}
          className={cn(fieldCls, "opacity-70 cursor-default")} />
      </Field>

      <Field label="Ano" span={2}>
        <input type="number" readOnly
          value={form.ano || today.getFullYear()}
          className={cn(fieldCls, "opacity-70 cursor-default")} />
      </Field>

      <Field label="Criticidade (A = Crítico · B = Alto)" span={2}>
        <CriticidadeSelector value={form.criticidade || ""}
          onChange={v => setForm((f: any) => ({ ...f, criticidade: v }))} />
      </Field>

      <Field label="Tipo">
        <input type="text" placeholder="Ex: Corretiva"
          value={form.tipo || ""}
          onChange={e => setForm((f: any) => ({ ...f, tipo: e.target.value }))}
          className={fieldCls} />
      </Field>

      <Field label="Origem">
        <input type="text" placeholder="Ex: Inspeção, Operador"
          value={form.origem || ""}
          onChange={e => setForm((f: any) => ({ ...f, origem: e.target.value }))}
          className={fieldCls} />
      </Field>
    </div>
  );
}

// ─── Step 2: Localização ──────────────────────────────────────────────────────
function StepLocalizacao({ form, setForm, placas }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Frota (Placa)" span={2}>
        <PlacaSearchSelect
          placas={placas}
          value={form.frota || ""}
          onChange={(placa, modulo) =>
            setForm((f: any) => ({ ...f, frota: placa, modulo: modulo || f.modulo }))
          }
        />
      </Field>

      <Field label="Módulo" span={2}>
        <input type="text" placeholder="Preenchido automaticamente ao selecionar placa"
          value={form.modulo || ""}
          onChange={e => setForm((f: any) => ({ ...f, modulo: e.target.value }))}
          className={fieldCls} />
      </Field>

      <Field label="TAG">
        <input type="text" placeholder="Identificador do componente"
          value={form.tag || ""}
          onChange={e => setForm((f: any) => ({ ...f, tag: e.target.value }))}
          className={fieldCls} />
      </Field>

      <Field label="Campo / Base">
        <input type="text" placeholder="Ex: Campo Norte, Base Central"
          value={form.campoBase || ""}
          onChange={e => setForm((f: any) => ({ ...f, campoBase: e.target.value }))}
          className={fieldCls} />
      </Field>

      <Field label="Região x Programação" span={2}>
        <input type="text" placeholder="Ex: Norte / Programado Semana 4"
          value={form.regiaoPrograma || ""}
          onChange={e => setForm((f: any) => ({ ...f, regiaoPrograma: e.target.value }))}
          className={fieldCls} />
      </Field>

      <Field label="Dias de Pendência Aberta" span={2}>
        <div className="relative">
          <input type="text" disabled placeholder="Calculado automaticamente após salvar"
            className={cn(fieldCls, "opacity-40 cursor-not-allowed pl-10")} />
          <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </Field>
    </div>
  );
}

// ─── Step 3, 4, 5 (unchanged internals) ───────────────────────────────────────
function StepAtividade({ form, setForm }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Descrição da Atividade" span={2}>
        <textarea rows={4} placeholder="Descreva detalhadamente a atividade..."
          value={form.descricao || ""}
          onChange={e => setForm((f: any) => ({ ...f, descricao: e.target.value }))}
          className={cn(fieldCls, "resize-none")} />
      </Field>
      <Field label="Tempo de Execução Previsto">
        <div className="relative">
          <input type="text" placeholder="Ex: 4h, 2 dias"
            value={form.tempoExecucao || ""}
            onChange={e => setForm((f: any) => ({ ...f, tempoExecucao: e.target.value }))}
            className={cn(fieldCls, "pl-10")} />
          <Clock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        </div>
      </Field>
      <Field label="O.S (Ordem de Serviço)">
        <input type="text" placeholder="Nº da OS vinculada"
          value={form.os || ""}
          onChange={e => setForm((f: any) => ({ ...f, os: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Mão de Obra">
        <input type="text" placeholder="Ex: Mecânico, Elétrico"
          value={form.maoDeObra || ""}
          onChange={e => setForm((f: any) => ({ ...f, maoDeObra: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Status">
        <CustomSelect
          value={form.status || ""}
          onChange={v => setForm((f: any) => ({ ...f, status: v }))}
          placeholder="Selecione o status"
          options={[
            { value: "Aberta",       label: "🟡 Aberta" },
            { value: "Em Andamento", label: "🔵 Em Andamento" },
            { value: "Encerrada",    label: "✅ Encerrada" },
          ]}
        />
      </Field>
      <Field label="Detalhamento do Pedido" span={2}>
        <textarea rows={3} placeholder="Detalhes adicionais sobre o pedido..."
          value={form.detalhamento || ""}
          onChange={e => setForm((f: any) => ({ ...f, detalhamento: e.target.value }))}
          className={cn(fieldCls, "resize-none")} />
      </Field>
    </div>
  );
}

function StepMateriais({ form, setForm }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Material" span={2}>
        <input type="text" placeholder="Descreva o material necessário"
          value={form.material || ""}
          onChange={e => setForm((f: any) => ({ ...f, material: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Nº RC (Requisição de Compra)">
        <input type="text" placeholder="Ex: RC-2026-0042"
          value={form.nrRc || ""}
          onChange={e => setForm((f: any) => ({ ...f, nrRc: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Nº Ordem">
        <input type="text" placeholder="Nº da ordem de compra"
          value={form.nrOrdem || ""}
          onChange={e => setForm((f: any) => ({ ...f, nrOrdem: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Fornecedor">
        <input type="text" placeholder="Nome do fornecedor"
          value={form.fornecedor || ""}
          onChange={e => setForm((f: any) => ({ ...f, fornecedor: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Tipo de Pedido">
        <input type="text" placeholder="Ex: Urgente, Normal"
          value={form.tipoPedido || ""}
          onChange={e => setForm((f: any) => ({ ...f, tipoPedido: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Data RC">
        <input type="date" value={form.dataRc || ""}
          onChange={e => setForm((f: any) => ({ ...f, dataRc: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Data Necessidade Material">
        <input type="date" value={form.dataNecMaterial || ""}
          onChange={e => setForm((f: any) => ({ ...f, dataNecMaterial: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Previsão Material">
        <input type="date" value={form.previsaoMaterial || ""}
          onChange={e => setForm((f: any) => ({ ...f, previsaoMaterial: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Situação RC">
        <input type="text" placeholder="Ex: Aprovado, Pendente"
          value={form.situacaoRc || ""}
          onChange={e => setForm((f: any) => ({ ...f, situacaoRc: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Dias Abertura / Req. Compras" span={2}>
        <input type="text" placeholder="Quantidade de dias"
          value={form.diasAbertura || ""}
          onChange={e => setForm((f: any) => ({ ...f, diasAbertura: e.target.value }))}
          className={fieldCls} />
      </Field>
    </div>
  );
}

function StepProgramacao({ form, setForm }: any) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Data de Programação">
        <input type="date" value={form.dataProgramacao || ""}
          onChange={e => setForm((f: any) => ({ ...f, dataProgramacao: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Status da Programação">
        <select value={form.statusProgramacao || ""}
          onChange={e => setForm((f: any) => ({ ...f, statusProgramacao: e.target.value }))}
          className={cn(fieldCls, "appearance-none cursor-pointer")}>
          <option value="">Selecione</option>
          <option>Não Programado</option>
          <option>Programado</option>
          <option>Reprogramado</option>
          <option>Executado</option>
        </select>
      </Field>
      <Field label="Previsão Conclusão Pendência">
        <input type="date" value={form.previsaoConclusao || ""}
          onChange={e => setForm((f: any) => ({ ...f, previsaoConclusao: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Data Conclusão Pendência">
        <input type="date" value={form.dataConclusao || ""}
          onChange={e => setForm((f: any) => ({ ...f, dataConclusao: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Delta Evidência vs Programação">
        <input type="text" placeholder="Em dias"
          value={form.delta || ""}
          onChange={e => setForm((f: any) => ({ ...f, delta: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Dias Resolução Pendência">
        <input type="text" placeholder="Número de dias"
          value={form.diasResolucao || ""}
          onChange={e => setForm((f: any) => ({ ...f, diasResolucao: e.target.value }))}
          className={fieldCls} />
      </Field>
      <Field label="Observação" span={2}>
        <textarea rows={4} placeholder="Observações adicionais sobre a programação..."
          value={form.observacao || ""}
          onChange={e => setForm((f: any) => ({ ...f, observacao: e.target.value }))}
          className={cn(fieldCls, "resize-none")} />
      </Field>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function NovoItemModal({ onClose, placas, setBacklogItems }: { onClose: () => void; placas: Placa[]; setBacklogItems: React.Dispatch<React.SetStateAction<any[]>> }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<any>({
    status: 'Aberta', // Default status
  });


  const currentStep = STEPS[step - 1];
  const colors = colorMap[currentStep.color];
  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  const stepContent: Record<number, React.ReactNode> = {
    1: <StepIdentificacao form={form} setForm={setForm} />,
    2: <StepLocalizacao form={form} setForm={setForm} placas={placas} />,
    3: <StepAtividade form={form} setForm={setForm} />,
    4: <StepMateriais form={form} setForm={setForm} />,
    5: <StepProgramacao form={form} setForm={setForm} />,
  };

  const stepDescs: Record<number, string> = {
    1: "Dados básicos de identificação e criticidade",
    2: "Frota, módulo e localização da pendência",
    3: "Descrição da atividade e status de execução",
    4: "Materiais, requisições e fornecedores",
    5: "Datas de programação e conclusão prevista",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,4,16,0.88)', backdropFilter: 'blur(14px)' }}>
      <div className="relative w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{
          background: 'linear-gradient(135deg, #0f1223 0%, #131729 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          maxHeight: '88vh'
        }}>
        {/* glow top */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.7), transparent)' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)' }}>
              <Layers size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Novo Item do Backlog</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Preencha as informações em {STEPS.length} etapas</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all">
            <X size={18} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-0.5 bg-white/5 flex-shrink-0">
          <div className="h-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #8B5CF6, #6D28D9)', boxShadow: '0 0 12px rgba(139,92,246,0.5)' }} />
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-44 flex-shrink-0 border-r border-white/5 py-4 px-3 flex flex-col gap-1">
            {STEPS.map(s => {
              const done = s.id < step;
              const active = s.id === step;
              const Icon = s.icon;
              const c = colorMap[s.color];
              return (
                <button key={s.id} onClick={() => setStep(s.id)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-xs font-semibold",
                    active ? `bg-white/8 ${c.active}` : done ? "text-slate-400 hover:text-slate-200 hover:bg-white/5" : "text-slate-600 hover:text-slate-400 hover:bg-white/5"
                  )}>
                  <div className={cn(
                    "w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    active ? c.badge + " border" : done ? "bg-green-500/20 border border-green-500/30" : "bg-white/5 border border-white/8"
                  )}>
                    {done
                      ? <CheckCircle2 size={12} className="text-green-400" />
                      : <Icon size={12} className={active ? c.active : "text-slate-500"} />}
                  </div>
                  <div className="leading-tight">
                    <div className="text-[10px] text-slate-600 font-medium">Etapa {s.id}</div>
                    <div className="truncate">{s.label}</div>
                  </div>
                  {active && <ChevronRight size={12} className="ml-auto flex-shrink-0 opacity-60" />}
                </button>
              );
            })}
            <div className="mt-auto flex justify-center gap-1.5 pt-4">
              {STEPS.map(s => (
                <div key={s.id} className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  s.id === step ? `${colors.dot} w-4` : s.id < step ? "bg-green-500 w-1.5" : "bg-white/10 w-1.5"
                )} />
              ))}
            </div>
          </div>

          {/* Form area */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 flex-shrink-0">
              <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center border text-xs font-black", colors.badge)}>
                {step}
              </div>
              <div>
                <h3 className={cn("text-sm font-bold", colors.active)}>{currentStep.label}</h3>
                <p className="text-[11px] text-slate-500">{stepDescs[step]}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5"
              style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
              {stepContent[step]}
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 flex-shrink-0">
              <button onClick={() => step > 1 && setStep(step - 1)} disabled={step === 1}
                className={cn(
                  "px-4 py-2 text-sm font-semibold rounded-xl transition-all",
                  step === 1 ? "text-slate-700 cursor-not-allowed" : "text-slate-400 hover:text-white hover:bg-white/8 border border-white/8"
                )}>
                ← Anterior
              </button>
              <span className="text-[11px] text-slate-600">{step} de {STEPS.length}</span>
              {step < STEPS.length ? (
                <button onClick={() => setStep(step + 1)}
                  className={cn("px-5 py-2 text-sm font-semibold rounded-xl border transition-all hover:brightness-125", colors.badge)}>
                  Próximo →
                </button>
              ) : (
                <button 
                  onClick={async () => {
                    const dbItem = {
                      semana: form.semana,
                      mes: form.mes,
                      ano: form.ano,
                      data_evidencia: form.dataEvidencia,
                      modulo: form.modulo,
                      regiao_programa: form.regiaoPrograma,
                      frota: form.frota,
                      tag: form.tag,
                      tipo: form.tipo,
                      descricao: form.descricao,
                      origem: form.origem,
                      criticidade: form.criticidade,
                      tempo_execucao: form.tempoExecucao,
                      campo_base: form.campoBase,
                      os: form.os,
                      material: form.material,
                      nr_rc: form.nrRc,
                      nr_ordem: form.nrOrdem,
                      fornecedor: form.fornecedor,
                      status: form.status || 'Aberta',
                      detalhamento: form.detalhamento,
                      data_rc: form.dataRc,
                      data_nec_material: form.dataNecMaterial,
                      previsao_material: form.previsaoMaterial,
                      situacao_rc: form.situacaoRc,
                      dias_abertura: form.diasAbertura,
                      data_programacao: form.dataProgramacao,
                      status_programacao: form.statusProgramacao,
                      previsao_conclusao: form.previsaoConclusao,
                      data_conclusao: form.dataConclusao,
                      delta: form.delta,
                      dias_resolucao: form.diasResolucao,
                      observacao: form.observacao
                    };

                    const { error } = await supabase
                      .from('backlog')
                      .insert([dbItem]);

                    if (error) {
                      alert("Erro ao salvar no banco de dados: " + error.message);
                      return;
                    }

                    // Recarregar a lista do banco para atualizar a UI com os novos dados
                    const { data: refreshed } = await supabase
                      .from('backlog')
                      .select('*')
                      .order('created_at', { ascending: false });
                    
                    if (refreshed) setBacklogItems(refreshed);
                    
                    onClose();
                    alert("Item adicionado ao backlog com sucesso!");
                  }}
                  className="px-6 py-2 text-sm font-bold rounded-xl text-white transition-all hover:brightness-110 active:scale-95"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', boxShadow: '0 4px 15px rgba(139,92,246,0.35)' }}>
                  ✓ Criar Item
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Table columns ────────────────────────────────────────────────────────────
const tableColumns = [
  "Semana", "Mês", "Ano", "Data Evidência", "Módulo", "Região x Prog.",
  "Dias Pend.", "Frota", "TAG", "Tipo", "Descrição", "Origem",
  "Criticidade", "Tempo Exec.", "Campo/Base", "O.S", "Material",
  "Nº RC", "Nº Ordem", "Fornecedor"
];
const detalhadoColumns = [
  "Data da Evidência", "Placa", "Descrição da Atividade", "Origem",
  "Dias Pend. Aberta", "Criticidade", "Nº RC", "Detalhamento Pedido", "Ações"
];

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BacklogClient({ placas }: { placas: Placa[] }) {
  const [activeTab, setActiveTab] = useState('Backlog');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [backlogItems, setBacklogItems] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Carregar do Banco de Dados ─────────────────────────────────────────────
  useEffect(() => {
    async function loadBacklog() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('backlog')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar backlog:', error);
      } else {
        setBacklogItems(data || []);
      }
      setIsLoading(false);
    }
    loadBacklog();
  }, []);

  // ─── Geração de ID Único ────────────────────────────────────────────────────
  const generateId = () => crypto.randomUUID();

  // ─── Seleção ────────────────────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedIds.size === backlogItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(backlogItems.map(item => item.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteSelected = async () => {
    if (window.confirm(`Deseja excluir ${selectedIds.size} itens selecionados?`)) {
      const { error } = await supabase
        .from('backlog')
        .delete()
        .in('id', Array.from(selectedIds));

      if (error) {
        alert("Erro ao excluir do banco de dados: " + error.message);
        return;
      }

      setBacklogItems(prev => prev.filter(item => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      alert("Itens excluídos com sucesso!");
    }
  };

  // ─── Exportar para Excel ────────────────────────────────────────────────────
  const handleExportExcel = () => {
    if (backlogItems.length === 0) {
      alert("Não há dados para exportar.");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(backlogItems);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backlog");
    XLSX.writeFile(wb, `Backlog_${new Date().toLocaleDateString()}.xlsx`);
  };

  // ─── Importar Arquivo ───────────────────────────────────────────────────────
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const rawData = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Normalização Robusta: Mapeia qualquer variação de nome na planilha para o campo correto no DB
        const normalized = rawData.map(row => {
          const getVal = (possibleNames: string[]) => {
            const key = Object.keys(row).find(k => {
              const normalizedK = k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
              return possibleNames.some(p => {
                const normalizedP = p.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "");
                return normalizedK === normalizedP;
              });
            });
            return key ? row[key] : null;
          };

          return {
            semana:           getVal(['semana', 'sem', 'week', 'wk']),
            mes:              getVal(['mes', 'mês', 'month']),
            ano:              getVal(['ano', 'year']),
            data_evidencia:   getVal(['data evidencia', 'data', 'evidencia', 'date', 'data da evidencia']),
            modulo:           getVal(['modulo', 'módulo', 'subconjunto', 'sistema']),
            regiao_programa:  getVal(['regiao x programacao', 'regiao', 'programa', 'regiao programa', 'planejamento']),
            frota:            getVal(['frota', 'placa', 'veiculo', 'equipamento', 'viatura']),
            tag:              getVal(['tag', 'componente', 'cod']),
            tipo:             getVal(['tipo', 'manutencao', 'tipo manutencao']),
            descricao:        getVal(['descricao', 'descrição', 'falha', 'atividade', 'servico']),
            origem:           getVal(['origem', 'inspetor', 'solicitante']),
            criticidade:      getVal(['criticidade', 'prioridade', 'crit', 'priori']),
            tempo_execucao:   getVal(['tempo execucao', 'tempo', 'execucao', 'h', 'horas']),
            campo_base:       getVal(['campo base', 'base', 'campo', 'local']),
            os:               getVal(['os', 'os', 'ordem servico', 'ordem']),
            material:         getVal(['material', 'peca', 'insumo']),
            nr_rc:            getVal(['nr rc', 'rc', 'numero rc', 'requisicao']),
            nr_ordem:         getVal(['nr ordem', 'numero ordem', 'ordem compra']),
            fornecedor:       getVal(['fornecedor', 'prestador']),
            status:           getVal(['status', 'situacao']) || 'Aberta',
            detalhamento:     getVal(['detalhamento', 'detalhes']),
            data_rc:          getVal(['data rc', 'dt rc']),
            data_nec_material:getVal(['data necessidade material', 'data necessidade', 'dt nec']),
            previsao_material:getVal(['previsao material', 'dt prev']),
            situacao_rc:      getVal(['situacao rc', 'status rc']),
            dias_abertura:    getVal(['dias abertura', 'dias']),
            data_programacao: getVal(['data programacao', 'dt prog']),
            status_programacao: getVal(['status programacao', 'situacao prog']),
            previsao_conclusao: getVal(['previsao conclusao', 'dt conclusao prev']),
            data_conclusao:   getVal(['data conclusao', 'dt encerrado']),
            delta:            getVal(['delta']),
            dias_resolucao:   getVal(['dias resolucao']),
            observacao:       getVal(['observacao', 'obs'])
          };
        });

        const { error } = await supabase
          .from('backlog')
          .insert(normalized);

        if (error) {
          console.error("Erro Supabase:", error);
          alert("Erro ao salvar no banco de dados: " + error.message);
          return;
        }

        // Mapeia de volta para camelCase para o estado da UI se necessário, ou usa direto
        // Para simplificar e evitar bugs, vamos recarregar a lista do banco
        const { data: refreshed } = await supabase
          .from('backlog')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (refreshed) setBacklogItems(refreshed);
        alert(`${normalized.length} itens importados e salvos com sucesso!`);
      } catch (error) {
        console.error("Erro ao importar arquivo:", error);
        alert("Erro ao ler o arquivo. Verifique o formato.");
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const tabs = [
    { name: 'Backlog', icon: FileText },
    { name: 'Dashboard', icon: BarChart2 },
    { name: 'Backlog Detalhado', icon: ClipboardList },
  ];

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 rounded-2xl">
            <FileText size={28} strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Backlog</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">Controle de pendências e atividades</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            className="hidden"
            accept=".xlsx, .xls, .csv"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 dark:border-purple-800/60 dark:text-purple-400 dark:hover:bg-purple-900/20 transition-colors bg-white dark:bg-slate-900/50">
            <Upload size={16} /> Importar
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg border border-green-200 text-green-600 hover:bg-green-50 dark:border-green-800/60 dark:text-green-400 dark:hover:bg-green-900/20 transition-colors bg-white dark:bg-slate-900/50">
            <Download size={16} /> Excel
          </button>
          <button onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-sm hover:shadow-purple-500/25 hover:shadow-lg active:scale-95">
            <Plus size={16} /> Novo Item
          </button>
          
          {selectedIds.size > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 animate-in fade-in zoom-in duration-200">
              <X size={16} /> Excluir ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mt-2">
        {tabs.map(tab => {
          const isActive = activeTab === tab.name;
          return (
            <button key={tab.name} onClick={() => setActiveTab(tab.name)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-all rounded-lg",
                isActive
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
              )}>
              <tab.icon size={16} strokeWidth={isActive ? 2 : 1.5} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === 'Backlog' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col w-full">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="text" placeholder="Buscar por frota ou descrição..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400" />
            </div>
            <div className="relative w-full md:w-auto flex items-center gap-2">
              <select className="w-full md:w-48 appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none text-slate-700 dark:text-slate-300 font-medium">
                <option>Todos Status</option>
                <option>Aberto</option>
                <option>Em Andamento</option>
                <option>Concluído</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              
              {selectedIds.size > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 whitespace-nowrap">
                  <X size={16} /> Excluir ({selectedIds.size})
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 border-b border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50">
                <tr>
                  <th className="py-4 px-4 pl-6 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      checked={backlogItems.length > 0 && selectedIds.size === backlogItems.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {tableColumns.map((col, i) => (
                    <th key={col} className="py-4 px-4 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backlogItems.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="py-16 text-center text-slate-400 dark:text-slate-500 text-[13px]">
                      Nenhum item encontrado.
                    </td>
                  </tr>
                ) : (
                  backlogItems.map((item, idx) => (
                    <tr key={item.id || idx} className={cn(
                      "border-b border-slate-100 dark:border-slate-700/50 transition-colors",
                      selectedIds.has(item.id) ? "bg-purple-500/5 dark:bg-purple-500/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    )}>
                      <td className="py-4 px-4 pl-6">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                      </td>
                      <td className="py-4 px-4">{item.semana || '-'}</td>
                      <td className="py-4 px-4">{item.mes || '-'}</td>
                      <td className="py-4 px-4">{item.ano || '-'}</td>
                      <td className="py-4 px-4">{item.data_evidencia || '-'}</td>
                      <td className="py-4 px-4">{item.modulo || '-'}</td>
                      <td className="py-4 px-4">{item.regiao_programa || '-'}</td>
                      <td className="py-4 px-4">{item.dias_pendencia || '0'}</td>
                      <td className="py-4 px-4 font-medium text-purple-400">{item.frota || '-'}</td>
                      <td className="py-4 px-4">{item.tag || '-'}</td>
                      <td className="py-4 px-4">{item.tipo || '-'}</td>
                      <td className="py-4 px-4 truncate max-w-[200px]">{item.descricao || '-'}</td>
                      <td className="py-4 px-4">{item.origem || '-'}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                          item.criticidade === 'A' ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        )}>
                          {item.criticidade || 'B'}
                        </span>
                      </td>
                      <td className="py-4 px-4">{item.tempo_execucao || '-'}</td>
                      <td className="py-4 px-4">{item.campo_base || '-'}</td>
                      <td className="py-4 px-4 font-mono text-xs">{item.os || '-'}</td>
                      <td className="py-4 px-4">{item.material || '-'}</td>
                      <td className="py-4 px-4 font-mono text-xs">{item.nr_rc || '-'}</td>
                      <td className="py-4 px-4 font-mono text-xs">{item.nr_ordem || '-'}</td>
                      <td className="py-4 px-4 truncate max-w-[120px]">{item.fornecedor || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Dashboard' && (
        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex gap-4 overflow-x-auto shadow-sm">
            {['CRITICIDADE', 'STATUS PROGRAMAÇÃO', 'STATUS', 'MÊS', 'ANO'].map(filter => (
              <div key={filter} className="min-w-[150px] flex-1">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">{filter}</label>
                <div className="relative">
                  <select className="w-full appearance-none pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none text-slate-700 dark:text-slate-300">
                    <option>Todos</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Total", value: "0", color: "text-slate-900 dark:text-white" },
              { label: "Criticidade A", value: "0", color: "text-red-600 dark:text-red-500" },
              { label: "Criticidade B", value: "0", color: "text-orange-500" },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
                <p className="text-sm text-slate-500 font-medium mb-2">{card.label}</p>
                <p className={cn("text-4xl font-bold", card.color)}>{card.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Backlog Detalhado' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left whitespace-nowrap">
              <thead className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 border-b border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50">
                <tr>
                  <th className="py-4 px-4 pl-6 w-10">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      checked={backlogItems.length > 0 && selectedIds.size === backlogItems.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {detalhadoColumns.map((col) => (
                    <th key={col} className="py-4 px-4 whitespace-nowrap">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backlogItems.length === 0 ? (
                  <tr>
                    <td colSpan={detalhadoColumns.length + 1} className="py-16 text-center text-slate-400 dark:text-slate-500 text-[13px]">
                      Nenhum item encontrado
                    </td>
                  </tr>
                ) : (
                  backlogItems.map((item, idx) => (
                    <tr key={item.id || idx} className={cn(
                      "border-b border-slate-100 dark:border-slate-700/50 transition-colors",
                      selectedIds.has(item.id) ? "bg-purple-500/5 dark:bg-purple-500/10" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                    )}>
                      <td className="py-4 px-4 pl-6">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelectItem(item.id)}
                        />
                      </td>
                      <td className="py-4 px-4 text-slate-400">{item.data_evidencia || '-'}</td>
                      <td className="py-4 px-4 font-bold text-slate-200">{item.frota || '-'}</td>
                      <td className="py-4 px-4 truncate max-w-[250px]">{item.descricao || '-'}</td>
                      <td className="py-4 px-4 text-slate-400">{item.origem || '-'}</td>
                      <td className="py-4 px-4 text-center">{item.dias_pendencia || '0'}</td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold border",
                          item.criticidade === 'A' ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        )}>
                          {item.criticidade || 'B'}
                        </span>
                      </td>
                      <td className="py-4 px-4">{item.nr_rc || '-'}</td>
                      <td className="py-4 px-4 italic text-slate-500 truncate max-w-[150px]">{item.material || '-'}</td>
                      <td className="py-4 px-4">
                        <button className="p-1.5 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors">
                           <Layers size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <NovoItemModal 
          onClose={() => setIsModalOpen(false)} 
          placas={placas} 
          setBacklogItems={setBacklogItems}
        />
      )}
    </div>
  );
}
