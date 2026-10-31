import type { ComponentType } from "react";
import { BottomSheet } from "./BottomSheet";

export type ActionSheetItem = {
  key: string;
  label: string;
  icon?: ComponentType<{ size?: number }>;
  destructive?: boolean;
  onSelect: () => void;
};

export function ActionSheet({
  open,
  onClose,
  title,
  items,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  items: ActionSheetItem[];
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-1 pb-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                item.onSelect();
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 rounded-xl text-sm font-bold active:bg-zinc-800 ${
                item.destructive ? "text-red-400" : "text-zinc-100"
              }`}
              style={{ minHeight: "var(--tap-min)" }}
            >
              {Icon && <Icon size={18} />}
              {item.label}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
