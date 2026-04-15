"use client";

import { Calendar, ChevronDown, RotateCcw } from "lucide-react";
import type { FiltroOpcoes } from "@/app/actions/dashboard";

export interface FiltrosValues {
  mes: number;
  ano: number;
  categoria: string;
  placa: string;
  modulo: string;
  status: string;
  dataInicio: string;
  dataFim: string;
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
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col gap-5 shadow-sm w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-blue-500 rounded-full"></div>
          <h2 className="text-[15px] font-semibold text-[#1e293b] dark:text-zinc-200">Filtros</h2>
          <span className="ml-2 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-medium">
            {periodoLabel}
          </span>
        </div>
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
               className="bg-blue-50/30 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-900/30 rounded-xl px-3 py-2 text-[13px] text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10 w-[145px]"
             />
             <div className="absolute -top-2 left-2 px-1 bg-white dark:bg-[#0f1115] text-[10px] text-blue-500 font-bold">Data Início</div>
           </div>
           <div className="relative">
             <input
               type="date"
               value={valores.dataFim}
               onChange={(e) => onChange("dataFim", e.target.value)}
               className="bg-blue-50/30 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-900/30 rounded-xl px-3 py-2 text-[13px] text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-400 shadow-sm transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/10 w-[145px]"
             />
             <div className="absolute -top-2 left-2 px-1 bg-white dark:bg-[#0f1115] text-[10px] text-blue-500 font-bold">Data Fim</div>
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

        {/* Status */}
        <SelectFilter
          value={valores.status}
          onChange={(v) => onChange("status", v)}
          options={opcoes.statusList.map((s) => ({ value: s, label: s }))}
          placeholder="Todos os Status"
        />
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
        className="appearance-none pr-9 pl-3.5 py-2 text-[13px] text-zinc-600 dark:text-zinc-300 bg-white dark:bg-[#0f1115] border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 min-w-[150px] cursor-pointer shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={14} />
    </div>
  );
}
