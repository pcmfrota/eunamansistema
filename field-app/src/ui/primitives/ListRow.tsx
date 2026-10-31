import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-zinc-900 border border-zinc-800 rounded-2xl ${className}`}>{children}</div>;
}

export function ListRow({
  title,
  subtitle,
  meta,
  badge,
  icon,
  onClick,
  rightSlot,
}: {
  title: string;
  subtitle?: string;
  meta?: string;
  badge?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  rightSlot?: ReactNode;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3.5 bg-zinc-900 border border-zinc-800 rounded-2xl text-left ${
        onClick ? "active:bg-zinc-800" : ""
      }`}
      style={{ minHeight: "var(--tap-min)" }}
    >
      {icon && <div className="shrink-0 p-2 rounded-xl bg-zinc-800 text-amber-500">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm text-zinc-50 truncate">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-zinc-500 truncate">{subtitle}</p>}
        {meta && <p className="text-[10px] text-zinc-600 truncate">{meta}</p>}
      </div>
      {rightSlot}
    </Comp>
  );
}
