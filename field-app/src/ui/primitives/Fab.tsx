import type { ReactNode } from "react";

export function Fab({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: ReactNode;
  label?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed z-30 flex items-center gap-2 rounded-full bg-amber-600 text-white font-bold shadow-lg shadow-black/40 active:bg-amber-700 px-4"
      style={{
        right: "calc(16px + var(--safe-right))",
        bottom: "calc(var(--nav-bar-height) + var(--safe-bottom) + 16px)",
        minHeight: "52px",
      }}
    >
      {icon}
      {label && <span className="text-sm pr-1">{label}</span>}
    </button>
  );
}
