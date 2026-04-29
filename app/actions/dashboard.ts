"use server";

import { createClient } from "@/utils/supabase/server";

// ─── Types ────────────────────────────────────────────────────────────────────
export type VeiculoDisp = {
  placa: string;
  disponibilidade: number;
  disponibilidade_operacional: number;
  totalOS: number;
  osFechadas: number;
  horasManut: number;
  horasOperacional: number;
  hTotalDM: number;
  hTotalDO: number;
  historicoDiario?: { 
    data: string; 
    hTotalDM: number; 
    hIndispDM: number; 
    hTotalDO: number; 
    hIndispDO: number;
    disponibilidadeDM: number;
    disponibilidadeDO: number;
  }[];
  osImpactantes?: string[];
};

export type PreventivaStatus = {
  placa: string;
  horas_restantes: number;
  status: "atrasado" | "atencao" | "no_prazo";
};

export type FiltroOpcoes = {
  meses: { value: number; label: string }[];
  anos: number[];
  categorias: string[];
  placas: string[];
  modulos: string[];
  statusList: string[];
};

export type DashboardData = {
  totalOS: number;
  emAndamento: number;
  osFechadas: number;
  disponibilidadeMedia: number;
  dm: number;
  doOperacional: number;
  horasManutencao: number;
  mttr: number;
  mtbf: number;
  backlog: number;
  totalEquipamentos: number;
  totalVeiculosAtivos: number;
  veiculos: VeiculoDisp[];
  preventivas: PreventivaStatus[];
  docsValidos: number;
  docsAVencer: number;
  docsVencidos: number;
  filtroOpcoes: FiltroOpcoes;
  mesSelecionado: number;
  anoSelecionado: number;
  periodoLabel: string;
  data_inicio?: string;
  data_fim?: string;
  dispSemanal: any[];
  paradasPorCategoria: any[];
  rankingFalhas: any[];
  dispPorTipo: any[];
  statusFrota: any[];
  manutPorTipo: any[];
  dispPorCategoria: { categoria: string; dm: number; doOp: number; total: number; qtdOS: number }[];
  dataAtualizacao?: string;
};

// Helper para fundir intervalos de tempo sobrepostos (evita duplicidade de horas)
function mergeTimeIntervals(intervals: Array<{ start: number, end: number }>) {
  if (intervals.length === 0) return 0;
  // Ordena por início
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  
  let totalMs = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start < currentEnd) {
      // Sobreposição: estende o fim se necessário
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      // Lacuna: soma o intervalo anterior e começa um novo
      totalMs += Math.max(0, currentEnd - currentStart);
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  // Soma o último
  totalMs += Math.max(0, currentEnd - currentStart);
  return totalMs / 3600000; // Retorna em horas
}

function parseLocal(dateStr: string | null): number {
  if (!dateStr) return 0;
  // Tenta formato ISO: YYYY-MM-DDTHH:mm:ss
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
  // Tenta formato PT-BR: DD/MM/YYYY HH:mm
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

// ─── Cache Global (Persiste no servidor enquanto o processo estiver rodando) ──────
const dashboardCache = new Map<string, { data: DashboardData, timestamp: number }>();
const CACHE_TTL = 30 * 1000; // Reduzido para 30 segundos (dados mais frescos)

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getDashboardData(filtros?: {
  mes?: number;
  ano?: number;
  categoria?: string;
  placa?: string;
  modulo?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<DashboardData> {
  // Chave do cache normalizada baseada nos filtros
  const normalizedFiltros = {
    mes: filtros?.mes || 0,
    ano: filtros?.ano || 0,
    categoria: (filtros?.categoria || "").toUpperCase(),
    placa: (filtros?.placa || "").toUpperCase(),
    modulo: (filtros?.modulo || "").toUpperCase(),
    status: (filtros?.status || "").toUpperCase(),
    dataInicio: filtros?.dataInicio || "",
    dataFim: filtros?.dataFim || ""
  };
  const cacheKey = JSON.stringify(normalizedFiltros);
  const cached = dashboardCache.get(cacheKey);
  const agoraTimestamp = Date.now();

  if (cached && (agoraTimestamp - cached.timestamp) < CACHE_TTL) {
    console.log('[Dashboard] Retornando dados do cache para:', cacheKey);
    return cached.data;
  }

  const supabase = createClient();
  const agoraRef = new Date();
  // Ontem às 23:59:59 (D-1)
  const ontem = new Date(agoraRef);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);
  
  const diaHoje = agoraRef.getDate();
  const mesAtualRef = agoraRef.getMonth() + 1;
  const anoAtualRef = agoraRef.getFullYear();

  // 1. Smart Detection & Parallel Metadata Fetching
  let mesFiltro = filtros?.mes || 0;
  let anoFiltro = filtros?.ano || 0;
  let calSuzano: any = null;
  const todayStr = agoraRef.toISOString().split('T')[0];

  // Buscamos calendários, equipamentos e outros metadados em PARALELO para evitar waterfalls
  const [infraRes, eqRes, escalasRes, prevRes] = await Promise.all([
    mesFiltro === 0 
      ? supabase.from("calendario_suzano").select("*").lte("data_inicio", todayStr).gte("data_fim", todayStr).single()
      : supabase.from("calendario_suzano").select("*").eq("mes", mesFiltro).eq("ano", anoFiltro).single(),
    supabase.from("equipamentos")
      .select("id, placa, tipo, categoria, modulo, modelo, status")
      .or("status.is.null,status.neq.Inativo,status.neq.INATIVO"),
    supabase.from("escala_frota").select("placa, carga_horaria, periodo_inicio, periodo_fim"),
    supabase.from("preventivas").select("equipamento_id, ultimo_horimetro, horimetro_atual, intervalo_horas, equipamentos(placa, categoria)")
  ]);

  if (infraRes.data) {
    calSuzano = infraRes.data;
    mesFiltro = calSuzano.mes;
    anoFiltro = calSuzano.ano;
  } else {
    mesFiltro = mesFiltro || mesAtualRef;
    anoFiltro = anoFiltro || anoAtualRef;
  }

  // 2. Cálculo de Datas (depende apenas dos metadados e filtros)
  let inicioFiltro = "";
  let fimFiltro = "";
  let diasReferencia = 0;
  let totalDiasCalendario = 0;
  let dataInicioExibicao = "";
  let dataFimExibicao = "";

  if (filtros?.dataInicio && filtros?.dataFim) {
    inicioFiltro = filtros.dataInicio;
    const dInicio = new Date(inicioFiltro + 'T00:00:00');
    const dFim = new Date(filtros.dataFim + 'T23:59:59');
    const fimEfetivo = dFim > ontem ? (ontem < dInicio ? dInicio : ontem) : dFim;
    const diffMsRange = Math.max(0, fimEfetivo.getTime() - dInicio.getTime());
    diasReferencia = Math.floor(diffMsRange / 86400000) + 1;
    fimFiltro = fimEfetivo.toISOString();
    dataInicioExibicao = filtros.dataInicio;
    dataFimExibicao = filtros.dataFim;
  } else if (calSuzano) {
    inicioFiltro = calSuzano.data_inicio;
    dataInicioExibicao = calSuzano.data_inicio;
    dataFimExibicao = calSuzano.data_fim;
    const dFimCal = new Date(calSuzano.data_fim + 'T23:59:59');
    const dInicioCal = new Date(calSuzano.data_inicio + 'T00:00:00');
    
    let fimEfetivoCal = dFimCal;
    if (dFimCal > ontem) {
      fimEfetivoCal = ontem < dInicioCal ? dInicioCal : ontem;
    }
    
    const diffMsSuzano = Math.max(0, fimEfetivoCal.getTime() - dInicioCal.getTime());
    diasReferencia = Math.floor(diffMsSuzano / 86400000) + 1;
    fimFiltro = fimEfetivoCal.toISOString();
  } else {
    inicioFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-01`;
    const diasNoMesCivil = new Date(anoFiltro, mesFiltro, 0).getDate();
    const dFimCivil = new Date(anoFiltro, mesFiltro - 1, diasNoMesCivil, 23, 59, 59);
    const dInicioCivil = new Date(inicioFiltro + 'T00:00:00');
    const fimEfetivoCivil = dFimCivil > ontem ? (ontem < dInicioCivil ? dInicioCivil : ontem) : dFimCivil;
    const diffMsCivil = Math.max(0, fimEfetivoCivil.getTime() - dInicioCivil.getTime());
    diasReferencia = Math.floor(diffMsCivil / 86400000) + 1;
    fimFiltro = fimEfetivoCivil.toISOString();
    dataInicioExibicao = inicioFiltro;
    dataFimExibicao = fimFiltro.split("T")[0];
  }

  // 3. Busca de Ordens de Serviço (agora com as datas precisas)
  let queryOS = supabase.from("ordens_servico").select(`
    id, status, horas_manutencao, data_abertura, data_fechamento, 
    equipamento_id, placa, classe, foi_enviado_reserva,
    horario_parada, horas_reserva_chegou, descricao, numero_os
  `)
  .or(`data_abertura.lte.${fimFiltro},horario_parada.lte.${fimFiltro}`)
  .or(`data_fechamento.is.null,data_fechamento.gte.${inicioFiltro}`);

  if (filtros?.placa) {
    queryOS = queryOS.eq('placa', filtros.placa.toUpperCase());
  }

  const [osRes] = await Promise.all([queryOS]);

  const allOS = osRes.data ?? [];
  const todasAsEquips = eqRes.data ?? [];
  const escalas = escalasRes.data ?? [];
  const prevData = prevRes.data ?? [];
  
  const frotaAtiva = todasAsEquips.filter(eq => String(eq.status || 'Ativo').toUpperCase().trim() !== "INATIVO");
  
  // Mapas de busca rápida O(1)
  const eqMapById = new Map();
  const eqMapByPlaca = new Map();
  const categoriasSet = new Set<string>();
  const modulosSet = new Set<string>();
  
  frotaAtiva.forEach(eq => {
    const p = eq.placa?.toUpperCase().trim();
    eqMapById.set(eq.id, eq);
    if (p) eqMapByPlaca.set(p, eq);
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.modulo) modulosSet.add(eq.modulo);
  });

  // ─── OTIMIZAÇÃO: Mapear OS e Escalas por Placa ───
  const osPorPlaca = new Map<string, any[]>();
  allOS.forEach(os => {
    let p = os.placa?.toUpperCase().trim();
    if (!p && os.equipamento_id) {
      p = eqMapById.get(os.equipamento_id)?.placa?.toUpperCase().trim();
    }
    if (p) {
      if (!osPorPlaca.has(p)) osPorPlaca.set(p, []);
      osPorPlaca.get(p)!.push(os);
    }
  });

  // Auxiliar para parsing de tempo em ms desde meia-noite
  const timeToMs = (tStr: string) => {
    if (!tStr) return 0;
    const [h, m] = tStr.split(':').map(Number);
    return (h * 3600 + m * 60) * 1000;
  };

  const escalaMap = new Map<string, { carga_horaria: number, startOffset: number, endOffset: number, isOvernight: boolean }>();
  escalas.forEach(e => {
    const s = timeToMs(e.periodo_inicio);
    const end = timeToMs(e.periodo_fim);
    const pKey = e.placa?.toUpperCase().trim();
    if (pKey) {
      escalaMap.set(pKey, {
        carga_horaria: Number(e.carga_horaria),
        startOffset: s,
        endOffset: end,
        isOvernight: end <= s
      });
    }
  });

  let placasFiltradas = frotaAtiva
    .filter(eq => {
      // Filtro de Categoria
      const cat = (filtros?.categoria || "").toUpperCase().trim();
      if (cat && eq.categoria?.toUpperCase().trim() !== cat) return false;
      
      // Se não houver filtro, incluímos apenas PESADA e LEVE por padrão (conforme solicitado)
      if (!cat) {
        const eqCat = (eq.categoria || "").toUpperCase().trim();
        if (eqCat !== "PESADA" && eqCat !== "LEVE") return false;
      }

      // Filtro de Módulo
      if (filtros?.modulo && eq.modulo?.toUpperCase().trim() !== filtros.modulo.toUpperCase().trim()) return false;

      // Filtro de Status
      if (filtros?.status) {
        // Mapeamento de status para o que o dashboard entende
        const osAbertaAtiva = (osPorPlaca.get(eq.placa?.toUpperCase().trim() || "") || []).find(o => o.status === 'Aberta' || o.status === 'Em Andamento');
        let statusLabel = "Disponível";
        if (osAbertaAtiva) statusLabel = "Manutenção";
        // Nota: DM não calculada aqui ainda, mas o filtro de status é secundário
        if (statusLabel !== filtros.status) return false;
      }

      return true;
    })
    .map(eq => eq.placa?.toUpperCase().trim())
    .filter(p => p && !["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"].includes(p));

  // Filtros em memória (como fallback de segurança para placas específicas ocultas)
  if (filtros?.placa) {
    placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase());
  }

  // 4. Cálculos Otimizados
  const veiculos: VeiculoDisp[] = [];
  const periodoInicioObj = new Date(inicioFiltro);
  const periodoFimObj = new Date(fimFiltro);
  const allOSProcessed: any[] = [];

  // --- OTIMIZAÇÃO: Pré-calculo dos carimbos de data dos dias do mês ---
  const diasMesInfo = Array.from({ length: diasReferencia }).map((_, d) => {
    const dC = new Date(periodoInicioObj.getTime());
    dC.setDate(periodoInicioObj.getDate() + d);
    const dStr = dC.toISOString().split('T')[0];
    const d0 = new Date(`${dStr}T00:00:00`).getTime();
    const d24 = d0 + 86400000;
    return { dStr, d0, d24 };
  });

  placasFiltradas.forEach(placa => {
    const osDoVeiculo = osPorPlaca.get(placa) || [];
    const escala = escalaMap.get(placa);
    
    // Cálculo das horas planejadas para este veículo no mês/período (Limitado a D-1)
    const diasUteisNoPeriodo = diasReferencia > 0 ? diasReferencia : 1;
    const hPlanejadasDM = 24 * diasUteisNoPeriodo;
    const hPlanejadasDO_TotalMensal = escala ? Number(escala.carga_horaria) * diasUteisNoPeriodo : 24 * diasUteisNoPeriodo;

    // --- OTIMIZAÇÃO: Fast Path para veículos sem OS no período ---
    if (osDoVeiculo.length === 0) {
      veiculos.push({
        placa,
        disponibilidade: 100,
        disponibilidade_operacional: 100,
        totalOS: 0,
        osFechadas: 0,
        horasManut: 0,
        horasOperacional: 0,
        hTotalDM: hPlanejadasDM,
        hTotalDO: hPlanejadasDO_TotalMensal,
        horasDisponiveisOperacional: hPlanejadasDO_TotalMensal,
        falhas: 0,
        historicoDiario: diasMesInfo.map(d => ({
          data: d.dStr, hTotalDM: 24, hIndispDM: 0, hTotalDO: escala ? Number(escala.carga_horaria) : 24, 
          hIndispDO: 0, disponibilidadeDM: 100, disponibilidadeDO: 100 
        })),
        osImpactantes: []
      } as any);
      return;
    }

    // Pré-processa as OS do veículo para carimbos numéricos de DM e DO (Regra Reserva PCM)
    const osProcessed = osDoVeiculo.map(os => {
      const start = parseLocal(os.horario_parada || os.data_abertura);
      const endDMRaw = os.data_fechamento ? parseLocal(os.data_fechamento) : agoraRef.getTime();
      const endDM = Math.min(endDMRaw, periodoFimObj.getTime());

      // Lógica de Término Operacional (Fim da IO ao chegar o reserva ou fechar a OS)
      let endDO = endDM;
      if (os.foi_enviado_reserva && os.horas_reserva_chegou) {
        const reservaTime = parseLocal(os.horas_reserva_chegou);
        // O reserva só "para" o cronômetro operacional se chegar ANTES do conserto acabar
        if (reservaTime > start && reservaTime < endDM) {
          endDO = reservaTime;
        }
      }

      return { ...os, start, endDM, endDO, horas_impacto_do: 0 };
    });

    let hIndispDM = 0;
    let hIndispDO = 0;
    let hPlanejadasDO_Acumulada = 0;
    let fechadas = 0;
    const historicoDiario: any[] = [];
    const osImpactantesSet = new Set<string>();

    // ÚNICO LOOP DE DIAS: Calcula histórico e impacto acumulado por OS
    diasMesInfo.forEach(dia => {
      const { d0, d24, dStr } = dia;
      const cargaHorariaDia = escala ? Number(escala.carga_horaria) : 24;
      hPlanejadasDO_Acumulada += cargaHorariaDia;

      const intervalosDM: Array<{start: number, end: number}> = [];
      const intervalosDO: Array<{start: number, end: number}> = [];

      let shiftStart = d0 + (escala?.startOffset || 0);
      let shiftEnd = d0 + (escala?.endOffset || 0);
      if (escala?.isOvernight) shiftEnd += 86400000;
      if (!escala) shiftEnd = d24;

      osProcessed.forEach(os => {
        // 1. Impacto DM (Mecânico)
        const intDMini = os.start > d0 ? os.start : d0;
        const intDMfim = os.endDM < d24 ? os.endDM : d24;
        if (intDMini < intDMfim) {
          intervalosDM.push({ start: intDMini, end: intDMfim });
        }

        // 2. Impacto DO (Operacional)
        const intDOini = os.start > shiftStart ? os.start : shiftStart;
        const intDOfim = os.endDO < shiftEnd ? os.endDO : shiftEnd;
        if (intDOini < intDOfim) {
          intervalosDO.push({ start: intDOini, end: intDOfim });
          os.horas_impacto_do += (intDOfim - intDOini) / 3600000;
          osImpactantesSet.add(os.numero_os || os.id);
        }
      });

      const indispDMdia = intervalosDM.length === 0 ? 0 : (intervalosDM.length === 1 ? (intervalosDM[0].end - intervalosDM[0].start) / 3600000 : mergeTimeIntervals(intervalosDM));
      const indispDOdia = intervalosDO.length === 0 ? 0 : (intervalosDO.length === 1 ? (intervalosDO[0].end - intervalosDO[0].start) / 3600000 : mergeTimeIntervals(intervalosDO));

      hIndispDM += indispDMdia;
      hIndispDO += indispDOdia;

      historicoDiario.push({
        data: dStr,
        disponibilidadeDM: Math.round(Math.max(0, (24 - indispDMdia) / 2.4)) / 10,
        disponibilidadeDO: cargaHorariaDia > 0 ? Math.round(Math.max(0, (cargaHorariaDia - indispDOdia) / (cargaHorariaDia / 100)) * 10) / 100 : 100
      });
    });

    // Pós-atribuição de round para horas_impacto_do
    osProcessed.forEach(os => {
      os.horas_impacto_do = Math.round(os.horas_impacto_do * 10) / 10;
    });
    allOSProcessed.push(...osProcessed);

    osDoVeiculo.forEach(os => {
      if (os.status === "Fechada" || os.status === "Concluída") fechadas++;
    });

    veiculos.push({
      placa,
      disponibilidade: hPlanejadasDM > 0 ? (Math.round(Math.max(0, Math.min(100, ((hPlanejadasDM - hIndispDM) / hPlanejadasDM) * 100)) * 10) / 10) || 0 : 100,
      disponibilidade_operacional: hPlanejadasDO_TotalMensal > 0 ? (Math.round(Math.max(0, Math.min(100, ((hPlanejadasDO_TotalMensal - hIndispDO) / hPlanejadasDO_TotalMensal) * 100)) * 10) / 10) || 0 : 100,
      totalOS: osDoVeiculo.length || 0,
      osFechadas: fechadas || 0,
      horasManut: Math.round(hIndispDM * 10) / 10,
      horasOperacional: Math.round(hIndispDO * 10) / 10,
      hTotalDM: hPlanejadasDM,
      hTotalDO: hPlanejadasDO_TotalMensal,
      horasDisponiveisOperacional: Math.round((hPlanejadasDO_TotalMensal - hIndispDO) * 10) / 10,
      falhas: osDoVeiculo.filter(o => o.classe === 'CORRETIVA').length,
      historicoDiario,
      osImpactantes: Array.from(osImpactantesSet)
    } as any);
  });

  // 5. Consolidação Final
  const diasUteisNoPeriodoGeral = diasReferencia > 0 ? diasReferencia : 1;
  const hIndispDMTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const hIndispDOTotal = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  const hTotalDMPlanejadaGeral = veiculos.length * 24 * diasUteisNoPeriodoGeral;
  const hTotalDOPlanejadaGeral = veiculos.reduce((acc, v) => acc + v.hTotalDO, 0);

  const dm = hTotalDMPlanejadaGeral > 0 ? Math.round(((hTotalDMPlanejadaGeral - hIndispDMTotal) / hTotalDMPlanejadaGeral) * 1000) / 10 : 0;
  const doOp = hTotalDOPlanejadaGeral > 0 ? Math.round(((hTotalDOPlanejadaGeral - hIndispDOTotal) / hTotalDOPlanejadaGeral) * 1000) / 10 : 0;

  const osCorretivas = allOS.filter(o => o.classe === 'CORRETIVA');
  const mttr = osCorretivas.filter(o => o.status === 'Fechada' || o.status === 'Concluída').length > 0 
    ? Math.round((hIndispDMTotal / osCorretivas.filter(o => o.status === 'Fechada' || o.status === 'Concluída').length) * 10) / 10 
    : 0;
  const mtbf = osCorretivas.length > 0 ? Math.round((Math.max(0, hTotalDOPlanejadaGeral - hIndispDMTotal) / osCorretivas.length) * 10) / 10 : 0;

  // 6. Dados para Gráficos (Otimizado com Mapeamento Único)
  const categoriasMap = new Map<string, number>();
  const manutPorTipoMap = new Map<string, number>();
  const modelosMap = new Map<string, { soma: number, count: number }>();

  allOS.forEach(os => {
    const eq = os.equipamento_id ? eqMapById.get(os.equipamento_id) : null;
    const cat = eq?.categoria || "Outros";
    categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + 1);
    
    const tipo = os.classe || "Sem Classe";
    manutPorTipoMap.set(tipo, (manutPorTipoMap.get(tipo) || 0) + 1);
  });

  veiculos.forEach(v => {
    const eq = eqMapByPlaca.get(v.placa.toUpperCase().trim());
    const mod = eq?.modelo || "Outros";
    const curr = modelosMap.get(mod) || { soma: 0, count: 0 };
    modelosMap.set(mod, { soma: curr.soma + v.disponibilidade_operacional, count: curr.count + 1 });
  });

  const statusFrota = veiculos.map(v => {
    const eq = eqMapByPlaca.get(v.placa.toUpperCase().trim());
    const osAbertaAtiva = (osPorPlaca.get(v.placa) || []).find(o => o.status === 'Aberta' || o.status === 'Em Andamento');

    let statusLabel = "Disponível";
    if (osAbertaAtiva) statusLabel = "Manutenção";
    else if (v.disponibilidade < 90) statusLabel = "Crítico";
    else if (v.disponibilidade < 95) statusLabel = "Atenção";

    return {
      placa: v.placa,
      tipo: eq?.modelo || "N/A",
      status: statusLabel,
      disponibilidade: v.disponibilidade,
      modulo: eq?.modulo || "BASE"
    };
  });

  // ── Disponibilidade DM + DO agrupada por Tipo de Frota (PIPA, COMBOIO, MUNCK, MULTI) ──
  // Nota: no banco o campo `tipo` usa 'MULTIFUNCIONAL'; exibimos como 'MULTI'
  const TIPO_PARA_LABEL: Record<string, string> = {
    'PIPA': 'PIPA',
    'COMBOIO': 'COMBOIO',
    'MUNCK': 'MUNCK',
    'MULTIFUNCIONAL': 'MULTI',
    'MULTI': 'MULTI', // aceita ambos
  };
  const LABELS_ORDEM = ['PIPA', 'COMBOIO', 'MUNCK', 'MULTI'];
  const catDispPoolMap = new Map<string, {
    hManutDM: number; hTotalDM: number;
    hManutDO: number; hTotalDO: number;
    count: number;
    qtdOS: number;
  }>();
  // Inicializa os 4 labels para garantir que apareçam mesmo sem dados
  LABELS_ORDEM.forEach(l => catDispPoolMap.set(l, { hManutDM: 0, hTotalDM: 0, hManutDO: 0, hTotalDO: 0, count: 0, qtdOS: 0 }));
  veiculos.forEach(v => {
    const eq = eqMapByPlaca.get(v.placa.toUpperCase().trim());
    const tipoRaw = (eq?.tipo || '').toUpperCase().trim();
    const label = TIPO_PARA_LABEL[tipoRaw];
    if (!label) return; // ignora tipos fora da lista
    
    const osDaPlaca = osPorPlaca.get(v.placa) || [];
    const curr = catDispPoolMap.get(label)!;
    catDispPoolMap.set(label, {
      hManutDM: curr.hManutDM + v.horasManut,
      hTotalDM: curr.hTotalDM + v.hTotalDM,
      hManutDO: curr.hManutDO + v.horasOperacional,
      hTotalDO: curr.hTotalDO + v.hTotalDO,
      count: curr.count + 1,
      qtdOS: curr.qtdOS + osDaPlaca.length,
    });
  });
  // Retorna na ordem definida em LABELS_ORDEM
  const dispPorCategoria = LABELS_ORDEM.map(label => {
    const d = catDispPoolMap.get(label)!;
    return {
      categoria: label,
      dm:   d.hTotalDM > 0 ? Math.round(((d.hTotalDM - d.hManutDM) / d.hTotalDM) * 1000) / 10 : 100,
      doOp: d.hTotalDO > 0 ? Math.round(((d.hTotalDO - d.hManutDO) / d.hTotalDO) * 1000) / 10 : 100,
      total: d.count,
      qtdOS: d.qtdOS,
    };
  });

  // E. Disponibilidade Semanal (Otimizada)
  const dispSemanal = [];
  const pInicioTime = periodoInicioObj.getTime();
  const pFimTime = periodoFimObj.getTime();
  const semanas = Math.ceil((pFimTime - pInicioTime) / (7 * 86400000));

  // Pré-calcula os tempos das OS uma única vez
  const osTimes = allOS.map(os => ({
    start: (os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura)).getTime(),
    end: (os.data_fechamento ? new Date(os.data_fechamento) : agoraRef).getTime()
  }));

  for (let s = 1; s <= semanas; s++) {
    const sInicio = pInicioTime + (s-1) * 7 * 86400000;
    const sFim = Math.min(pFimTime, sInicio + 7 * 86400000 - 1);
    
    let hIndispSemanaTotal = 0;
    osTimes.forEach(ot => {
      const eInicio = Math.max(ot.start, sInicio);
      const eFim = Math.min(ot.end, sFim);
      if (eInicio < eFim) hIndispSemanaTotal += (eFim - eInicio) / 3600000;
    });

    const hTotaisSemana = (veiculos.length || 1) * ((sFim - sInicio) / 3600000);
    dispSemanal.push({
      semana: `Semana ${s}`,
      disp: Math.round(Math.max(0, ((hTotaisSemana - hIndispSemanaTotal) / hTotaisSemana) * 100) * 10) / 10
    });
  }


  const MESES_NOME = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  const result: DashboardData = {
    totalOS: allOS.length,
    emAndamento: allOS.filter(o => o.status === "Aberta" || o.status === "Em Andamento").length,
    osFechadas: allOS.filter(o => o.status === "Fechada" || o.status === "Concluída").length,
    disponibilidadeMedia: dm,
    dm,
    doOperacional: doOp,
    horasManutencao: Math.round(hIndispDMTotal * 10) / 10,
    mttr,
    mtbf,
    backlog: Math.round((allOS.filter(o => o.status === "Aberta" || o.status === "Em Andamento").reduce((acc, o) => acc + (o.horas_manutencao || 0), 0) / 24) * 10) / 10,
    totalEquipamentos: frotaAtiva.length,
    totalVeiculosAtivos: placasFiltradas.length,
    veiculos: veiculos.sort((a, b) => a.disponibilidade - b.disponibilidade),
    rankingFalhas: veiculos.filter(v => (v as any).falhas > 0).sort((a: any, b: any) => b.falhas - a.falhas).slice(0, 10).map(v => ({ placa: v.placa, falhas: (v as any).falhas, mtbf: (v as any).falhas > 0 ? Math.round(((v.hTotalDO - v.horasManut) / (v as any).falhas)*10)/10 : 0 })),
    paradasPorCategoria: Array.from(categoriasMap.entries()).map(([categoria, quantidade]) => ({ categoria, quantidade })),
    manutPorTipo: Array.from(manutPorTipoMap.entries()).map(([tipo, quantidade]) => ({ tipo, quantidade })),
    dispPorTipo: Array.from(modelosMap.entries()).map(([tipo, data]) => ({ tipo, disponibilidade: Math.round((data.soma / data.count) * 10) / 10, total: data.count })),
    dispPorCategoria,
    statusFrota: statusFrota.sort((a, b) => a.disponibilidade - b.disponibilidade),
    dispSemanal,
    preventivas: (prevData ?? [])
      .filter((p: any) => {
        const catFiltro = (filtros?.categoria || "PESADA").toUpperCase();
        return p.equipamentos?.categoria?.toUpperCase() === catFiltro;
      })
      .map((p: any) => {
        const restantes = Number(p.ultimo_horimetro) + Number(p.intervalo_horas) - Number(p.horimetro_atual);
        return { placa: p.equipamentos?.placa || "—", horas_restantes: Math.round(restantes), status: restantes < 0 ? "atrasado" : restantes <= 50 ? "atencao" : "no_prazo" };
      }).sort((a: any, b: any) => a.horas_restantes - b.horas_restantes).slice(0, 10) as any,
    docsValidos: 0, docsAVencer: 0, docsVencidos: 0,
    filtroOpcoes: {
      meses: MESES_NOME.slice(1).map((m, i) => ({ value: i + 1, label: m })),
      anos: [2024, 2025, 2026],
      categorias: Array.from(categoriasSet),
      placas: placasFiltradas.sort(),
      modulos: Array.from(modulosSet),
      statusList: ["Disponível", "Manutenção", "Atenção", "Crítico"]
    },
    periodoLabel: filtros?.dataInicio && filtros?.dataFim 
      ? `${new Date(filtros.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(filtros.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
      : `${MESES_NOME[mesFiltro]} ${anoFiltro}`,
     data_inicio: dataInicioExibicao,
     data_fim: dataFimExibicao,
     mesSelecionado: mesFiltro,
     anoSelecionado: anoFiltro,
     dataAtualizacao: ontem.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  };

  // Salva no cache antes de retornar
  dashboardCache.set(cacheKey, { data: result, timestamp: agoraTimestamp });
  return result;
}
