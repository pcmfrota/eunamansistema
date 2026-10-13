import { useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { AuthProvider, useAuth } from "@/components/auth-context";
import { OfflineProvider } from "@/components/offline-provider";
import { LoginScreen } from "./screens/LoginScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { EquipamentosScreen } from "./screens/EquipamentosScreen";
import PneusPage from "./modules/pneus/PneusPage";
import BacklogPage from "./modules/backlog/BacklogPage";
import CaptacaoPage from "./modules/captacao/CaptacaoPage";
import MaoDeObraPage from "./modules/mao-de-obra/MaoDeObraPage";

type Tela = "menu" | "pneus" | "backlog" | "captacao" | "mao-de-obra" | "equipamentos";

function ComVoltar({ onVoltar, children }: { onVoltar: () => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-3">
        <button onClick={onVoltar} className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 dark:text-zinc-300">
          <ChevronLeft size={16} /> Menu
        </button>
      </div>
      {children}
    </div>
  );
}

function Conteudo() {
  const { user, loading } = useAuth();
  const [tela, setTela] = useState<Tela>("menu");
  const voltarAoMenu = () => setTela("menu");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (tela === "pneus") {
    return (
      <ComVoltar onVoltar={voltarAoMenu}>
        <PneusPage />
      </ComVoltar>
    );
  }

  if (tela === "backlog") {
    return (
      <ComVoltar onVoltar={voltarAoMenu}>
        <BacklogPage />
      </ComVoltar>
    );
  }

  if (tela === "captacao") {
    return (
      <ComVoltar onVoltar={voltarAoMenu}>
        <CaptacaoPage />
      </ComVoltar>
    );
  }

  if (tela === "mao-de-obra") {
    return (
      <ComVoltar onVoltar={voltarAoMenu}>
        <MaoDeObraPage />
      </ComVoltar>
    );
  }

  if (tela === "equipamentos") {
    return <EquipamentosScreen onVoltar={voltarAoMenu} />;
  }

  return <MenuScreen onSelecionar={(chave) => setTela(chave as Tela)} />;
}

export function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <Conteudo />
      </OfflineProvider>
    </AuthProvider>
  );
}
