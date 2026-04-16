import { getDashboardData } from "@/app/actions/dashboard";
import DashboardClient from "./DashboardClient";

export default async function Page() {
  // Carrega já com PESADA como categoria padrão,
  // igual ao defaultFiltros do DashboardClient (sem mismatch)
  const now = new Date(Date.now() - 3 * 3600 * 1000); // fuso -3h Brasil
  const data = await getDashboardData({
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    categoria: "PESADA",
  });
  return <DashboardClient initialData={data} />;
}
