"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxOption {
  value: string;
  label: string;
}

interface CheckboxMultiSelectProps {
  /** Vazio = "sem filtro" (mostra tudo) — mesma convenção dos <select> únicos que isso substitui. */
  values: string[];
  onChange: (values: string[]) => void;
  options: CheckboxOption[];
  placeholder: string;
  className?: string;
  /** Pill fica destacada em âmbar em vez de verde — usado pro filtro de Status da OS, pra não ser confundido com o Status do veículo. */
  accent?: "green" | "amber";
}

// Dropdown de múltipla seleção com checkbox — substitui os antigos <select> de valor único
// nos filtros de listagem/dashboard do sistema inteiro. Mesma casca visual (pill com seta)
// do <select> original, pra não mudar o layout das telas que já o usam; o que muda é que
// abre um painel com uma checkbox por opção em vez de trocar de valor direto.
export function CheckboxMultiSelect({ values, onChange, options, placeholder, className, accent = "green" }: CheckboxMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const accentColor = accent === "amber" ? "#d97706" : "#16a34a";
  const accentBg = accent === "amber" ? "rgba(217,119,6,0.1)" : "rgba(34,197,94,0.1)";
  const accentBorder = accent === "amber" ? "rgba(217,119,6,0.3)" : "rgba(34,197,94,0.3)";
  const accentCheckedBg = accent === "amber" ? "bg-amber-500 border-amber-500" : "bg-green-500 border-green-500";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleValue = (val: string) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  };

  const label =
    values.length === 0
      ? placeholder
      : values.length === 1
      ? options.find((o) => o.value === values[0])?.label || values[0]
      : `${values.length} selecionados`;

  return (
    <div className={cn("relative group flex-shrink-0", className)} ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="appearance-none pr-9 pl-3.5 py-2 text-[13px] rounded-xl min-w-[150px] max-w-[220px] truncate cursor-pointer transition-colors outline-none text-left"
        style={{
          background: values.length > 0 ? accentBg : "var(--bg-input)",
          color: values.length > 0 ? accentColor : "var(--text-primary)",
          border: values.length > 0 ? `1px solid ${accentBorder}` : "1px solid var(--border-input)",
          fontWeight: 500,
        }}
      >
        {label}
      </button>
      <ChevronDown
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        size={14}
        style={{ color: values.length > 0 ? accentColor : "var(--text-muted)" }}
      />
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 min-w-[210px] max-h-72 overflow-y-auto rounded-xl shadow-2xl py-1.5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-red-500 uppercase tracking-wide hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              Limpar seleção
            </button>
          )}
          {options.map((opt) => {
            const checked = values.includes(opt.value);
            return (
              <label
                key={opt.value}
                className="flex items-center gap-2.5 px-3.5 py-2 text-[13px] cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                style={{ color: "var(--text-primary)" }}
              >
                <input type="checkbox" className="hidden" checked={checked} onChange={() => toggleValue(opt.value)} />
                <span
                  className={cn(
                    "flex items-center justify-center w-4 h-4 rounded border shrink-0",
                    checked ? accentCheckedBg : "border-zinc-300 dark:border-zinc-700"
                  )}
                >
                  {checked && <Check size={11} className="text-white" strokeWidth={3} />}
                </span>
                <span className="font-medium truncate">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
