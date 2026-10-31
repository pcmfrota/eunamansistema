import { BottomSheet } from "./BottomSheet";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4 pb-2">
        {description && <p className="text-xs text-zinc-400 leading-relaxed">{description}</p>}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`w-full rounded-xl text-sm font-black text-white ${
              destructive ? "bg-red-600 active:bg-red-700" : "bg-amber-600 active:bg-amber-700"
            }`}
            style={{ minHeight: "var(--tap-min)" }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onClose}
            className="w-full rounded-xl text-sm font-bold text-zinc-300 bg-zinc-800 active:bg-zinc-700"
            style={{ minHeight: "var(--tap-min)" }}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
