"use client";

import { Calendar, ChevronDown, RotateCcw } from "lucide-react";
import type { FiltroOpcoes } from "@/app/actions/dashboard";

export interface FiltrosValues {
  mes: number;
  ano: number;
  categoria: string;
  placa: string;
  modulo: string;
  area: string;
  status: string;
  dataInicio: string;
  dataFim: string;
  filial?: string; // Apenas para admin — 'TODAS' ou ID da filial
}

interface FiltrosProps {
  opcoes: FiltroOpcoes;
  valores: FiltrosValues;
  onChange: (key: keyof FiltrosValues, value: string | number) => void;
  onReset: () => void;
  periodoLabel: string;
}

export function Filtros({ opcoes, valores, onChange, onReset, periodoLabel }: FiltrosProps) {
  return (
    <div
      className="rounded-3xl p-5 flex flex-col gap-5 w-full"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-green-500 rounded-full"></div>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Filtros</h2>
          <span
            className="ml-2 text-xs px-2.5 py-1 rounded-full font-semibold"
            style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--eu-green-600, #16a34a)', border: '1px solid rgba(34,197,94,0.25)' }}
          >
            {periodoLabel}
          </span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
          style={{
            background: 'rgba(239,68,68,0.08)',
            color: '#dc2626',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <RotateCcw size={12} />
          Limpar
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        {/* Mês */}
        <SelectFilter
          value={valores.mes > 0 ? String(valores.mes) : ""}
          onChange={(v) => onChange("mes", parseInt(v) || 0)}
          options={opcoes.meses.map((m) => ({ value: String(m.value), label: m.label }))}
          placeholder="Todos os Meses"
        />

        {/* Ano */}
        <SelectFilter
          value={valores.ano > 0 ? String(valores.ano) : ""}
          onChange={(v) => onChange("ano", parseInt(v) || 0)}
          options={opcoes.anos.map((a) => ({ value: String(a), label: String(a) }))}
          placeholder="Todos os Anos"
        />

        <div className="h-8 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>

        <div className="flex items-center gap-2">
           <div className="relative">
             <input
               type="date"
               value={valores.dataInicio}
               onChange={(e) => onChange("dataInicio", e.target.value)}
               className="bg-white dark:bg-blue-500/5 border border-zinc-200 dark:border-blue-900/30 rounded-xl px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition-all hover:border-blue-400 w-[155px]"
             />
             <div className="absolute -top-2 left-2 px-1 bg-white dark:bg-[#0f1115] text-[10px] text-blue-600 dark:text-blue-500 font-bold uppercase tracking-wider">Início</div>
           </div>
           <div className="relative">
             <input
               type="date"
               value={valores.dataFim}
               onChange={(e) => onChange("dataFim", e.target.value)}
               className="bg-white dark:bg-blue-500/5 border border-zinc-200 dark:border-blue-900/30 rounded-xl px-3 py-2 text-[13px] text-zinc-900 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm transition-all hover:border-blue-400 w-[155px]"
             />
             <div className="absolute -top-2 left-2 px-1 bg-white dark:bg-[#0f1115] text-[10px] text-blue-600 dark:text-blue-500 font-bold uppercase tracking-wider">Fim</div>
           </div>
        </div>

        <div className="h-8 w-[1px] bg-zinc-100 dark:bg-zinc-800 mx-1"></div>

        {/* Categoria */}
        <SelectFilter
          value={valores.categoria}
          onChange={(v) => onChange("categoria", v)}
          options={opcoes.categorias.map((c) => ({ value: c, label: c }))}
          placeholder="Todas Categorias"
        />

        {/* Placa */}
        <SelectFilter
          value={valores.placa}
          onChange={(v) => onChange("placa", v)}
          options={opcoes.placas.map((p) => ({ value: p, label: p }))}
          placeholder="Todas as Placas"
        />

        {/* Módulo */}
        <SelectFilter
          value={valores.modulo}
          onChange={(v) => onChange("modulo", v)}
          options={opcoes.modulos.map((m) => ({ value: m, label: m }))}
          placeholder="Todos os Módulos"
        />

        {/* Área */}
        <SelectFilter
          value={valores.area}
          onChange={(v) => onChange("area", v)}
          options={(opcoes.areas || []).map((a) => ({ value: a, label: a }))}
          placeholder="Todas as Áreas"
        />

        {/* Status */}
        <SelectFilter
          value={valores.status}
          onChange={(v) => onChange("status", v)}
          options={opcoes.statusList.map((s) => ({ value: s, label: s }))}
          placeholder="Todos os Status"
        />

        {/* Filial — Visível APENAS para Administrador Geral */}
        {opcoes.filiais && opcoes.filiais.length > 0 && (
          <>
            <div className="h-8 w-[1px] bg-violet-200 dark:bg-violet-900/30 mx-1"></div>
            <div className="relative group flex-shrink-0">
              <select
                value={valores.filial || 'TODAS'}
                onChange={(e) => onChange('filial' as any, e.target.value)}
                className="appearance-none pr-9 pl-3.5 py-2 text-[13px] rounded-xl min-w-[170px] cursor-pointer transition-colors outline-none font-bold"
                style={{
                  background: 'rgba(124,58,237,0.07)',
                  color: '#7c3aed',
                  border: '1px solid rgba(124,58,237,0.25)',
                  fontWeight: 700,
                }}
              >
                <option value="TODAS">🏢 TODAS AS FILIAIS</option>
                {opcoes.filiais.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" size={14} style={{ color: '#7c3aed' }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SelectFilter({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="relative group flex-shrink-0">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-9 pl-3.5 py-2 text-[13px] rounded-xl min-w-[150px] cursor-pointer transition-colors outline-none"
        style={{
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-input)',
          fontWeight: 500,
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" size={14} style={{ color: 'var(--text-muted)' }} />
    </div>
  );
}
