"use server";

import { createClient } from "@/utils/supabase/server";

export type PeriodoSuzano = {
  mes: number;
  ano: number;
  data_inicio: string;
  data_fim: string;
  label: string;
};

export type OSDashboardData = {
  periodos: PeriodoSuzano[];
  ordens: {
    id: string;
    numero_os: string;
    placa: string | null;
    modulo: string | null;
    status: string | null;
    data_abertura: string;
    data_fechamento: string | null;
    horas_manutencao: number | null;
    classe: string | null;
    motivo: string | null;
    sistema: string | null;
    sub_sistema: string | null;
    equipamento_id: string;
  }[];
};

const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export async function getOSDashboardData(): Promise<OSDashboardData> {
  const supabase = createClient();

  const [periRes, osRes] = await Promise.all([
    supabase
      .from("calendario_suzano")
      .select("mes, ano, data_inicio, data_fim")
      .order("ano", { ascending: true })
      .order("mes", { ascending: true }),
    supabase
      .from("ordens_servico")
      .select("id, numero_os, placa, modulo, status, data_abertura, data_fechamento, horas_manutencao, classe, motivo, sistema, sub_sistema, equipamento_id")
      .order("data_abertura", { ascending: false }),
  ]);

  const periodos: PeriodoSuzano[] = (periRes.data ?? []).map((p: any) => ({
    mes: p.mes,
    ano: p.ano,
    data_inicio: p.data_inicio,
    data_fim: p.data_fim,
    label: `${MESES_PT[(p.mes - 1) % 12]}/${p.ano}`,
  }));

  return {
    periodos,
    ordens: osRes.data ?? [],
  };
}
