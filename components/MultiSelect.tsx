"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  /** Classe de cor do chip quando selecionado (ex: badge de status) */
  colorClass?: string;
}

// Filtro de múltipla seleção por chips removíveis (ex: Status = Pago × Ag. Pagamento ×).
// Não existia nenhum componente assim no app — todo filtro era select nativo de valor único.
export function MultiSelect({
  options,
  values,
  onChange,
  placeholder = "Todos",
  className,
}: {
  options: MultiSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggle = (value: string) => {
    if (values.includes(value)) onChange(values.filter((v) => v !== value));
    else onChange([...values, value]);
  };

  const remove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(values.filter((v) => v !== value));
  };

  return (
    <div className={cn("relative w-full flex items-center", className)} ref={wrapperRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full min-h-[42px] px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm flex items-center flex-wrap gap-1.5 cursor-pointer transition-all",
          isOpen && "ring-2 ring-blue-500/30 border-blue-500"
        )}
      >
        {values.length === 0 ? (
          <span className="text-zinc-400 text-sm py-0.5">{placeholder}</span>
        ) : (
          values.map((v) => {
            const opt = options.find((o) => o.value === v);
            if (!opt) return null;
            return (
              <span
                key={v}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
                  opt.colorClass || "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                )}
              >
                {opt.label}
                <button type="button" onClick={(e) => remove(v, e)} className="hover:opacity-70">
                  <X size={11} />
                </button>
              </span>
            );
          })
        )}
        <ChevronDown size={14} className={cn("text-zinc-400 ml-auto shrink-0 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl max-h-60 overflow-y-auto p-1">
          {options.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={values.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-zinc-300"
              />
              <span className="text-zinc-700 dark:text-zinc-300">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
