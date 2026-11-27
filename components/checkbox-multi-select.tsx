"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
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
  /** Mostra a opção "Selecionar todos" no topo da lista (e o rótulo "Todos" quando tudo está marcado). */
  selecionarTodos?: boolean;
}

// Dropdown de múltipla seleção com checkbox — substitui os antigos <select> de valor único
// nos filtros de listagem/dashboard do sistema inteiro. Mesma casca visual (pill com seta)
// do <select> original, pra não mudar o layout das telas que já o usam; o que muda é que
// abre um painel com uma checkbox por opção em vez de trocar de valor direto.
export function CheckboxMultiSelect({ values, onChange, options, placeholder, className, accent = "green", selecionarTodos = false }: CheckboxMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  // O painel abre num portal (fixed, no body) pra nunca ficar atrás de cards/gráficos
  // vizinhos nem ser cortado por containers com overflow — antes era absolute dentro da
  // barra de filtros e os cards de baixo cobriam a lista.
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const accentColor = accent === "amber" ? "#d97706" : "#16a34a";
  const accentBg = accent === "amber" ? "rgba(217,119,6,0.1)" : "rgba(34,197,94,0.1)";
  const accentBorder = accent === "amber" ? "rgba(217,119,6,0.3)" : "rgba(34,197,94,0.3)";
  const accentCheckedBg = accent === "amber" ? "bg-amber-500 border-amber-500" : "bg-green-500 border-green-500";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const alvo = event.target as Node;
      if (wrapperRef.current && !wrapperRef.current.contains(alvo) && !painelRef.current?.contains(alvo)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) { setBusca(""); return; }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setIsOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [isOpen]);

  // Posição do painel: abaixo do botão; se não couber, abre pra cima. Acompanha rolagem/redimensionamento.
  useLayoutEffect(() => {
    if (!isOpen) { setPos(null); return; }
    const calcular = () => {
      const r = wrapperRef.current?.getBoundingClientRect();
      if (!r) return;
      const margem = 8;
      const abaixo = window.innerHeight - r.bottom - margem;
      const acima = r.top - margem;
      const left = Math.max(margem, Math.min(r.left, window.innerWidth - 230));
      if (abaixo >= 220 || abaixo >= acima) setPos({ left, top: r.bottom + 6, maxHeight: Math.min(320, abaixo - 6) });
      else setPos({ left, bottom: window.innerHeight - r.top + 6, maxHeight: Math.min(320, acima - 6) });
    };
    calcular();
    window.addEventListener("resize", calcular);
    window.addEventListener("scroll", calcular, true);
    return () => { window.removeEventListener("resize", calcular); window.removeEventListener("scroll", calcular, true); };
  }, [isOpen]);

  const termo = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const opcoesVisiveis = termo
    ? options.filter((o) => o.label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(termo))
    : options;

  const toggleValue = (val: string) => {
    onChange(values.includes(val) ? values.filter((v) => v !== val) : [...values, val]);
  };

  const todosMarcados = options.length > 0 && options.every((o) => values.includes(o.value));
  const label =
    values.length === 0
      ? placeholder
      : selecionarTodos && todosMarcados && options.length > 1
      ? "Todos"
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
      {isOpen && pos && typeof document !== "undefined" && createPortal(
        <div
          ref={painelRef}
          className="fixed z-[1000] min-w-[210px] max-w-[320px] flex flex-col rounded-xl shadow-2xl overflow-hidden backdrop-blur-md"
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight, minWidth: Math.max(210, wrapperRef.current?.offsetWidth || 0), background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
        >
          {options.length > 8 && (
            <div className="relative p-2 border-b shrink-0" style={{ borderColor: "var(--border-color)" }}>
              <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }} />
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="w-full pl-7 pr-2 py-1.5 text-[13px] rounded-lg outline-none"
                style={{ background: "var(--bg-input)", border: "1px solid var(--border-input)", color: "var(--text-primary)" }}
              />
            </div>
          )}
          <div className="overflow-y-auto py-1.5">
          {selecionarTodos && !todosMarcados && (
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
              className="w-full text-left px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
              style={{ color: accentColor }}
            >
              Selecionar todos
            </button>
          )}
          {values.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-left px-3.5 py-2 text-[11px] font-bold text-red-500 uppercase tracking-wide hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              Limpar seleção
            </button>
          )}
          {opcoesVisiveis.length === 0 && (
            <p className="px-3.5 py-2 text-[12px]" style={{ color: "var(--text-muted)" }}>Nada encontrado.</p>
          )}
          {opcoesVisiveis.map((opt) => {
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
        </div>,
        document.body
      )}
    </div>
  );
}
