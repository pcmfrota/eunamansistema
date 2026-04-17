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
};

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
  const diaHoje = agoraRef.getDate();
  const mesAtualRef = agoraRef.getMonth() + 1;
  const anoAtualRef = agoraRef.getFullYear();

  const mesFiltro = filtros?.mes && filtros.mes > 0 ? filtros.mes : mesAtualRef;
  const anoFiltro = filtros?.ano && filtros.ano > 0 ? filtros.ano : anoAtualRef;

  let inicioFiltro: string;
  let fimFiltro: string;
  let diasReferencia: number;

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
  } else {
    const { data: calSuzano } = await supabase
      .from("calendario_suzano")
      .select("*")
      .eq("mes", mesFiltro)
      .eq("ano", anoFiltro)
      .single();

    if (calSuzano) {
      inicioFiltro = calSuzano.data_inicio;
      const rawFim = calSuzano.data_fim;

      const dFimCal = new Date(rawFim + 'T23:59:59');
      const dInicioCal = new Date(calSuzano.data_inicio + 'T00:00:00');
      
      // Limite = agora (apenas se for o mês corrente)
      const isMesFuturoOuAtual = (anoFiltro > anoAtualRef) || (anoFiltro === anoAtualRef && mesFiltro >= mesAtualRef);
      const fimEfetivoCal = (isMesFuturoOuAtual && dFimCal > agora) ? agora : dFimCal;
      
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
    }
  }

  // 2. Buscar OS e Equipamentos
  // Lógica PCM: Queremos TODAS as OS que intersectam o período:
  // (Início da Parada <= Fim do Período) AND (Fim da Parada >= Início do Período OU Fim da Parada IS NULL)
  const [osRes, eqRes] = await Promise.all([
    supabase.from("ordens_servico").select(`
      id, status, horas_manutencao, data_abertura, data_fechamento, 
      equipamento_id, placa, classe, foi_enviado_reserva,
      horario_parada, horas_reserva_chegou
    `)
    // Captura OS que começaram até o fim do período (seja pela data de abertura ou horário de parada real)
    .or(`data_abertura.lte.${fimFiltro},horario_parada.lte.${fimFiltro}`)
    // E que ainda não fecharam OU fecharam depois do início do período (impactam o período)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicioFiltro}`),
    supabase.from("equipamentos").select("*")
  ]);

  if (osRes.error) {
    console.error("DASHBOARD OS QUERY ERROR:", osRes.error.message);
  }

  const allOS = osRes.data ?? [];
  const todasAsEquips = eqRes.data ?? [];
  const frotaAtiva = todasAsEquips.filter(eq => String(eq.status || 'Ativo').toUpperCase().trim() !== "INATIVO");

  const eqMap = new Map();
  const categoriasSet = new Set<string>();
  const modulosSet = new Set<string>();
  frotaAtiva.forEach(eq => {
    eqMap.set(eq.id, eq);
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.modulo) modulosSet.add(eq.modulo);
  });

  const categoriaFiltroEfetivo = filtros?.categoria;
  let placasFiltradas = frotaAtiva.map(eq => eq.placa?.toUpperCase().trim()).filter(p => p && !["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"].includes(p));

  if (filtros?.placa) placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase());
  if (categoriaFiltroEfetivo && categoriaFiltroEfetivo !== "Todas") {
    placasFiltradas = placasFiltradas.filter(p => {
      const eq = frotaAtiva.find(e => e.placa?.toUpperCase().trim() === p);
      return eq?.categoria?.toUpperCase() === categoriaFiltroEfetivo.toUpperCase();
    });
  }

  // 3. Buscar Escala da Frota
  const { data: escalas } = await supabase.from("escala_frota").select("*");
  const escalaMap = new Map();
  escalas?.forEach(e => escalaMap.set(e.placa.toUpperCase().trim(), e));

  // 4. Cálculos
  const veiculos: VeiculoDisp[] = [];
  const periodoInicioObj = new Date(inicioFiltro);
  const periodoFimObj = new Date(fimFiltro);

  // Helper para calcular interseção de tempo em um dia específico
  const calcularIntersecaoDia = (
    dataBase: Date, 
    inicioOS: Date, 
    fimOS: Date, 
    hInicioEscala: string, 
    hFimEscala: string
  ) => {
    const dStr = dataBase.toISOString().split('T')[0];
    const shiftStart = new Date(`${dStr}T${hInicioEscala}`);
    const shiftEnd = new Date(`${dStr}T${hFimEscala}`);
    
    // Ajuste para turnos que cruzam a meia-noite (Ex: 08:00 -> 00:00 conta como 16h no mesmo dia)
    // Se shiftEnd <= shiftStart, assumimos que termina no dia seguinte
    if (shiftEnd <= shiftStart) {
      shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    const interInicio = inicioOS > shiftStart ? inicioOS : shiftStart;
    const interFim = fimOS < shiftEnd ? fimOS : shiftEnd;

    const diffMs = interFim.getTime() - interInicio.getTime();
    return Math.max(0, diffMs) / 3600000;
  };

  for (const placa of placasFiltradas) {
    const escala = escalaMap.get(placa);
    const osDoVeiculo = allOS.filter(o => {
      let osPlaca = o.placa?.toUpperCase().trim();
      if (!osPlaca && o.equipamento_id) {
        osPlaca = eqMap.get(o.equipamento_id)?.placa?.toUpperCase().trim();
      }
      return osPlaca === placa;
    });

    let hIndispDM = 0;
    let hIndispDO = 0;
    let hPlanejadasDO = 0;
    const hPlanejadasDM = 24 * diasReferencia;
    let fechadas = 0;

    // Iterar por cada dia do período para calcular horas planejadas e interseção de OS
    for (let d = 0; d < diasReferencia; d++) {
      const dataCorrente = new Date(periodoInicioObj);
      dataCorrente.setDate(periodoInicioObj.getDate() + d);

      // Horas planejadas no dia para DO (Turno)
      if (escala) {
        hPlanejadasDO += Number(escala.carga_horaria);
      } else {
        hPlanejadasDO += 24; // Default
      }

      const d0 = new Date(dataCorrente); d0.setHours(0,0,0,0);
      const d24 = new Date(dataCorrente); d24.setHours(23,59,59,999);

      // Interseção de cada OS com o turno do dia — Lógica PCM DM vs DO
      osDoVeiculo.forEach(os => {
        const inicioOS = os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura);
        const fimOS = os.data_fechamento ? new Date(os.data_fechamento) : agoraRef;
        const fimOSClip = fimOS > periodoFimObj ? periodoFimObj : fimOS;

        // ── DM: Interseção com o dia inteiro (24h)
        const intDMini = inicioOS > d0 ? inicioOS : d0;
        const intDMfim = fimOSClip < d24 ? fimOSClip : d24;
        if (intDMini < intDMfim) {
          hIndispDM += (intDMfim.getTime() - intDMini.getTime()) / 3600000;
        }

        // ── DO: Interseção somente com o Turno (Carga Horária)
        if (escala) {
          hIndispDO += calcularIntersecaoDia(dataCorrente, inicioOS, fimOSClip, escala.periodo_inicio, escala.periodo_fim);
        } else {
          // Se não houver escala, DO = DM (considera 24h as horas planejadas)
          const intDOini = inicioOS > d0 ? inicioOS : d0;
          const intDOfim = fimOSClip < d24 ? fimOSClip : d24;
          if (intDOini < intDOfim) hIndispDO += (intDOfim.getTime() - intDOini.getTime()) / 3600000;
        }
      });
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

  // 5. Consolidação Final (Métricas PCM)
  const hIndispDMTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const hIndispDOTotal = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  
  // Total de horas planejadas da frota no período
  const hTotalFrotaPlanejada = veiculos.reduce((acc, v) => {
    const escala = escalaMap.get(v.placa);
    return acc + (escala ? Number(escala.carga_horaria) * diasReferencia : 24 * diasReferencia);
  }, 0);

  const dm = hTotalFrotaPlanejada > 0 ? Math.round(((hTotalFrotaPlanejada - hIndispDMTotal) / hTotalFrotaPlanejada) * 1000) / 10 : 0;
  const doOp = hTotalFrotaPlanejada > 0 ? Math.round(((hTotalFrotaPlanejada - hIndispDOTotal) / hTotalFrotaPlanejada) * 1000) / 10 : 0;

  // MTTR/MTBF baseados apenas em Corretivas (Padrão PCM)
  const osCorretivas = allOS.filter(o => o.classe === 'CORRETIVA');
  const osCorretivasFechadas = osCorretivas.filter(o => o.status === 'Fechada' || o.status === 'Concluída');
  
  const mttr = osCorretivasFechadas.length > 0 ? Math.round((hIndispDMTotal / osCorretivasFechadas.length) * 10) / 10 : 0;
  const hOperacionaisTotal = Math.max(0, hTotalFrotaPlanejada - hIndispDMTotal);
  const mtbf = osCorretivas.length > 0 ? Math.round((hOperacionaisTotal / osCorretivas.length) * 10) / 10 : 0;

  // 5. Ranking de Falhas (Top 10 veículos que mais deram corretiva)
  const rankingFalhas = veiculos
    .filter(v => (v as any).falhas > 0)
    .sort((a, b) => (b as any).falhas - (a as any).falhas)
    .slice(0, 10)
    .map(v => {
      const escala = escalaMap.get(v.placa);
      const horasTotaisVeiculo = escala ? Number(escala.carga_horaria) * diasReferencia : 24 * diasReferencia;
      return {
        placa: v.placa,
        falhas: (v as any).falhas,
        mtbf: (v as any).falhas > 0 ? Math.round(((horasTotaisVeiculo - v.horasManut) / (v as any).falhas) * 10) / 10 : 0
      };
    });

  // 6. Dados para Gráficos Extras
  // A. Paradas por Categoria
  const categoriasMap = new Map<string, number>();
  allOS.forEach(os => {
    const eq = os.equipamento_id ? eqMap.get(os.equipamento_id) : null;
    const cat = eq?.categoria || "Outros";
    categoriasMap.set(cat, (categoriasMap.get(cat) || 0) + 1);
  });
  const paradasPorCategoria = Array.from(categoriasMap.entries()).map(([categoria, quantidade]) => ({ categoria, quantidade }));

  // B. Manutenção por Tipo
  const manutPorTipoMap = new Map<string, number>();
  allOS.forEach(os => {
    const tipo = os.classe || "Sem Classe";
    manutPorTipoMap.set(tipo, (manutPorTipoMap.get(tipo) || 0) + 1);
  });
  const manutPorTipo = Array.from(manutPorTipoMap.entries()).map(([tipo, quantidade]) => ({ tipo, quantidade }));

  // C. Disponibilidade por Modelo (Agrupado)
  const modelosMap = new Map<string, { soma: number, count: number }>();
  veiculos.forEach(v => {
    const eq = todasAsEquips.find(e => e.placa === v.placa);
    const mod = eq?.modelo || "Outros";
    const curr = modelosMap.get(mod) || { soma: 0, count: 0 };
    modelosMap.set(mod, { soma: curr.soma + v.disponibilidade_operacional, count: curr.count + 1 });
  });
  const dispPorTipo = Array.from(modelosMap.entries()).map(([tipo, data]) => ({
    tipo,
    disponibilidade: Math.round((data.soma / data.count) * 10) / 10,
    total: data.count
  }));

  // D. Status da Frota (Tabela Dinâmica)
  const statusFrota = veiculos.map(v => {
    const eq = todasAsEquips.find(e => e.placa?.toUpperCase().trim() === v.placa.toUpperCase().trim());
    
    // Busca OS aberta usando placa ou equipamento_id para garantir vínculo
    const osAbertaAtiva = allOS.find(o => {
      let osPlaca = o.placa?.toUpperCase().trim();
      if (!osPlaca && o.equipamento_id) {
        osPlaca = eqMap.get(o.equipamento_id)?.placa?.toUpperCase().trim();
      }
      return osPlaca === v.placa && (o.status === 'Aberta' || o.status === 'Em Andamento');
    });

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

  // 6. Aplicar Filtro de Status (se fornecido)
  let statusFrotaFinal = statusFrota;
  if (filtros?.status && filtros.status !== "Todos") {
    statusFrotaFinal = statusFrota.filter(s => s.status === filtros.status);
    // Também filtrar a lista de veículos usada nos gráficos
    const placasNoStatus = new Set(statusFrotaFinal.map(s => s.placa));
    // veiculos = veiculos.filter(v => placasNoStatus.has(v.placa)); // veiculos é const, precisamos filtrar os que sobraram
  }

  const veiculosFiltrados = (filtros?.status && filtros.status !== "Todos") 
    ? veiculos.filter(v => statusFrotaFinal.some(sf => sf.placa === v.placa))
    : veiculos;

  // E. Disponibilidade Semanal
  const dispSemanal = [];
  const diasPeriodo = Math.ceil((periodoFimObj.getTime() - periodoInicioObj.getTime()) / 86400000);
  const semanas = Math.ceil(diasPeriodo / 7);
  for (let s = 1; s <= semanas; s++) {
    const sInicio = new Date(periodoInicioObj.getTime() + (s-1) * 7 * 86400000);
    const sFim = new Date(Math.min(periodoFimObj.getTime(), sInicio.getTime() + 6 * 86400000 + 23*3600000));
    
    let hIndispSemanaTotal = 0;
    allOS.forEach(os => {
      let oInicio = os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura);
      let oFim = os.data_fechamento ? new Date(os.data_fechamento) : agoraRef;
      
      const eInicio = oInicio < sInicio ? sInicio : oInicio;
      const eFim = oFim > sFim ? sFim : oFim;
      
      if (eInicio < eFim) {
        hIndispSemanaTotal += (eFim.getTime() - eInicio.getTime()) / 3600000;
      }
    });

    const hTotaisSemana = (veiculos.length || 1) * Math.min(168, (sFim.getTime() - sInicio.getTime()) / 3600000);
    dispSemanal.push({
      semana: `Semana ${s}`,
      disp: Math.round(Math.max(0, ((hTotaisSemana - hIndispSemanaTotal) / hTotaisSemana) * 100) * 10) / 10
    });
  }

  // 7. Preventivas (Buscar dados reais)
  const { data: prevData } = await supabase
    .from("preventivas")
    .select("equipamento_id, ultimo_horimetro, horimetro_atual, intervalo_horas, equipamentos(placa)");
  
  const preventivasChart = (prevData ?? []).map((p: any) => {
    const restantes = Number(p.ultimo_horimetro) + Number(p.intervalo_horas) - Number(p.horimetro_atual);
    let status: "atrasado" | "atencao" | "no_prazo";
    if (restantes < 0) status = "atrasado";
    else if (restantes <= 50) status = "atencao";
    else status = "no_prazo";

    return {
      placa: p.equipamentos?.placa || "—",
      horas_restantes: Math.round(restantes),
      status
    };
  }).sort((a, b) => a.horas_restantes - b.horas_restantes).slice(0, 10);

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
    veiculos: veiculosFiltrados.sort((a, b) => a.disponibilidade - b.disponibilidade),
    rankingFalhas,
    paradasPorCategoria,
    manutPorTipo,
    dispPorTipo,
    statusFrota: statusFrotaFinal.sort((a, b) => a.disponibilidade - b.disponibilidade),
    dispSemanal,
    preventivas: preventivasChart,
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
    data_inicio: inicioFiltro,
    data_fim: (filtros?.dataInicio && filtros?.dataFim) ? filtros.dataFim : (calSuzano ? (calSuzano as any).data_fim : fimFiltro.split("T")[0])
  };
}
