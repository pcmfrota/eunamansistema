import { getDashboardData } from "./actions/dashboard";
import DashboardClient from "./DashboardClient";

export default async function Page() {
  // Busca os dados no servidor para carregamento instantâneo
  const initialData = await getDashboardData({ categoria: "PESADA" });
  
  return <DashboardClient initialData={initialData} />;
}
