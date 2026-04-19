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
  const supabase = createClient();
  const agoraRef = new Date();
  // Ontem às 23:59:59 (D-1)
  const ontem = new Date(agoraRef);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);
  
  const diaHoje = agoraRef.getDate();
  const mesAtualRef = agoraRef.getMonth() + 1;
  const anoAtualRef = agoraRef.getFullYear();

  const mesFiltro = filtros?.mes && filtros.mes > 0 ? filtros.mes : mesAtualRef;
  const anoFiltro = filtros?.ano && filtros.ano > 0 ? filtros.ano : anoAtualRef;

  let inicioFiltro: string;
  let fimFiltro: string;
  let diasReferencia: number;
  let dataInicioExibicao: string = "";
  let dataFimExibicao: string = "";

  // 1. Definir limite máximo para consultas (agora = momento atual)
  const agora = new Date();

  if (filtros?.dataInicio && filtros?.dataFim) {
    inicioFiltro = filtros.dataInicio;
    fimFiltro = `${filtros.dataFim}T23:59:59`;
    
    const dInicio = new Date(inicioFiltro);
    const dFim = new Date(fimFiltro);
    // Não deixa passar do momento atual
    const fimEfetivo = dFim > agora ? agora : dFim;
    const diffMs = Math.max(0, fimEfetivo.getTime() - dInicio.getTime());
    diasReferencia = Math.floor(diffMs / 86400000) + 1;
    fimFiltro = fimEfetivo.toISOString();
    dataInicioExibicao = filtros.dataInicio;
    dataFimExibicao = filtros.dataFim;
  } else {
    const { data: calSuzano } = await supabase
      .from("calendario_suzano")
      .select("*")
      .eq("mes", mesFiltro)
      .eq("ano", anoFiltro)
      .single();

    if (calSuzano) {
      inicioFiltro = calSuzano.data_inicio;
      dataInicioExibicao = calSuzano.data_inicio;
      dataFimExibicao = calSuzano.data_fim;
      const rawFim = calSuzano.data_fim;

      const dFimCal = new Date(rawFim + 'T23:59:59');
      const dInicioCal = new Date(calSuzano.data_inicio + 'T00:00:00');
      
      // Limite = Ontem (D-1) para o mês atual
      const isMesFuturoOuAtual = (anoFiltro > anoAtualRef) || (anoFiltro === anoAtualRef && mesFiltro >= mesAtualRef);
      const fimEfetivoCal = (isMesFuturoOuAtual && dFimCal > ontem) ? ontem : dFimCal;
      
      const diffMs = Math.max(0, fimEfetivoCal.getTime() - dInicioCal.getTime());
      diasReferencia = Math.floor(diffMs / 86400000) + 1;
      
      // Para a query no DB usamos o limite de tempo
      fimFiltro = dFimCal.toISOString().split('T')[0] + 'T23:59:59';
    } else {
      inicioFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-01`;
      const diasNoMes = new Date(anoFiltro, mesFiltro, 0).getDate();
      const dFimCivil = new Date(anoFiltro, mesFiltro - 1, diasNoMes, 23, 59, 59);
      
      // Limite = agora
      const fimEfetivoCivil = dFimCivil > agora ? agora : dFimCivil;
      const dInicioCivil = new Date(inicioFiltro + 'T00:00:00');
      
      const diffMs = Math.max(0, fimEfetivoCivil.getTime() - dInicioCivil.getTime());
      diasReferencia = Math.floor(diffMs / 86400000) + 1;
      fimFiltro = fimEfetivoCivil.toISOString();
      dataInicioExibicao = inicioFiltro;
      dataFimExibicao = fimFiltro.split("T")[0];
    }
  }

  // 1. Consultas Iniciais Paralelizadas
  const [osRes, eqRes, escalasRes, calSuzanoRes] = await Promise.all([
    supabase.from("ordens_servico").select(`
      id, status, horas_manutencao, data_abertura, data_fechamento, 
      equipamento_id, placa, classe, foi_enviado_reserva,
      horario_parada, horas_reserva_chegou
    `)
    .or(`data_abertura.lte.${fimFiltro},horario_parada.lte.${fimFiltro}`)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicioFiltro}`),
    supabase.from("equipamentos").select("*"),
    supabase.from("escala_frota").select("*"),
    (!filtros?.dataInicio || !filtros?.dataFim) ? 
      supabase.from("calendario_suzano").select("*").eq("mes", mesFiltro).eq("ano", anoFiltro).single() : 
      Promise.resolve({ data: null })
  ]);

  const allOS = osRes.data ?? [];
  const todasAsEquips = eqRes.data ?? [];
  const escalas = escalasRes.data ?? [];
  
  const frotaAtiva = todasAsEquips.filter(eq => String(eq.status || 'Ativo').toUpperCase().trim() !== "INATIVO");
  const eqMap = new Map();
  const categoriasSet = new Set<string>();
  const modulosSet = new Set<string>();
  
  frotaAtiva.forEach(eq => {
    eqMap.set(eq.id, eq);
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.modulo) modulosSet.add(eq.modulo);
  });

  // ─── OTIMIZAÇÃO: Mapear OS por Placa uma única vez ───
  const osPorPlaca = new Map<string, any[]>();
  allOS.forEach(os => {
    let p = os.placa?.toUpperCase().trim();
    if (!p && os.equipamento_id) {
      p = eqMap.get(os.equipamento_id)?.placa?.toUpperCase().trim();
    }
    if (p) {
      if (!osPorPlaca.has(p)) osPorPlaca.set(p, []);
      osPorPlaca.get(p)!.push(os);
    }
  });

  const escalaMap = new Map();
  escalas.forEach(e => escalaMap.set(e.placa.toUpperCase().trim(), e));

  let placasFiltradas = frotaAtiva.map(eq => eq.placa?.toUpperCase().trim()).filter(p => p && !["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"].includes(p));

  if (filtros?.placa) placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase());
  if (filtros?.categoria && filtros.categoria !== "Todas") {
    const catUpper = filtros.categoria.toUpperCase();
    placasFiltradas = placasFiltradas.filter(p => {
      const eq = frotaAtiva.find(e => e.placa?.toUpperCase().trim() === p);
      return eq?.categoria?.toUpperCase() === catUpper;
    });
  }

  // 4. Cálculos Otimizados
  const veiculos: VeiculoDisp[] = [];
  const periodoInicioObj = new Date(inicioFiltro);
  const periodoFimObj = new Date(fimFiltro);

  for (const placa of placasFiltradas) {
    const escala = escalaMap.get(placa);
    const osDoVeiculo = osPorPlaca.get(placa) || [];

    let hIndispDM = 0;
    let hIndispDO = 0;
    let hPlanejadasDO = 0;
    const hPlanejadasDM = 24 * diasReferencia;
    let fechadas = 0;

    // Agrupamento de intervalos por dia fora do loop de dias se possível, ou otimizado
    for (let d = 0; d < diasReferencia; d++) {
      const dataCorrente = new Date(periodoInicioObj);
      dataCorrente.setDate(periodoInicioObj.getDate() + d);
      
      hPlanejadasDO += escala ? Number(escala.carga_horaria) : 24;

      const d0 = dataCorrente.getTime();
      const d24 = d0 + 86399999;

      const intervalosDM: Array<{start: number, end: number}> = [];
      const intervalosDO: Array<{start: number, end: number}> = [];

      osDoVeiculo.forEach(os => {
        const inicioOS = (os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura)).getTime();
        const fimOSRaw = (os.data_fechamento ? new Date(os.data_fechamento) : agoraRef).getTime();
        const realFimLimit = Math.min(fimOSRaw, ontem.getTime(), periodoFimObj.getTime());

        // DM
        const intDMini = Math.max(inicioOS, d0);
        const intDMfim = Math.min(realFimLimit, d24);
        if (intDMini < intDMfim) {
          intervalosDM.push({ start: intDMini, end: intDMfim });
        }

        // DO
        if (escala) {
          const dStr = dataCorrente.toISOString().split('T')[0];
          const shiftStart = new Date(`${dStr}T${escala.periodo_inicio}`).getTime();
          let shiftEnd = new Date(`${dStr}T${escala.periodo_fim}`).getTime();
          if (shiftEnd <= shiftStart) shiftEnd += 86400000;

          const interInicio = Math.max(inicioOS, shiftStart);
          const interFim = Math.min(realFimLimit, shiftEnd);
          if (interInicio < interFim) {
            intervalosDO.push({ start: interInicio, end: interFim });
          }
        } else {
          if (intDMini < intDMfim) {
            intervalosDO.push({ start: intDMini, end: intDMfim });
          }
        }
      });

      if (intervalosDM.length > 0) hIndispDM += mergeTimeIntervals(intervalosDM);
      if (intervalosDO.length > 0) hIndispDO += mergeTimeIntervals(intervalosDO);
    }

    osDoVeiculo.forEach(os => {
      if (os.status === "Fechada" || os.status === "Concluída") fechadas++;
    });

    veiculos.push({
      placa,
      disponibilidade: hPlanejadasDM > 0 ? Math.round(Math.max(0, Math.min(100, ((hPlanejadasDM - hIndispDM) / hPlanejadasDM) * 100)) * 10) / 10 : 100,
      disponibilidade_operacional: hPlanejadasDO > 0 ? Math.round(Math.max(0, Math.min(100, ((hPlanejadasDO - hIndispDO) / hPlanejadasDO) * 100)) * 10) / 10 : 100,
      totalOS: osDoVeiculo.length,
      osFechadas: fechadas,
      horasManut: Math.round(hIndispDM * 10) / 10,
      horasOperacional: Math.round(hIndispDO * 10) / 10,
      hTotalDM: hPlanejadasDM,
      hTotalDO: hPlanejadasDO,
      horasDisponiveisOperacional: Math.round((hPlanejadasDO - hIndispDO) * 10) / 10,
      falhas: osDoVeiculo.filter(o => o.classe === 'CORRETIVA').length
    } as any);
  }

  // 5. Consolidação Final
  const hIndispDMTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const hIndispDOTotal = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  const hTotalDMPlanejadaGeral = veiculos.length * 24 * diasReferencia;
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
    const eq = os.equipamento_id ? eqMap.get(os.equipamento_id) : null;
    const cat = eq?.categoria || "Outros";
    categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + 1);
    
    const tipo = os.classe || "Sem Classe";
    manutPorTipoMap.set(tipo, (manutPorTipoMap.get(tipo) || 0) + 1);
  });

  veiculos.forEach(v => {
    const eq = frotaAtiva.find(e => e.placa === v.placa);
    const mod = eq?.modelo || "Outros";
    const curr = modelosMap.get(mod) || { soma: 0, count: 0 };
    modelosMap.set(mod, { soma: curr.soma + v.disponibilidade_operacional, count: curr.count + 1 });
  });

  const statusFrota = veiculos.map(v => {
    const eq = frotaAtiva.find(e => e.placa?.toUpperCase().trim() === v.placa.toUpperCase().trim());
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
    const eq = frotaAtiva.find(e => e.placa?.toUpperCase().trim() === v.placa.toUpperCase().trim());
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

  // E. Disponibilidade Semanal
  const dispSemanal = [];
  const pInicioTime = periodoInicioObj.getTime();
  const pFimTime = periodoFimObj.getTime();
  const semanas = Math.ceil((pFimTime - pInicioTime) / (7 * 86400000));

  for (let s = 1; s <= semanas; s++) {
    const sInicio = pInicioTime + (s-1) * 7 * 86400000;
    const sFim = Math.min(pFimTime, sInicio + 7 * 86400000 - 1);
    
    let hIndispSemanaTotal = 0;
    allOS.forEach(os => {
      const oInicio = (os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura)).getTime();
      const oFim = (os.data_fechamento ? new Date(os.data_fechamento) : agoraRef).getTime();
      const eInicio = Math.max(oInicio, sInicio);
      const eFim = Math.min(oFim, sFim);
      if (eInicio < eFim) hIndispSemanaTotal += (eFim - eInicio) / 3600000;
    });

    const hTotaisSemana = (veiculos.length || 1) * ((sFim - sInicio) / 3600000);
    dispSemanal.push({
      semana: `Semana ${s}`,
      disp: Math.round(Math.max(0, ((hTotaisSemana - hIndispSemanaTotal) / hTotaisSemana) * 100) * 10) / 10
    });
  }

  const { data: prevData } = await supabase
    .from("preventivas")
    .select("equipamento_id, ultimo_horimetro, horimetro_atual, intervalo_horas, equipamentos(placa)");

  const MESES_NOME = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return {
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
    preventivas: (prevData ?? []).map((p: any) => {
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
    data_fim: dataFimExibicao
  };
}
