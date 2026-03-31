import { getDashboardData } from "@/app/actions/dashboard";
import DashboardClient from "./DashboardClient";

export default async function Page() {
  // Carrega com o mês e ano atuais para coincidir com o defaultFiltros do cliente
  const now = new Date(Date.now() - 3 * 3600 * 1000); // fuso -3h
  const data = await getDashboardData({
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  });
  return <DashboardClient initialData={data} />;
}
