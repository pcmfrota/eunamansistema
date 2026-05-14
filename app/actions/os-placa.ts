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
  // D+1: nunca considerar dados do dia atual
  const ontem = new Date(agoraRef)
  ontem.setDate(ontem.getDate() - 1)
  ontem.setHours(23, 59, 59, 999)

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
      // Aplicar D+1: nunca considerar além de ontem
      const calFim = new Date(cal.data_fim + 'T23:59:59')
      const fimEfetivo = calFim > ontem ? ontem : calFim
      fim = fimEfetivo.toISOString()
    } else {
      // Fallback: mês civil
      inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}T23:59:59`
    }
  } else {
    // Sem filtro de data — retorna tudo
    const { data: eqData } = await supabase.from('equipamentos').select('id').ilike('placa', placa.trim()).maybeSingle();
    const eqId = eqData?.id;
    if (!eqId) return [];

    const { data, error } = await supabase
      .from('ordens_servico')
      .select('*')
      .eq('equipamento_id', eqId)
      // D+1: Nunca considerar OS abertas hoje
      .lte("data_abertura", ontem.toISOString())
      .order('data_abertura', { ascending: false })
      .limit(50)
    
    // Para as OS retornadas, calcular as horas respeitando D+1
    const result = (data || []).map(os => {
      const osStart = parseLocal(os.horario_parada || os.data_abertura)
      const endMec = os.data_fechamento ? parseLocal(os.data_fechamento) : ontem.getTime()
      let hMecCalculada = os.horas_manutencao || Math.max(0, (endMec - osStart) / 3600000)
      
      return {
        ...os,
        horas_manutencao: Math.round(hMecCalculada * 10) / 10
      }
    }) as OrdemServicoResumo[];

    osPlacaCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // OS que tocam o período:
  // - Abertas até o fim do período (data_abertura ou horario_parada), E
  // - Ainda não fechadas OU fechadas após o início do período
  // 1. Busca o ID do equipamento de forma robusta
  const { data: eqData } = await supabase
    .from('equipamentos')
    .select('id, placa')
    .ilike('placa', placa.trim())
    .maybeSingle();

  const eqId = eqData?.id;
  if (!eqId) return [];

  // OS que tocam o período:
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('*, equipamento:equipamento_id(placa)')
    .eq('equipamento_id', eqId)
    .or(`data_abertura.lte.${fim},horario_parada.lte.${fim}`)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`)
    .order('data_abertura', { ascending: false })
    .limit(100);

  if (error || !data) return [];

  // --- Coleta de Dados da Escala ---
  const { data: escala } = await supabase
    .from('escala_frota')
    .select('periodo_inicio, periodo_fim, carga_horaria')
    .ilike('placa', placa.trim())
    .maybeSingle();

  const osCalculadas = (data || []).map((os: any) => {
    let hImpactoDO = 0
    const osStart = parseLocal(os.horario_parada || os.data_abertura)
    // Regra D+1: se aberta, conta apenas até ontem
    const endMec = os.data_fechamento ? parseLocal(os.data_fechamento) : ontem.getTime()

    // Lógica PCM: Impacto Operacional encerra na chegada do reserva ou fim do conserto
    let osEndDO = endMec
    if (os.foi_enviado_reserva && os.horas_reserva_chegou) {
      const reservaTime = parseLocal(os.horas_reserva_chegou)
      // O reserva só "para" o cronômetro operacional se chegar ANTES do conserto acabar (e respeitando o limite D+1)
      if (reservaTime > osStart && reservaTime < endMec) {
        osEndDO = reservaTime
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
