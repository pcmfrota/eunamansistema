import { createClient } from "@/utils/supabase/server";
import PCMClient from "./PCMClient";

export const dynamic = "force-dynamic";

export default async function PCMPage() {
  const supabase = createClient();

  // Buscar preventivas com status calculado
  const { data: prevRaw } = await supabase
    .from("preventivas")
    .select(
      "id, equipamento_id, ultimo_horimetro, horimetro_atual, intervalo_horas, tipo_servico, equipamentos(placa, modelo)"
    )
    .order("created_at", { ascending: false });

  // Calcular status e horas restantes de cada preventiva
  const preventivas = (prevRaw ?? []).map((p: any) => {
    const restantes =
      Number(p.ultimo_horimetro) +
      Number(p.intervalo_horas) -
      Number(p.horimetro_atual);
    const percentual =
      p.intervalo_horas > 0
        ? Math.min(
            100,
            Math.round(
              ((Number(p.horimetro_atual) - Number(p.ultimo_horimetro)) /
                Number(p.intervalo_horas)) *
                100
            )
          )
        : 0;
    let status: "atrasado" | "atencao" | "no_prazo";
    if (restantes < 0) status = "atrasado";
    else if (restantes <= 50) status = "atencao";
    else status = "no_prazo";

    return {
      id: p.id,
      placa: p.equipamentos?.placa ?? "—",
      modelo: p.equipamentos?.modelo ?? "",
      tipo_servico: p.tipo_servico ?? "Preventiva",
      horas_restantes: Math.round(restantes),
      percentual,
      status,
    };
  });

  preventivas.sort((a, b) => a.horas_restantes - b.horas_restantes);

  // Últimas OS abertas (pendentes)
  const { data: osPendentes } = await supabase
    .from("ordens_servico")
    .select("id, placa, status, descricao_problema, data_abertura, motivo")
    .eq("status", "Aberta")
    .order("data_abertura", { ascending: false })
    .limit(10);

  return <PCMClient preventivas={preventivas} osPendentes={osPendentes ?? []} />;
}
