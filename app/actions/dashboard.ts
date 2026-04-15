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

  if (filtros?.dataInicio && filtros?.dataFim) {
    // Uso de Filtro Customizado (Superior ao Calendário)
    inicioFiltro = filtros.dataInicio;
    fimFiltro = `${filtros.dataFim}T23:59:59`;
    
    const diffMs = new Date(filtros.dataFim).getTime() - new Date(filtros.dataInicio).getTime();
    const totalDiasFiltro = Math.floor(diffMs / 86400000) + 1;

    // Se o filtro inclui hoje, calculamos a referência até agora (D-1)
    if (agoraRef >= new Date(filtros.dataInicio) && agoraRef <= new Date(filtros.dataFim + 'T23:59:59')) {
       const msPassados = agoraRef.getTime() - new Date(filtros.dataInicio).getTime();
       const diasPassados = Math.floor(msPassados / 86400000);
       diasReferencia = diasPassados > 0 ? diasPassados : 1;
    } else {
       diasReferencia = totalDiasFiltro;
    }
  } else {
    // 1. Buscar Período no Calendário Suzano
    const { data: calSuzano } = await supabase
      .from("calendario_suzano")
      .select("*")
      .eq("mes", mesFiltro)
      .eq("ano", anoFiltro)
      .single();

    if (calSuzano) {
      inicioFiltro = calSuzano.data_inicio;
      fimFiltro = `${calSuzano.data_fim}T23:59:59`;
      
      const dataFimCal = new Date(calSuzano.data_fim);
      if (agoraRef >= new Date(calSuzano.data_inicio) && agoraRef <= dataFimCal) {
         const diffMs = agoraRef.getTime() - new Date(calSuzano.data_inicio).getTime();
         const diasPassados = Math.floor(diffMs / 86400000);
         diasReferencia = diasPassados > 0 ? diasPassados : 1;
      } else {
         diasReferencia = calSuzano.total_dias;
      }
    } else {
      // Fallback para calendário civil
      inicioFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-01`;
      const diasNoMes = new Date(anoFiltro, mesFiltro, 0).getDate();
      fimFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-${diasNoMes}T23:59:59`;
      
      if (anoFiltro === anoAtualRef && mesFiltro === mesAtualRef) {
        diasReferencia = diaHoje > 1 ? diaHoje - 1 : 1;
      } else {
        diasReferencia = diasNoMes;
      }
    }
  }

  // 2. Buscar OS e Equipamentos
  const [osRes, eqRes] = await Promise.all([
    supabase.from("ordens_servico").select(`
      id, status, horas_manutencao, data_abertura, data_fechamento, 
      equipamento_id, placa, classe, foi_enviado_reserva, 
      horario_parada, horas_reserva_chegou
    `).gte("data_abertura", inicioFiltro).lte("data_abertura", fimFiltro),
    supabase.from("equipamentos").select("*")
  ]);

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

  const categoriaFiltroEfetivo = filtros?.categoria === undefined ? "PESADA" : filtros.categoria;
  let placasFiltradas = frotaAtiva.map(eq => eq.placa?.toUpperCase().trim()).filter(p => p && !["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"].includes(p));

  if (filtros?.placa) placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase());
  if (categoriaFiltroEfetivo && categoriaFiltroEfetivo !== "Todas") {
    placasFiltradas = placasFiltradas.filter(p => frotaAtiva.find(e => e.placa?.toUpperCase().trim() === p)?.categoria?.toUpperCase() === categoriaFiltroEfetivo.toUpperCase());
  }

  // 3. Cálculos
  const horasTotaisPorVeiculo = diasReferencia * 24;
  const veiculos: VeiculoDisp[] = [];

  for (const placa of placasFiltradas) {
    const osDoVeiculo = allOS.filter(o => {
      let p = o.placa?.toUpperCase().trim();
      const eq = o.equipamento_id ? eqMap.get(o.equipamento_id) : null;
      if (eq) p = eq.placa.toUpperCase().trim();
      return p === placa;
    });

    let hIndispDM = 0;
    let hIndispDO = 0;
    let fechadas = 0;

    osDoVeiculo.forEach(os => {
      const inicio = os.horario_parada ? new Date(os.horario_parada) : new Date(os.data_abertura);
      const fim = os.data_fechamento ? new Date(os.data_fechamento) : agoraRef;
      const duracao = Math.max(0, (fim.getTime() - inicio.getTime()) / 3600000);
      hIndispDM += duracao;
      if (os.foi_enviado_reserva && os.horario_parada && os.horas_reserva_chegou) {
        const p = new Date(os.horario_parada);
        const c = new Date(os.horas_reserva_chegou);
        hIndispDO += Math.max(0, (c.getTime() - p.getTime()) / 3600000);
      } else {
        hIndispDO += duracao;
      }
      if (os.status === "Fechada") fechadas++;
    });

    veiculos.push({
      placa,
      disponibilidade: Math.round(Math.max(0, Math.min(100, ((horasTotaisPorVeiculo - hIndispDM) / horasTotaisPorVeiculo) * 100)) * 10) / 10,
      disponibilidade_operacional: Math.round(Math.max(0, Math.min(100, ((horasTotaisPorVeiculo - hIndispDO) / horasTotaisPorVeiculo) * 100)) * 10) / 10,
      totalOS: osDoVeiculo.length,
      osFechadas: fechadas,
      horasManut: Math.round(hIndispDM * 10) / 10,
      horasOperacional: Math.round(hIndispDO * 10) / 10,
    });
  }

  const hIndispDMTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const hIndispDOTotal = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  const hTotalFrota = horasTotaisPorVeiculo * veiculos.length;

  const dm = hTotalFrota > 0 ? Math.round(((hTotalFrota - hIndispDMTotal) / hTotalFrota) * 1000) / 10 : 0;
  const doOp = hTotalFrota > 0 ? Math.round(((hTotalFrota - hIndispDOTotal) / hTotalFrota) * 1000) / 10 : 0;

  const MESES_NOME = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

  return {
    totalOS: allOS.length,
    emAndamento: allOS.filter(o => o.status === "Aberta").length,
    osFechadas: veiculos.reduce((acc, v) => acc + v.osFechadas, 0),
    disponibilidadeMedia: dm,
    dm,
    doOperacional: doOp,
    horasManutencao: Math.round(hIndispDMTotal * 10) / 10,
    mttr: veiculos.reduce((acc, v) => acc + v.osFechadas, 0) > 0 ? Math.round((hIndispDMTotal / veiculos.reduce((acc, v) => acc + v.osFechadas, 0)) * 10) / 10 : 0,
    mtbf: allOS.length > 0 ? Math.round(((hTotalFrota - hIndispDMTotal) / allOS.length) * 10) / 10 : 0,
    backlog: Math.round((allOS.filter(o => o.status === "Aberta").length * 8 / 8) * 10) / 10,
    totalEquipamentos: frotaAtiva.length,
    totalVeiculosAtivos: frotaAtiva.length,
    veiculos: veiculos.sort((a, b) => a.disponibilidade - b.disponibilidade),
    preventivas: [],
    docsValidos: 0, docsAVencer: 0, docsVencidos: 0,
    filtroOpcoes: {
      meses: MESES_NOME.slice(1).map((m, i) => ({ value: i + 1, label: m })),
      anos: [2024, 2025, 2026],
      categorias: Array.from(categoriasSet),
      placas: placasFiltradas.sort(),
      modulos: Array.from(modulosSet),
      statusList: Array.from(new Set(allOS.map(o => o.status || "")))
    },
    periodoLabel: filtros?.dataInicio && filtros?.dataFim 
      ? `${new Date(filtros.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} até ${new Date(filtros.dataFim + 'T12:00:00').toLocaleDateString('pt-BR')}`
      : `${MESES_NOME[mesFiltro]} ${anoFiltro}`,
    data_inicio: inicioFiltro,
    data_fim: fimFiltro.split("T")[0],
    dispSemanal: [],
    paradasPorCategoria: [],
    rankingFalhas: [],
    dispPorTipo: [],
    statusFrota: [],
    manutPorTipo: []
  };
}
