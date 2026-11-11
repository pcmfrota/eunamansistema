import { useEffect } from "react";
import { createPortal } from "react-dom";
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

  // Portal pra document.body: um BottomSheet aberto a partir do botão de status de
  // sincronização (AppBar -> OfflineStatusBadge) ficava preso dentro da caixinha do
  // próprio cabeçalho (uns 150px de altura, colado na status bar) em vez de cobrir a tela
  // inteira — mesmo sendo "fixed inset-0". Causa: o <header> da AppBar tem backdrop-blur
  // (CSS backdrop-filter), e um backdrop-filter/filter/transform num ancestral cria um
  // novo "containing block" pra descendentes position:fixed, que passam a se posicionar
  // relativos a ESSE ancestral (o header) em vez do viewport. Renderizando fora da árvore
  // do header via portal, o sheet escapa desse problema (mesmo padrão já usado em
  // modules/captacao/CaptacaoClient.tsx).
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className={`relative flex flex-col bg-zinc-900 border-t border-zinc-800 ${
          fullHeight ? "h-[92vh] h-[92dvh]" : "max-h-[85vh] max-h-[85dvh]"
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
    </div>,
    document.body
  );
}
