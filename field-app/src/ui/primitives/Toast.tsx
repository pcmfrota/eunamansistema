import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; message: string };

const KIND_STYLE: Record<ToastKind, string> = {
  success: "border-emerald-500/30 text-emerald-400",
  error: "border-red-500/30 text-red-400",
  info: "border-zinc-700 text-zinc-200",
};

const KIND_ICON = { success: CheckCircle2, error: AlertTriangle, info: Info };

const ToastContext = createContext<{ show: (message: string, kind?: ToastKind) => void } | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de um ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[calc(100%-32px)] max-w-sm pointer-events-none"
        style={{ bottom: "calc(var(--nav-bar-height) + var(--safe-bottom) + 16px)" }}
      >
        {items.map((item) => {
          const Icon = KIND_ICON[item.kind];
          return (
            <div
              key={item.id}
              className={`flex items-center gap-2 px-3.5 py-3 rounded-2xl bg-zinc-900 border shadow-lg text-xs font-bold ${KIND_STYLE[item.kind]}`}
            >
              <Icon size={16} />
              <span className="text-zinc-100">{item.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
