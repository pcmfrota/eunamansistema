import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

export function AppBar({
  title,
  showBack = false,
  right,
}: {
  title?: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-1 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-2"
      style={{ paddingTop: "var(--safe-top)", height: "calc(var(--app-bar-height) + var(--safe-top))" }}
    >
      {showBack ? (
        <button
          onClick={() => navigate("/menu")}
          aria-label="Voltar"
          className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
          style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
        >
          <ChevronLeft size={22} />
        </button>
      ) : (
        <div style={{ width: "var(--tap-min)" }} />
      )}
      <h1 className="flex-1 truncate text-sm font-black text-zinc-50">{title}</h1>
      <div className="flex items-center" style={{ minHeight: "var(--tap-min)" }}>
        {right}
      </div>
    </header>
  );
}
