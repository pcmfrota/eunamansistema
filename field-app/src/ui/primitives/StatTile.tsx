import type { ComponentType, ReactNode } from "react";

const ACCENT_CLASS: Record<"amber" | "emerald" | "red" | "zinc", string> = {
  amber: "text-amber-500 bg-amber-500/10",
  emerald: "text-emerald-500 bg-emerald-500/10",
  red: "text-red-500 bg-red-500/10",
  zinc: "text-zinc-400 bg-zinc-500/10",
};

export function StatTile({
  icon: Icon,
  label,
  value,
  accent = "amber",
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: ReactNode;
  accent?: "amber" | "emerald" | "red" | "zinc";
}) {
  return (
    <div className="flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl">
      <div className={`shrink-0 p-2 rounded-xl ${ACCENT_CLASS[accent]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-zinc-50 leading-tight truncate">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 truncate">{label}</p>
      </div>
    </div>
  );
}
