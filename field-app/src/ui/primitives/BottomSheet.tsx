import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  fullHeight = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  fullHeight?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-zinc-900 border-t border-zinc-800 ${
          fullHeight ? "h-[92vh]" : "max-h-[85vh]"
        }`}
        style={{
          borderTopLeftRadius: "var(--radius-sheet-top)",
          borderTopRightRadius: "var(--radius-sheet-top)",
          paddingBottom: "var(--safe-bottom)",
        }}
      >
        <div className="flex items-center justify-center pt-2.5 pb-1 shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-4 pb-2 shrink-0">
            <h2 className="text-sm font-black text-zinc-50">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <X size={18} />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}
