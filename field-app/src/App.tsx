import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/components/auth-context";
import { OfflineProvider } from "@/components/offline-provider";
import { ToastProvider } from "./ui/primitives/Toast";
import { AppShell } from "./ui/primitives/AppShell";
import { LoginScreen } from "./screens/LoginScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { EquipamentosScreen } from "./screens/EquipamentosScreen";
import PneusPage from "./modules/pneus/PneusPage";
import BacklogPage from "./modules/backlog/BacklogPage";
import CaptacaoPage from "./modules/captacao/CaptacaoPage";
import MaoDeObraPage from "./modules/mao-de-obra/MaoDeObraPage";

function Conteudo() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-zinc-400 text-sm">
        Carregando...
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/menu" replace />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/pneus" element={<PneusPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/captacao" element={<CaptacaoPage />} />
        <Route path="/mao-de-obra" element={<MaoDeObraPage />} />
        <Route path="/equipamentos" element={<EquipamentosScreen />} />
        <Route path="*" element={<Navigate to="/menu" replace />} />
      </Routes>
    </AppShell>
  );
}

export function App() {
  return (
    <AuthProvider>
      <OfflineProvider>
        <ToastProvider>
          <HashRouter>
            <Conteudo />
          </HashRouter>
        </ToastProvider>
      </OfflineProvider>
    </AuthProvider>
  );
}
