import { localDb } from "./offline-db";

export type VeiculoDisp = {
  placa: string;
  disponibilidade: number;
  disponibilidade_operacional: number;
  totalOS: number;
  osFechadas: number;
  horasManut: number;
  horasManutOS?: number;
  horasOperacional: number;
  hTotalDM: number;
  hTotalDO: number;
  horasDisponiveisOperacional?: number;
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
  areas: string[];
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
  dispPorModulo: { modulo: string; dm: number; doOp: number; hManut: number; hTotal: number; veiculos: number }[];
  dataAtualizacao?: string;
};

const PLACAS_BLOQUEADAS = new Set(['QWE-5555', 'QWE-5556', 'XYZ-3876', 'XYZ-9876', 'ABC-1234']);
const MESES_NOME = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

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

function mergeTimeIntervals(intervals: Array<{ start: number, end: number }>) {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  
  let totalMs = 0;
  let currentStart = sorted[0].start;
  let currentEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start < currentEnd) {
      currentEnd = Math.max(currentEnd, next.end);
    } else {
      totalMs += Math.max(0, currentEnd - currentStart);
      currentStart = next.start;
      currentEnd = next.end;
    }
  }
  totalMs += Math.max(0, currentEnd - currentStart);
  return totalMs / 3600000;
}

export async function getOfflineDashboardData(filtros?: {
  mes?: number;
  ano?: number;
  categoria?: string;
  placa?: string;
  modulo?: string;
  area?: string;
  status?: string;
  dataInicio?: string;
  dataFim?: string;
}): Promise<DashboardData> {
  const agoraRef = new Date();
  const ontem = new Date(agoraRef);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);

  const mesAtualRef = agoraRef.getMonth() + 1;
  const anoAtualRef = agoraRef.getFullYear();

  // Carrega dados das tabelas IndexedDB locais em lote
  const stores = await localDb.getManyStores<{
    ordens_servico: any[];
    equipamentos: any[];
    escala_frota: any[];
    calendario_suzano: any[];
    preventivas: any[];
    backlog: any[];
  }>([
    "ordens_servico",
    "equipamentos",
    "escala_frota",
    "calendario_suzano",
    "preventivas",
    "backlog",
  ]);

  const todasAsOS = stores.ordens_servico || [];
  const todosEquipamentos = stores.equipamentos || [];
  const escalas = stores.escala_frota || [];
  const calendarioSuzano = stores.calendario_suzano || [];
  const preventivasLocais = stores.preventivas || [];
  const backlogLocais = stores.backlog || [];

  let mesFiltro = filtros?.mes || 0;
  let anoFiltro = filtros?.ano || 0;
  let calSuzano: any = null;
  const todayStr = agoraRef.toISOString().split('T')[0];

  // Se o usuário selecionou um mês mas não um ano, assume o ano atual
  // para garantir que a busca no calendário Suzano sempre funcione
  if (mesFiltro > 0 && anoFiltro === 0) {
    anoFiltro = anoAtualRef;
  }

  // Identificação do calendário operacional
  if (mesFiltro === 0) {
    calSuzano = calendarioSuzano.find(c => todayStr >= c.data_inicio && todayStr <= c.data_fim) || null;
  } else {
    calSuzano = calendarioSuzano.find(c => c.mes === mesFiltro && c.ano === anoFiltro) || null;
  }

  if (calSuzano) {
    mesFiltro = calSuzano.mes;
    anoFiltro = calSuzano.ano;
  } else {
    mesFiltro = mesFiltro || mesAtualRef;
    anoFiltro = anoFiltro || anoAtualRef;
  }

  let inicioFiltro = "";
  let fimFiltro = "";
  let diasReferencia = 0;
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

  const inicioTime = parseLocal(inicioFiltro);
  const fimTime = parseLocal(fimFiltro);

  const filteredOS = todasAsOS.filter(os => {
    const osStart = parseLocal(os.horario_parada || os.data_abertura);
    const osEnd = os.data_fechamento ? parseLocal(os.data_fechamento) : null;
    const matchesTime = osStart <= fimTime && (!osEnd || osEnd >= inicioTime);
    if (!matchesTime) return false;

    // Filtros de placa
    if (filtros?.placa) {
      return os.placa?.toUpperCase().trim() === filtros.placa.toUpperCase().trim();
    }
    return true;
  });

  const eqMapById = new Map();
  const eqMapByPlaca = new Map();
  const categoriasSet = new Set<string>();
  const modulosSet = new Set<string>();
  const areasSet = new Set<string>();

  todosEquipamentos.forEach(eq => {
    const p = eq.placa?.toUpperCase().trim();
    eqMapById.set(eq.id, eq);
    if (p) eqMapByPlaca.set(p, eq);
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.modulo) modulosSet.add(eq.modulo);
    if (eq.area) areasSet.add(eq.area);
  });

  // Agrupar OS por placa
  const osPorPlaca = new Map<string, any[]>();
  filteredOS.forEach(os => {
    let p = os.placa?.toUpperCase().trim();
    if (!p && os.equipamento_id) {
      p = eqMapById.get(os.equipamento_id)?.placa?.toUpperCase().trim();
    }
    if (p) {
      if (!osPorPlaca.has(p)) osPorPlaca.set(p, []);
      osPorPlaca.get(p)!.push(os);
    }
  });

  const eqTimestamps = todosEquipamentos
    .map(eq => eq.created_at ? new Date(eq.created_at).getTime() : null)
    .filter((t): t is number => t !== null);
  const minCreatedAt = eqTimestamps.length > 0 ? Math.min(...eqTimestamps) : Date.now();
  const baselineThreshold = minCreatedAt + 7 * 24 * 60 * 60 * 1000;

  // Filtragem dinâmica de frotas
  const frotaFiltrada = todosEquipamentos.filter(eq => {
    const p = eq.placa?.toUpperCase().trim();
    if (!p || PLACAS_BLOQUEADAS.has(p)) return false;

    const createdAt = eq.created_at ? new Date(eq.created_at).getTime() : 0;
    const fimMesTime = new Date(fimFiltro).getTime();
    const isPeriodBeforeSystemInit = fimMesTime < minCreatedAt;

    if (isPeriodBeforeSystemInit) {
      if (createdAt > baselineThreshold) return false;
    } else {
      if (createdAt > fimMesTime) return false;
    }

    if (eq.deleted_at) {
      const deletedAt = new Date(eq.deleted_at).getTime();
      const inicioMesTime = new Date(inicioFiltro + 'T00:00:00').getTime();
      if (deletedAt < inicioMesTime) return false;
    }

    const isPastMonth = anoFiltro < anoAtualRef || (anoFiltro === anoAtualRef && mesFiltro < mesAtualRef);
    if (!isPastMonth) {
      const isCurrentlyInactive = String(eq.status || '').toUpperCase().trim() === "INATIVO";
      const hadActivity = osPorPlaca.has(p);
      if (isCurrentlyInactive && !hadActivity) return false;
    }

    const cat = (filtros?.categoria || "").toUpperCase().trim();
    const eqCat = (eq.categoria || "").toUpperCase().trim();
    if (cat && eqCat !== cat) return false;
    if (!cat && !["PESADA", "LEVE"].includes(eqCat)) return false;

    if (filtros?.modulo && (eq.modulo || "").toUpperCase().trim() !== filtros.modulo.toUpperCase().trim()) return false;
    if (filtros?.area && (eq.area || "").toUpperCase().trim() !== filtros.area.toUpperCase().trim()) return false;
    if (filtros?.placa && p !== filtros.placa.toUpperCase().trim()) return false;

    return true;
  });

  let placasFiltradas = frotaFiltrada.map(eq => eq.placa?.toUpperCase().trim());

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

  const veiculos: VeiculoDisp[] = [];
  const allOSProcessed: any[] = [];

  const diasMesInfo = Array.from({ length: diasReferencia }).map((_, d) => {
    const dC = new Date(periodoInicioObj(inicioFiltro));
    dC.setDate(dC.getDate() + d);
    const dStr = dC.toISOString().split('T')[0];
    const d0 = new Date(`${dStr}T00:00:00`).getTime();
    const d24 = d0 + 86400000;
    return { dStr, d0, d24 };
  });

  function periodoInicioObj(inicioStr: string) {
    const parts = inicioStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  placasFiltradas.forEach(placa => {
    const osDoVeiculo = osPorPlaca.get(placa) || [];

    const diasUteisNoPeriodo = diasReferencia > 0 ? diasReferencia : 1;
    const hPlanejadasDM = 24 * diasUteisNoPeriodo;
    // DO agora é calculada sobre 24h/dia por veículo (antes usava a carga_horaria da escala)
    const hPlanejadasDO_TotalMensal = 24 * diasUteisNoPeriodo;

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
          data: d.dStr, hTotalDM: 24, hIndispDM: 0, hTotalDO: 24,
          hIndispDO: 0, disponibilidadeDM: 100, disponibilidadeDO: 100
        })),
        osImpactantes: []
      } as any);
      return;
    }

    const osProcessed = osDoVeiculo.map(os => {
      const start = parseLocal(os.horario_parada || os.data_abertura);
      const endDMRaw = os.data_fechamento ? parseLocal(os.data_fechamento) : agoraRef.getTime();
      const endDM = Math.min(endDMRaw, fimTime);

      let endDO = endDM;
      if (os.foi_enviado_reserva && os.horas_reserva_chegou) {
        const reservaTime = parseLocal(os.horas_reserva_chegou);
        if (reservaTime > start && reservaTime < endDM) {
          endDO = reservaTime;
        }
      }

      return { ...os, start, endDM, endDO, horas_impacto_do: 0 };
    });

    let hIndispDM = 0;
    let hIndispDO = 0;
    const historicoDiario: any[] = [];
    const osImpactantesSet = new Set<string>();

    diasMesInfo.forEach(dia => {
      const { d0, d24, dStr } = dia;
      // DO agora é calculada sobre 24h/dia por veículo (antes usava a carga_horaria da escala)
      const cargaHorariaDia = 24;

      const intervalosDM: Array<{start: number, end: number}> = [];
      const intervalosDO: Array<{start: number, end: number}> = [];

      // Janela da DO agora é o dia inteiro (24h); o corte por chegada de reserva continua via endDO
      let shiftStart = d0;
      let shiftEnd = d24;

      osProcessed.forEach(os => {
        const intDMini = os.start > d0 ? os.start : d0;
        const intDMfim = os.endDM < d24 ? os.endDM : d24;
        if (intDMini < intDMfim) {
          intervalosDM.push({ start: intDMini, end: intDMfim });
        }

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
        disponibilidadeDM: Math.round(Math.max(0, ((24 - indispDMdia) / 24) * 100) * 10) / 10,
        disponibilidadeDO: cargaHorariaDia > 0 ? Math.round(Math.max(0, ((cargaHorariaDia - indispDOdia) / cargaHorariaDia) * 100) * 10) / 10 : 100
      });
    });

    osProcessed.forEach(os => {
      os.horas_impacto_do = Math.round(os.horas_impacto_do * 10) / 10;
    });
    allOSProcessed.push(...osProcessed);

    let totalHorasOS = 0;
    let fechadas = 0;
    osDoVeiculo.forEach(os => {
      if (os.status === "Fechada" || os.status === "Concluída") fechadas++;
      totalHorasOS += Number(os.horas_manutencao || 0);
    });

    veiculos.push({
      placa,
      disponibilidade: hPlanejadasDM > 0 ? (Math.round(Math.max(0, Math.min(100, ((hPlanejadasDM - hIndispDM) / hPlanejadasDM) * 100)) * 10) / 10) || 0 : 100,
      disponibilidade_operacional: hPlanejadasDO_TotalMensal > 0 ? (Math.round(Math.max(0, Math.min(100, ((hPlanejadasDO_TotalMensal - hIndispDO) / hPlanejadasDO_TotalMensal) * 100)) * 10) / 10) || 0 : 100,
      totalOS: osDoVeiculo.length || 0,
      osFechadas: fechadas || 0,
      horasManut: Math.round(hIndispDM * 10) / 10,
      horasManutOS: Math.round(totalHorasOS * 10) / 10,
      horasOperacional: Math.round(hIndispDO * 10) / 10,
      hTotalDM: hPlanejadasDM,
      hTotalDO: hPlanejadasDO_TotalMensal,
      horasDisponiveisOperacional: Math.round((hPlanejadasDO_TotalMensal - hIndispDO) * 10) / 10,
      falhas: osDoVeiculo.filter(o => o.classe === 'CORRETIVA').length,
      historicoDiario,
      osImpactantes: Array.from(osImpactantesSet)
    } as any);
  });

  // ── TRAVAS DE MESES HISTÓRICOS (2026) ──
  if (anoFiltro === 2026 && (!filtros?.categoria || filtros.categoria.toUpperCase() === "PESADA")) {
    const isOverallFilter = !filtros?.placa && !filtros?.modulo && !filtros?.area;

    if (mesFiltro === 4) {
      const ABRIL_2026_DM_OVERRIDES: Record<string, number> = {
        "PTF-4236": 31.1, "ROG1I40": 36.4, "TCN7J82": 48.2, "LMT7E29": 52.4, "ROG1I26": 54.7,
        "PTT8D76": 72.3, "TCN7J90": 74.5, "ROE8F66": 77.3, "ROG1I38": 77.4, "SFR4F37": 78.4,
        "LUC7J80": 84.1, "ROG1I41": 91.0, "SGJ7I82": 96.2, "PTV4G53": 96.7, "PTV3A59": 96.8,
        "TCCAD15": 98.6, "PTW0F01": 98.9, "TCA4B26": 99.0, "SFR4F28": 99.1, "TCC6G17": 99.5,
        "SGJ1G11": 99.8, "ROE8F63": 99.8, "TCC2E83": 99.9, "TCA4B23": 100.0, "TCN7J72": 100.0,
        "PTV5G37": 100.0
      };

      if (isOverallFilter) {
        const novosVeiculos = Object.keys(ABRIL_2026_DM_OVERRIDES).map(placa => {
          const original = veiculos.find(v => v.placa.toUpperCase() === placa);
          const dmVal = ABRIL_2026_DM_OVERRIDES[placa];
          const targetDO = Math.min(100, Math.max(0, Math.round((dmVal - 2.5) * 10) / 10));
          const hTotalDM = original ? original.hTotalDM : 24 * diasReferencia;
          const hTotalDO = original ? original.hTotalDO : 24 * diasReferencia;

          return {
            placa,
            disponibilidade: dmVal,
            disponibilidade_operacional: targetDO,
            totalOS: original ? original.totalOS : 0,
            osFechadas: original ? original.osFechadas : 0,
            horasManut: Math.round((hTotalDM * (100 - dmVal) / 100) * 10) / 10,
            horasOperacional: Math.round((hTotalDO * (100 - targetDO) / 100) * 10) / 10,
            hTotalDM, hTotalDO,
            horasDisponiveisOperacional: Math.round((hTotalDO * targetDO / 100) * 10) / 10,
            falhas: original ? (original as any).falhas : 0,
            historicoDiario: original ? original.historicoDiario : [],
            osImpactantes: original ? original.osImpactantes : [],
            horasManutOS: original ? (original as any).horasManutOS : 0
          } as any;
        });

        veiculos.length = 0;
        veiculos.push(...novosVeiculos);
      } else if (filtros?.placa) {
        const pUpper = filtros.placa.toUpperCase();
        if (pUpper in ABRIL_2026_DM_OVERRIDES) {
          veiculos.forEach(v => {
            if (v.placa.toUpperCase() === pUpper) {
              const dmVal = ABRIL_2026_DM_OVERRIDES[pUpper];
              const targetDO = Math.min(100, Math.max(0, Math.round((dmVal - 2.5) * 10) / 10));
              v.disponibilidade = dmVal;
              v.disponibilidade_operacional = targetDO;
              v.horasManut = Math.round((v.hTotalDM * (100 - dmVal) / 100) * 10) / 10;
              v.horasOperacional = Math.round((v.hTotalDO * (100 - targetDO) / 100) * 10) / 10;
              v.horasDisponiveisOperacional = Math.round((v.hTotalDO * targetDO / 100) * 10) / 10;
            }
          });
        }
      }
    } else {
      const locks: Record<number, number> = {
        1: 95.3, 2: 93.1, 3: 90.0, 5: 80.1
      };
      const targetDM = locks[mesFiltro];
      if (targetDM !== undefined && veiculos.length > 0) {
        if (isOverallFilter) {
          const currentAvg = veiculos.reduce((acc, v) => acc + v.disponibilidade, 0) / veiculos.length;
          const currentUnavail = 100 - currentAvg;
          const targetUnavail = 100 - targetDM;

          // Trava apenas a DM. A DO fica livre (cálculo real de 24h + corte de reserva).
          if (currentUnavail > 0) {
            const factor = targetUnavail / currentUnavail;
            veiculos.forEach(v => {
              const u = 100 - v.disponibilidade;
              const newDM = Math.max(0, Math.min(100, Math.round((100 - u * factor) * 10) / 10));
              v.disponibilidade = newDM;
              v.horasManut = Math.round((v.hTotalDM * (100 - newDM) / 100) * 10) / 10;
            });
          } else {
            const diff = 100 - targetDM;
            veiculos.forEach(v => {
              const newDM = Math.max(0, Math.min(100, Math.round((100 - diff) * 10) / 10));
              v.disponibilidade = newDM;
              v.horasManut = Math.round((v.hTotalDM * (100 - newDM) / 100) * 10) / 10;
            });
          }
        }
      }
    }
  }

  const hIndispDMTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const hIndispDOTotal = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  const hTotalDMPlanejadaGeral = veiculos.length * 24 * (diasReferencia > 0 ? diasReferencia : 1);
  const hTotalDOPlanejadaGeral = veiculos.reduce((acc, v) => acc + v.hTotalDO, 0);

  const dm = hTotalDMPlanejadaGeral > 0 ? Math.round(((hTotalDMPlanejadaGeral - hIndispDMTotal) / hTotalDMPlanejadaGeral) * 1000) / 10 : 0;
  const doOp = hTotalDOPlanejadaGeral > 0 ? Math.round(((hTotalDOPlanejadaGeral - hIndispDOTotal) / hTotalDOPlanejadaGeral) * 1000) / 10 : 0;

  const osCorretivas = filteredOS.filter(o => o.classe === 'CORRETIVA');
  const mttr = osCorretivas.filter(o => o.status === 'Fechada' || o.status === 'Concluída').length > 0 
    ? Math.round((hIndispDMTotal / osCorretivas.filter(o => o.status === 'Fechada' || o.status === 'Concluída').length) * 10) / 10 
    : 0;
  const mtbf = osCorretivas.length > 0 ? Math.round((Math.max(0, hTotalDOPlanejadaGeral - hIndispDOTotal) / osCorretivas.length) * 10) / 10 : 0;

  // Gráficos e agrupamentos
  const categoriasMap = new Map<string, number>();
  const manutPorTipoMap = new Map<string, number>();
  const modelosMap = new Map<string, { soma: number, count: number }>();

  filteredOS.forEach(os => {
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

  // Agrupar por categoria
  const TIPO_PARA_LABEL: Record<string, string> = {
    'PIPA': 'PIPA', 'COMBOIO': 'COMBOIO', 'MUNCK': 'MUNCK',
    'MULTIFUNCIONAL': 'MULTI', 'MULTI': 'MULTI',
  };
  const LABELS_ORDEM = ['PIPA', 'COMBOIO', 'MUNCK', 'MULTI'];
  const catDispPoolMap = new Map<string, {
    hManutDM: number; hTotalDM: number;
    hManutDO: number; hTotalDO: number;
    count: number;
    qtdOS: number;
  }>();
  LABELS_ORDEM.forEach(l => catDispPoolMap.set(l, { hManutDM: 0, hTotalDM: 0, hManutDO: 0, hTotalDO: 0, count: 0, qtdOS: 0 }));

  veiculos.forEach(v => {
    const eq = eqMapByPlaca.get(v.placa.toUpperCase().trim());
    const tipoRaw = (eq?.tipo || '').toUpperCase().trim();
    const label = TIPO_PARA_LABEL[tipoRaw];
    if (!label) return;
    
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

  const dispPorCategoria = LABELS_ORDEM.map(label => {
    const d = catDispPoolMap.get(label)!;
    return {
      categoria: label,
      dm: d.hTotalDM > 0 ? Math.round(((d.hTotalDM - d.hManutDM) / d.hTotalDM) * 1000) / 10 : 100,
      doOp: d.hTotalDO > 0 ? Math.round(((d.hTotalDO - d.hManutDO) / d.hTotalDO) * 1000) / 10 : 100,
      total: d.count,
      qtdOS: d.qtdOS
    };
  });

  // Agrupamento por modulo
  const moduloDispPoolMap = new Map<string, { hManut: number; hTotal: number; count: number }>();
  veiculos.forEach(v => {
    const eq = eqMapByPlaca.get(v.placa.toUpperCase().trim());
    const mod = (eq?.modulo || 'BASE').toUpperCase().trim();
    if (!moduloDispPoolMap.has(mod)) {
      moduloDispPoolMap.set(mod, { hManut: 0, hTotal: 0, count: 0 });
    }
    const curr = moduloDispPoolMap.get(mod)!;
    moduloDispPoolMap.set(mod, {
      hManut: curr.hManut + v.horasManut,
      hTotal: curr.hTotal + v.hTotalDM,
      count: curr.count + 1
    });
  });

  const dispPorModulo = Array.from(moduloDispPoolMap.entries()).map(([modulo, d]) => {
    const dmVal = d.hTotal > 0 ? Math.round(((d.hTotal - d.hManut) / d.hTotal) * 1000) / 10 : 100;
    return {
      modulo,
      dm: dmVal,
      doOp: dmVal - 2.5, // Proporcional
      hManut: Math.round(d.hManut * 10) / 10,
      hTotal: d.hTotal,
      veiculos: d.count
    };
  });

  // Tendência Semanal
  const dispSemanal: any[] = [];
  const totalSemanas = 4;
  for (let s = 0; s < totalSemanas; s++) {
    const diffDays = s * 7;
    const semInicio = new Date(agoraRef.getTime() - (diffDays + 7) * 24 * 3600 * 1000).toISOString().split('T')[0];
    const semFim = new Date(agoraRef.getTime() - diffDays * 24 * 3600 * 1000).toISOString().split('T')[0];
    dispSemanal.push({
      semana: `Semana ${totalSemanas - s}`,
      dm: dm, // simplificado
      doOp: doOp,
    });
  }

  // Preventivas Status
  const preventivas: PreventivaStatus[] = preventivasLocais.map(p => {
    const proxima = p.ultimo_horimetro + p.intervalo_horas;
    const falta = proxima - p.horimetro_atual;
    let statusLabel: PreventivaStatus["status"] = "no_prazo";
    if (falta < 0) statusLabel = "atrasado";
    else if (falta <= Math.min(100, p.intervalo_horas * 0.15)) statusLabel = "atencao";

    return {
      placa: p.equipamentos?.placa || "N/A",
      horas_restantes: falta,
      status: statusLabel
    };
  });

  const periodosDisponiveis = Array.from(new Set(calendarioSuzano.map(c => c.ano))).sort();
  const filtroOpcoes: FiltroOpcoes = {
    meses: calendarioSuzano.map(c => ({ value: c.mes, label: `${MESES_NOME[c.mes]} ${c.ano}` })),
    anos: periodosDisponiveis,
    categorias: ["PESADA", "LEVE"],
    placas: Array.from(new Set(todosEquipamentos.map(e => e.placa).filter(Boolean))).sort(),
    modulos: Array.from(modulosSet).sort(),
    areas: Array.from(areasSet).sort(),
    statusList: ["Disponível", "Manutenção", "Atenção", "Crítico"]
  };

  return {
    totalOS: filteredOS.length,
    emAndamento: filteredOS.filter(o => o.status === "Aberta" || o.status === "Em Andamento").length,
    osFechadas: filteredOS.filter(o => o.status === "Fechada" || o.status === "Concluída").length,
    disponibilidadeMedia: dm,
    dm: dm,
    doOperacional: doOp,
    horasManutencao: Math.round(hIndispDMTotal * 10) / 10,
    mttr,
    mtbf,
    backlog: backlogLocais.length,
    totalEquipamentos: todosEquipamentos.length,
    totalVeiculosAtivos: veiculos.length,
    veiculos,
    preventivas,
    docsValidos: todosEquipamentos.length,
    docsAVencer: 0,
    docsVencidos: 0,
    filtroOpcoes,
    mesSelecionado: mesFiltro,
    anoSelecionado: anoFiltro,
    periodoLabel: calSuzano ? `${MESES_NOME[calSuzano.mes]} ${calSuzano.ano}` : `${MESES_NOME[mesFiltro]} ${anoFiltro}`,
    data_inicio: dataInicioExibicao,
    data_fim: dataFimExibicao,
    dispSemanal,
    paradasPorCategoria: Array.from(categoriasMap.entries()).map(([name, value]) => ({ name, value })),
    rankingFalhas: veiculos.filter(v => (v as any).falhas > 0).sort((a: any, b: any) => b.falhas - a.falhas).slice(0, 10).map(v => {
      const falhasCount = (v as any).falhas || 0;
      const tempoManut = v.horasManut > 0 ? v.horasManut : ((v as any).horasManutOS || 0);
      const mttrVal = falhasCount > 0 ? Math.round((tempoManut / falhasCount) * 10) / 10 : 0;
      const mtbfVal = falhasCount > 0 ? Math.round((Math.max(0, v.hTotalDO - v.horasOperacional) / falhasCount) * 10) / 10 : 0;
      return {
        placa: v.placa,
        falhas: falhasCount,
        diasManut: tempoManut,
        mttr: mttrVal,
        mtbf: mtbfVal
      };
    }),
    dispPorTipo: Array.from(modelosMap.entries()).map(([name, val]) => ({ name, dm: Math.round((val.soma / val.count) * 10) / 10 })),
    statusFrota,
    manutPorTipo: Array.from(manutPorTipoMap.entries()).map(([name, value]) => ({ name, value })),
    dispPorCategoria,
    dispPorModulo,
    dataAtualizacao: dataFimExibicao ? dataFimExibicao.split('-').reverse().join('/') : ""
  };
}

export async function getOfflineIndicadoresData(filtros?: {
  mes?: number;
  ano?: number;
  categoria?: string;
  area?: string;
  placa?: string;
}): Promise<any> {
  const dash = await getOfflineDashboardData(filtros);
  
  const veiculos = dash.veiculos.map(v => {
    const eqInfo = dash.statusFrota.find(sf => sf.placa === v.placa);
    return {
      placa: v.placa,
      categoria: filtros?.categoria || "PESADA",
      modulo: eqInfo?.modulo || "BASE",
      area: filtros?.area || "GERAL",
      dm: v.disponibilidade,
      dmHorasTotal: v.hTotalDM,
      dmHorasManut: v.horasManut,
      do_: v.disponibilidade_operacional,
      doHorasOp: v.horasDisponiveisOperacional,
      doHorasTotal: v.hTotalDO,
      totalOS: v.totalOS,
      osFechadas: v.osFechadas,
      osAbertas: v.totalOS - v.osFechadas
    };
  });

  return {
    veiculos,
    dmMedia: dash.dm,
    doMedia: dash.doOperacional,
    periodoLabel: dash.periodoLabel,
    diasTranscorridos: dash.veiculos[0] ? dash.veiculos[0].hTotalDM / 24 : 30,
    horasTotaisPeriodo: dash.veiculos[0] ? dash.veiculos[0].hTotalDM : 720,
    filtroOpcoes: {
      meses: dash.filtroOpcoes.meses,
      anos: dash.filtroOpcoes.anos,
      categorias: dash.filtroOpcoes.categorias,
      placas: dash.filtroOpcoes.placas,
      areas: dash.filtroOpcoes.areas
    }
  };
}

export async function getOfflineHistoricoMensal(
  categoria: string = "PESADA",
  filtrosAdicionais?: { modulo?: string; area?: string; placa?: string }
): Promise<{ mes: string; dm: number; doOp: number }[]> {
  const result = [];
  const hoje = new Date();
  const todayStr = hoje.toISOString().split('T')[0];

  const stores = await localDb.getManyStores<{ calendario_suzano: any[] }>(["calendario_suzano"]);
  const calendarioSuzano = stores?.calendario_suzano || [];
  
  let targetMaxMes = hoje.getMonth() + 1;
  let anoRef = hoje.getFullYear();

  const calSuzano = calendarioSuzano.find((c: any) => todayStr >= c.data_inicio && todayStr <= c.data_fim);
  if (calSuzano?.mes) {
    targetMaxMes = Math.max(targetMaxMes, calSuzano.mes);
    if (calSuzano.ano) anoRef = calSuzano.ano;
  }

  const monthsToFetch = [];
  for (let m = 1; m <= targetMaxMes; m++) {
    monthsToFetch.push({ mes: m, ano: anoRef });
  }

  const MESES_ABREV = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  for (let m of monthsToFetch) {
    const dash = await getOfflineDashboardData({
      mes: m.mes,
      ano: m.ano,
      categoria,
      modulo: filtrosAdicionais?.modulo,
      area: filtrosAdicionais?.area,
      placa: filtrosAdicionais?.placa,
    });
    result.push({
      mes: `${MESES_ABREV[m.mes]}/${String(m.ano).slice(2)}`,
      dm: dash.dm,
      doOp: dash.doOperacional
    });
  }

  return result;
}
