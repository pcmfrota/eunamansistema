import { NavLink } from "react-router-dom";
import { LayoutGrid, Circle, ListChecks, Clock, Droplets } from "lucide-react";

const ITENS = [
  { to: "/menu", label: "Início", icon: LayoutGrid },
  { to: "/pneus", label: "Pneus", icon: Circle },
  { to: "/backlog", label: "Backlog", icon: ListChecks },
  { to: "/mao-de-obra", label: "M. Obra", icon: Clock },
  { to: "/captacao", label: "Captação", icon: Droplets },
];

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex bg-zinc-950/95 backdrop-blur border-t border-zinc-800"
      style={{ paddingBottom: "var(--safe-bottom)", height: "calc(var(--nav-bar-height) + var(--safe-bottom))" }}
    >
      {ITENS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold ${
              isActive ? "text-amber-500" : "text-zinc-500"
            }`
          }
          style={{ minHeight: "var(--tap-min)" }}
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
