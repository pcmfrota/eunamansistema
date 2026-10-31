import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AppBar } from "./AppBar";
import { BottomNav } from "./BottomNav";
import { OfflineStatusBadge } from "./OfflineSyncSheet";

const ROUTE_TITLES: Record<string, string> = {
  "/menu": "EUNAMAN Campo",
  "/pneus": "Boletim de Pneus",
  "/backlog": "Backlog",
  "/captacao": "Captação de Água",
  "/mao-de-obra": "Mão de Obra",
  "/equipamentos": "Equipamentos (teste)",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const title = ROUTE_TITLES[pathname] ?? "";
  const showBack = pathname !== "/menu";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 flex flex-col">
      <AppBar title={title} showBack={showBack} right={<OfflineStatusBadge />} />
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "calc(var(--nav-bar-height) + var(--safe-bottom))" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
