import { NavLink } from "react-router-dom";
import { LayoutGrid, Circle, ListChecks, Hammer, ClipboardCheck, Droplets } from "lucide-react";
import { useAuth } from "@/components/auth-context";

// 5 módulos de maior uso em campo, na ordem definida com o usuário — os demais (Mão de
// Obra, Lavagens, Preventivas, Lubrificação, Insumos) ficam só no grid "Outros Módulos" do
// Início (MenuScreen.tsx), não na barra fixa.
const ITENS = [
  { to: "/menu", label: "Início", icon: LayoutGrid },
  { to: "/backlog", label: "Backlog", icon: ListChecks },
  { to: "/pneus", label: "Pneus", icon: Circle },
  { to: "/os", label: "O.S.", icon: Hammer },
  { to: "/checklist-mecanicos", label: "Check", icon: ClipboardCheck },
  { to: "/captacao", label: "Captação", icon: Droplets },
];

export function BottomNav() {
  const { permissions, isAdmin } = useAuth();
  // "/menu" (Início) sempre aparece; os módulos seguem a mesma permissão individual do
  // restante do app (ver MenuScreen.tsx) — item sem permissão simplesmente não entra na
  // barra, em vez de levar a uma tela que o RotaProtegida (App.tsx) ia barrar de qualquer jeito.
  const itensVisiveis = ITENS.filter((item) => item.to === "/menu" || isAdmin || permissions.includes(item.to));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex bg-zinc-950/95 backdrop-blur border-t border-zinc-800"
      style={{ paddingBottom: "var(--safe-bottom)", height: "calc(var(--nav-bar-height) + var(--safe-bottom))" }}
    >
      {itensVisiveis.map(({ to, label, icon: Icon }) => (
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
