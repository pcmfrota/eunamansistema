import DashboardClient from "./DashboardClient";

export default function Page() {
  // Removido o await do servidor para evitar bloqueio do carregamento inicial (splash screen)
  // O DashboardClient agora gerencia o próprio estado de carregamento inicial
  return <DashboardClient />;
}
