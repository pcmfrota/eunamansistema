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
  // Tenta formato PT-BR legado: DD/MM/YYYY HH:mm — o parser nativo do Date não entende isso.
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
  // ISO (com ou sem timezone, ex: "...+00:00" vindo do Postgres timestamptz) — o parser
  // nativo já respeita o offset gravado. A reconstrução manual que existia aqui antes
  // descartava esse offset e tratava os números como se já fossem hora local, criando
  // um erro sistemático de 3h (o fuso de Brasília) em cada OS.
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
  
  // D+1: nunca considerar dados do dia atual
  const agoraRef = new Date()
  const ontemDate = new Date(agoraRef.getTime() - 24 * 60 * 60 * 1000)
  const yyyy = ontemDate.getFullYear()
  const mm = String(ontemDate.getMonth() + 1).padStart(2, '0')
  const dd = String(ontemDate.getDate()).padStart(2, '0')
  const ontemStr = `${yyyy}-${mm}-${dd}T23:59:59`
  const ontemTime = parseLocal(ontemStr)

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
      const calFim = cal.data_fim + 'T23:59:59'
      fim = calFim > ontemStr ? ontemStr : calFim
    } else {
      // Fallback: mês civil
      inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      const calFim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}T23:59:59`
      fim = calFim > ontemStr ? ontemStr : calFim
    }
  } else {
    // Sem filtro de data — retorna tudo
    const { data: eqData } = await supabase.from('equipamentos').select('id').ilike('placa', placa.trim());
    const eqIds = eqData?.map(e => e.id) || [];

    let query = supabase.from('ordens_servico').select('*');
    if (eqIds.length > 0) {
      if (eqIds.length === 1) {
        query = query.or(`equipamento_id.eq.${eqIds[0]},placa.ilike.${placa.trim()}`);
      } else {
        query = query.or(`equipamento_id.in.(${eqIds.join(',')}),placa.ilike.${placa.trim()}`);
      }
    } else {
      query = query.ilike('placa', placa.trim());
    }

    const { data, error } = await query
      // D+1: Nunca considerar OS abertas hoje
      .lte("data_abertura", ontemStr)
      .order('data_abertura', { ascending: false })
      .limit(50);
    
    // Para as OS retornadas, calcular as horas respeitando D+1
    const result = (data || []).map(os => {
      const osStart = parseLocal(os.horario_parada || os.data_abertura)
      const endMec = os.data_fechamento ? parseLocal(os.data_fechamento) : ontemTime
      let hMecCalculada = os.horas_manutencao || Math.max(0, (endMec - osStart) / 3600000)
      
      return {
        ...os,
        horas_manutencao: Math.round(hMecCalculada * 10) / 10
      }
    }) as OrdemServicoResumo[];

    osPlacaCache.set(cacheKey, { data: result, timestamp: now });
    return result;
  }

  // 1. Busca os IDs de equipamento de forma robusta
  const { data: eqData } = await supabase
    .from('equipamentos')
    .select('id, placa')
    .ilike('placa', placa.trim());

  const eqIds = eqData?.map(e => e.id) || [];

  let query = supabase
    .from('ordens_servico')
    .select('*, equipamento:equipamento_id(placa)');

  if (eqIds.length > 0) {
    if (eqIds.length === 1) {
      query = query.or(`equipamento_id.eq.${eqIds[0]},placa.ilike.${placa.trim()}`);
    } else {
      query = query.or(`equipamento_id.in.(${eqIds.join(',')}),placa.ilike.${placa.trim()}`);
    }
  } else {
    query = query.ilike('placa', placa.trim());
  }

  const { data, error } = await query.order('data_abertura', { ascending: false });

  if (error || !data) return [];

  const inicioTime = parseLocal(inicio);
  const fimTime = parseLocal(fim);

  // Filtra localmente por data usando parseLocal (segurança total contra timezones no banco)
  const osFiltradasData = data.filter(os => {
    // OS "Programado" é só planejamento futuro — não conta como indisponibilidade real.
    if (os.status === 'Programado') return false;

    const osStart = parseLocal(os.horario_parada || os.data_abertura);
    const osEnd = os.data_fechamento ? parseLocal(os.data_fechamento) : null;

    const part1 = osStart <= fimTime;
    const part2 = !osEnd || osEnd >= inicioTime;
    return part1 && part2;
  });

  // --- Coleta de Dados da Escala ---
  const { data: escala } = await supabase
    .from('escala_frota')
    .select('periodo_inicio, periodo_fim, carga_horaria')
    .ilike('placa', placa.trim())
    .maybeSingle();

  const osCalculadas = osFiltradasData.map((os: any) => {
    let hImpactoDO = 0
    const osStart = parseLocal(os.horario_parada || os.data_abertura)
    // Regra D+1: se aberta, conta apenas até ontem
    const endMec = os.data_fechamento ? parseLocal(os.data_fechamento) : ontemTime

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
