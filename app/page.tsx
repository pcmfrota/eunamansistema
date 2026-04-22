import { Suspense } from "react";
import { getDashboardData } from "./actions/dashboard";
import DashboardClient from "./DashboardClient";
import { PremiumLoader } from "@/components/premium-loader";

// Componente que busca os dados de forma assíncrona
async function DashboardContent() {
  const initialData = await getDashboardData({ categoria: "PESADA" });
  return <DashboardClient initialData={initialData} />;
}

// Página principal que renderiza a estrutura imediatamente
export default function Page() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[60vh] w-full">
        <PremiumLoader 
          type="squares-sequential" 
          text="Processando Indicadores" 
          subtext=" PCM • Sincronizando Frota e Calendário Suzano" 
        />
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
