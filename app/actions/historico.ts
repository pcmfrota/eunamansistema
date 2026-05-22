"use server";

import { getDashboardData } from "./dashboard";

const historicoCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutos

export async function getHistoricoMensal(categoria: string = "PESADA") {
  const cacheKey = `historico_${categoria}`;
  const cached = historicoCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const result = [];
  const hoje = new Date();
  
  // Pegar os últimos 6 meses (incluindo o atual)
  const monthsToFetch = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    monthsToFetch.push({ mes: d.getMonth() + 1, ano: d.getFullYear() });
  }

  // Busca os dados de forma paralela usando o motor já existente
  const results = await Promise.all(
    monthsToFetch.map(m => getDashboardData({ mes: m.mes, ano: m.ano, categoria }))
  );

  const MESES_ABREV = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const m = monthsToFetch[i];
    result.push({
      mes: `${MESES_ABREV[m.mes]}/${String(m.ano).slice(2)}`,
      dm: r.dm,
      doOp: r.doOperacional,
    });
  }

  historicoCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}
