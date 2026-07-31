"use server";

import { createClient } from "@/utils/supabase/server";
import { getDashboardData } from "./dashboard";

const historicoCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_CURRENT = 30 * 1000; // 30 segundos para o mês atual
const CACHE_TTL_PAST = 60 * 60 * 1000; // 1 hora para meses passados já finalizados

export async function getHistoricoMensal(
  categoria: string = "PESADA",
  filtrosAdicionais?: { modulo?: string; area?: string; placa?: string; filial?: string }
) {
  const hoje = new Date();
  const todayStr = hoje.toISOString().split('T')[0];
  const supabase = createClient();

  let targetMaxMes = hoje.getMonth() + 1;
  let anoAtualRef = hoje.getFullYear();

  try {
    const { data: calSuzano } = await supabase
      .from("calendario_suzano")
      .select("mes, ano")
      .lte("data_inicio", todayStr)
      .gte("data_fim", todayStr)
      .maybeSingle();

    if (calSuzano?.mes) {
      targetMaxMes = Math.max(targetMaxMes, calSuzano.mes);
      if (calSuzano.ano) anoAtualRef = calSuzano.ano;
    }
  } catch (err) {
    console.error("Erro ao buscar calendario_suzano no historico:", err);
  }

  const mesAtualRef = targetMaxMes;
  const now = Date.now();

  const monthsToFetch = [];
  for (let m = 1; m <= targetMaxMes; m++) {
    monthsToFetch.push({ mes: m, ano: anoAtualRef });
  }

  const MESES_ABREV = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  // Busca os dados com cache inteligente individual por mês
  const results = await Promise.all(
    monthsToFetch.map(async m => {
      const isPastMonth = m.ano < anoAtualRef || (m.ano === anoAtualRef && m.mes < mesAtualRef);
      const cacheKey = JSON.stringify({ mes: m.mes, ano: m.ano, categoria, ...filtrosAdicionais });
      const cached = historicoCache.get(cacheKey);
      const ttl = isPastMonth ? CACHE_TTL_PAST : CACHE_TTL_CURRENT;

      if (cached && (now - cached.timestamp) < ttl) {
        return cached.data;
      }

      const r = await getDashboardData({
        mes: m.mes,
        ano: m.ano,
        categoria,
        modulo: filtrosAdicionais?.modulo,
        area: filtrosAdicionais?.area,
        placa: filtrosAdicionais?.placa,
        filial: filtrosAdicionais?.filial
      });

      historicoCache.set(cacheKey, { data: r, timestamp: now });
      return r;
    })
  );

  return results.map((r, i) => {
    const m = monthsToFetch[i];
    return {
      mes: `${MESES_ABREV[m.mes]}/${String(m.ano).slice(2)}`,
      dm: r.dm,
      doOp: r.doOperacional,
    };
  });
}


