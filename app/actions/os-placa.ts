'use server'

import { createClient } from '@/utils/supabase/server'

export interface OrdemServicoResumo {
  id: string
  numero_os: string
  status: string
  classe: string
  data_abertura: string
  data_fechamento: string | null
  descricao: string | null
  sistema: string | null
  sub_sistema: string | null
  horas_manutencao: number | null
  motivo: string | null
  local: string | null
  modulo: string | null
  horas_impacto_do?: number 
  foi_enviado_reserva?: boolean | null
  horario_parada?: string | null
  qual_reserva?: string | null
  horas_reserva_chegou?: string | null
}

function parseLocal(dateStr: string | null): number {
  if (!dateStr) return 0;
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5])
    ).getTime();
  }
  const matchBR = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (matchBR) {
    return new Date(
      parseInt(matchBR[3]),
      parseInt(matchBR[2]) - 1,
      parseInt(matchBR[1]),
      parseInt(matchBR[4]),
      parseInt(matchBR[5])
    ).getTime();
  }
  return new Date(dateStr).getTime();
}

const osPlacaCache = new Map<string, { data: OrdemServicoResumo[], timestamp: number }>();
const CACHE_TTL = 30 * 1000; // 30 segundos de cache para detalhes de veículo

export async function buscarOSporPlaca(
  placa: string,
  mes?: number,
  ano?: number,
  dataInicio?: string,
  dataFim?: string
): Promise<OrdemServicoResumo[]> {
  const cacheKey = `${placa}-${mes}-${ano}-${dataInicio}-${dataFim}`;
  const now = Date.now();
  const cached = osPlacaCache.get(cacheKey);
  
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  const supabase = createClient()
  const agoraRef = new Date()

  let inicio: string
  let fim: string

  if (dataInicio && dataFim) {
    inicio = dataInicio
    fim = dataFim.includes('T') ? dataFim : `${dataFim}T23:59:59`
  } else if (mes && ano) {
    // Busca o período Suzano exato para consistência global
    const { data: cal } = await supabase
      .from('calendario_suzano')
      .select('*')
      .eq('mes', mes)
      .eq('ano', ano)
      .single()

    if (cal) {
      inicio = cal.data_inicio
      fim = `${cal.data_fim}T23:59:59`
    } else {
      // Fallback: mês civil
      inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}T23:59:59`
    }
  } else {
    // Sem filtro de data — retorna tudo
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo, horario_parada, foi_enviado_reserva, qual_reserva, horas_reserva_chegou')
      .eq('placa', placa.toUpperCase())
      .order('data_abertura', { ascending: false })
      .limit(50)
    const result = (data || []) as OrdemServicoResumo[];
    osPlacaCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // OS que tocam o período:
  // - Abertas até o fim do período (data_abertura ou horario_parada), E
  // - Ainda não fechadas OU fechadas após o início do período
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo, horario_parada, horas_reserva_chegou')
    .eq('placa', placa.toUpperCase())
    .or(`data_abertura.lte.${fim},horario_parada.lte.${fim}`)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`)
    .order('data_abertura', { ascending: false })
    .limit(100)

  if (error) return []

  // --- Coleta de Dados do Veículo e Escala ---
  const { data: escala } = await supabase
    .from('escala_frota')
    .select(`
      periodo_inicio,
      periodo_fim,
      carga_horaria
    `)
    .eq('placa', placa.toUpperCase())
    .single();

  const osCalculadas = (data || []).map((os: any) => {
    let hImpactoDO = 0
    const osStart = parseLocal(os.horario_parada || os.data_abertura)
    const endMecRaw = os.data_fechamento ? parseLocal(os.data_fechamento) : agoraRef.getTime()
    const endMec = endMecRaw

    // Lógica PCM: Impacto Operacional encerra na chegada do reserva ou fim do conserto
    let osEndDO = endMec
    if (os.foi_enviado_reserva) {
      if (os.horas_reserva_chegou) {
        const reservaTime = parseLocal(os.horas_reserva_chegou)
        if (reservaTime > osStart && reservaTime < endMec) {
          osEndDO = reservaTime
        }
      } else {
        osEndDO = osStart
      }
    }

    // Fallback para horas de manutenção se estiver zerado/nulo
    let hMecCalculada = os.horas_manutencao || (endMec - osStart) / 3600000

    if (escala && (os.data_abertura || os.horario_parada)) {
      const dIni = new Date(osStart)
      const dFim = new Date(osEndDO)
      
      const [hS, minS] = (escala.periodo_inicio || "00:00").split(":").map(Number);
      const [hE, minE] = (escala.periodo_fim || "23:59").split(":").map(Number);

      for (let day = new Date(dIni.getFullYear(), dIni.getMonth(), dIni.getDate()); day <= dFim; day.setDate(day.getDate() + 1)) {
        const y = day.getFullYear();
        const m = day.getMonth();
        const d = day.getDate();

        let sS = new Date(y, m, d, hS, minS || 0).getTime();
        let sE = new Date(y, m, d, hE, minE || 0).getTime();
        if (sE <= sS) sE += 86400000;

        const interInicio = Math.max(osStart, sS)
        const interFim = Math.min(osEndDO, sE)
        if (interInicio < interFim) {
          hImpactoDO += (interFim - interInicio) / 3600000
        }
      }
    }
    return {
      ...os,
      placa: os.equipamento?.placa || placa.toUpperCase(),
      horimetro: os.horimetro,
      horas_manutencao: Math.round(hMecCalculada * 10) / 10,
      horas_impacto_do: Math.round(hImpactoDO * 10) / 10
    }
  })

  const result = osCalculadas as OrdemServicoResumo[];
  osPlacaCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}
