import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import LavagensPage from "./modules/lavagens/LavagensPage";
import PreventivasPage from "./modules/preventivas/PreventivasPage";
import LubrificacaoPage from "./modules/lubrificacao/LubrificacaoPage";
import InsumosPage from "./modules/insumos/InsumosPage";
import ChecklistMecanicosPage from "./modules/checklist-mecanicos/ChecklistMecanicosPage";
import OSPage from "./modules/os/OSPage";

// Rotas que valem a pena restaurar quando o app reabre sem hash nenhum na URL (ex: depois
// que o Android mata o processo em segundo plano e o WebView força um reload do zero —
// nesse caminho o restoreState() nativo nem sempre preserva o hash de fato, então sem isso
// o usuário sempre cai de volta no Menu em vez de continuar de onde parou).
const LAST_ROUTE_KEY = "field-app:last-route";
const ROTAS_RESTAURAVEIS = ["/pneus", "/backlog", "/captacao", "/mao-de-obra", "/lavagens", "/preventivas", "/lubrificacao", "/insumos", "/checklist-mecanicos", "/os", "/equipamentos"];

function lerUltimaRota(): string {
  try {
    const salva = localStorage.getItem(LAST_ROUTE_KEY);
    return salva && ROTAS_RESTAURAVEIS.includes(salva) ? salva : "/menu";
  } catch {
    return "/menu";
  }
}

function useRastrearRota() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname === "/") return;
    try {
      localStorage.setItem(LAST_ROUTE_KEY, location.pathname);
    } catch {
      // localStorage indisponível (modo privado/quota) — só perde a restauração, não quebra nada.
    }
  }, [location.pathname]);
}

function Conteudo() {
  const { user, loading } = useAuth();
  useRastrearRota();

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
        <Route path="/" element={<Navigate to={lerUltimaRota()} replace />} />
        <Route path="/menu" element={<MenuScreen />} />
        <Route path="/pneus" element={<PneusPage />} />
        <Route path="/backlog" element={<BacklogPage />} />
        <Route path="/captacao" element={<CaptacaoPage />} />
        <Route path="/mao-de-obra" element={<MaoDeObraPage />} />
        <Route path="/lavagens" element={<LavagensPage />} />
        <Route path="/preventivas" element={<PreventivasPage />} />
        <Route path="/lubrificacao" element={<LubrificacaoPage />} />
        <Route path="/insumos" element={<InsumosPage />} />
        <Route path="/checklist-mecanicos" element={<ChecklistMecanicosPage />} />
        <Route path="/os" element={<OSPage />} />
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
