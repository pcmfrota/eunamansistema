"use server";

import { createClient } from "@/utils/supabase/server";
import { getDashboardData } from "./dashboard";

const historicoCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_CURRENT = 30 * 1000; // 30 segundos para o mês atual
const CACHE_TTL_PAST = 24 * 60 * 60 * 1000; // 24 horas para meses passados já finalizados

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

  // Prepara tarefas e resolve itens em cache instantaneamente
  const results: any[] = new Array(monthsToFetch.length);
  const pendingIndices: number[] = [];

  monthsToFetch.forEach((m, i) => {
    const isPastMonth = m.ano < anoAtualRef || (m.ano === anoAtualRef && m.mes < mesAtualRef);
    const cacheKey = JSON.stringify({ mes: m.mes, ano: m.ano, categoria, ...filtrosAdicionais });
    const cached = historicoCache.get(cacheKey);
    const ttl = isPastMonth ? CACHE_TTL_PAST : CACHE_TTL_CURRENT;

    if (cached && (now - cached.timestamp) < ttl) {
      results[i] = cached.data;
    } else {
      pendingIndices.push(i);
    }
  });

  // Executa os pendentes em lotes de 3 para não sobrecarregar o banco de dados
  const BATCH_SIZE = 3;
  for (let i = 0; i < pendingIndices.length; i += BATCH_SIZE) {
    const batch = pendingIndices.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async idx => {
        const m = monthsToFetch[idx];
        const cacheKey = JSON.stringify({ mes: m.mes, ano: m.ano, categoria, ...filtrosAdicionais });
        
        const r = await getDashboardData({
          mes: m.mes,
          ano: m.ano,
          categoria,
          modulo: filtrosAdicionais?.modulo,
          area: filtrosAdicionais?.area,
          placa: filtrosAdicionais?.placa,
          filial: filtrosAdicionais?.filial
        });

        historicoCache.set(cacheKey, { data: r, timestamp: Date.now() });
        results[idx] = r;
      })
    );
  }

  return results.map((r, i) => {
    const m = monthsToFetch[i];
    return {
      mes: `${MESES_ABREV[m.mes]}/${String(m.ano).slice(2)}`,
      dm: r?.dm ?? 0,
      doOp: r?.doOperacional ?? 0,
    };
  });
}


