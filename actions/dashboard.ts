"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ─── Helper: get today in BR timezone ─────────────────────────────────────────
function hojeBR() {
  return new Date(Date.now() - 3 * 3600 * 1000);
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type VeiculoDisp = {
  placa: string;
  disponibilidade: number;
  totalOS: number;
  osFechadas: number;
  horasManut: number;
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

export type DispSemanal = { semana: string; disp: number };

export type DashboardData = {
  totalOS: number;
  emAndamento: number;
  osFechadas: number;
  disponibilidadeMedia: number;
  horasManutencao: number;
  mttr: number;
  mtbf: number;
  totalEquipamentos: number;
  veiculos: VeiculoDisp[];
  preventivas: PreventivaStatus[];
  docsValidos: number;
  docsAVencer: number;
  docsVencidos: number;
  filtroOpcoes: FiltroOpcoes;
  periodoLabel: string;
  dispSemanal: DispSemanal[];
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function getDashboardData(filtros?: {
  mes?: number;
  ano?: number;
  categoria?: string;
  placa?: string;
  modulo?: string;
  status?: string;
}): Promise<DashboardData> {
  const supabase = createClient();
  const hoje = hojeBR();

  // Determina período de filtro
  // mes=undefined → todos os meses | ano=undefined → todos os anos
  const mesAtual = hoje.getMonth() + 1;
  const anoAtual = hoje.getFullYear();

  const mesFiltro  = filtros?.mes  && filtros.mes  > 0 ? filtros.mes  : null;
  const anoFiltro  = filtros?.ano  && filtros.ano  > 0 ? filtros.ano  : null;

  // Cálculo de início / fim do intervalo de datas usado na query
  let inicioFiltro: string | null = null;
  let fimFiltro: string | null    = null;
  let diasTranscorridos: number;
  let diasNoMes: number; // usado na disponibilidade semanal (fallback = 31)

  const MESES_NOME = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  if (mesFiltro && anoFiltro) {
    // ── Mês + Ano específicos ──────────────────────────────────────────────────
    inicioFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-01`;
    const fimMesDate = new Date(anoFiltro, mesFiltro, 0);
    diasNoMes = fimMesDate.getDate();
    fimFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, "0")}-${String(diasNoMes).padStart(2, "0")}T23:59:59`;
    diasTranscorridos =
      mesFiltro === mesAtual && anoFiltro === anoAtual ? hoje.getDate() : diasNoMes;
  } else if (anoFiltro && !mesFiltro) {
    // ── Ano inteiro, sem mês ───────────────────────────────────────────────────
    inicioFiltro = `${anoFiltro}-01-01`;
    const isCurrentYear = anoFiltro === anoAtual;
    fimFiltro = isCurrentYear ? null : `${anoFiltro}-12-31T23:59:59`;
    const fim = isCurrentYear ? hoje : new Date(anoFiltro, 11, 31);
    diasTranscorridos = Math.floor(
      (fim.getTime() - new Date(anoFiltro, 0, 1).getTime()) / 86400000
    ) + 1;
    diasNoMes = 31;
  } else if (mesFiltro && !anoFiltro) {
    // ── Mês específico, todos os anos ─────────────────────────────────────────
    // Mostra todos os anos para o mês selecionado (sem corte de ano)
    inicioFiltro = null;
    fimFiltro = null;
    diasNoMes = new Date(anoAtual, mesFiltro, 0).getDate();
    diasTranscorridos = diasNoMes;
  } else {
    // ── Sem filtro: todos os registros ────────────────────────────────────────
    inicioFiltro = null;
    fimFiltro = null;
    diasNoMes = 31;
    // Usa todos os dias desde o começo do ano
    diasTranscorridos = Math.floor(
      (hoje.getTime() - new Date(anoAtual, 0, 1).getTime()) / 86400000
    ) + 1;
  }

  // Label legível do período selecionado
  const periodoLabel =
    mesFiltro && anoFiltro ? `${MESES_NOME[mesFiltro]} ${anoFiltro}` :
    anoFiltro ? `Ano ${anoFiltro}` :
    mesFiltro ? `${MESES_NOME[mesFiltro]} (todos os anos)` :
    "Todos os períodos";

  // ── 1. Buscar TODAS as OS do período ───────────────────────────────────────
  let osQuery = supabase
    .from("ordens_servico")
    .select("id, status, horas_manutencao, data_abertura, data_fechamento, equipamento_id, placa");

  if (inicioFiltro) osQuery = osQuery.gte("data_abertura", inicioFiltro);
  if (fimFiltro)    osQuery = osQuery.lte("data_abertura", fimFiltro);

  const { data: osPeriodo } = await osQuery;
  const allOS = osPeriodo ?? [];

  // ── 2. Buscar equipamentos do banco ────────────────────────────────────────
  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, placa, tipo, categoria, modulo");

  const totalEquipamentos = equipamentos?.length ?? 0;

  // Mapa de equipamento_id → placa (do banco de equipamentos)
  const eqMap = new Map<string, { placa: string; categoria?: string; modulo?: string }>();
  const categoriasSet = new Set<string>();
  const modulosSet = new Set<string>();
  equipamentos?.forEach((eq) => {
    if (eq.placa) eqMap.set(eq.id, { placa: eq.placa, categoria: eq.categoria, modulo: eq.modulo });
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.modulo) modulosSet.add(eq.modulo);
  });

  // ── 3. Construir mapa de placas reais das OS ──────────────────────────────
  // Usar a PLACA da OS diretamente (campo 'placa' da tabela ordens_servico)
  // Se a OS tem equipamento_id, buscar a placa do equipamento
  // Caso contrário, usar o campo placa da própria OS
  const placasComOS = new Set<string>();
  const osPorPlaca: Record<string, typeof allOS> = {};

  for (const os of allOS) {
    // Determinar a placa: primeiro do equipamento, depois do campo placa da OS
    let placa = "";
    if (os.equipamento_id && eqMap.has(os.equipamento_id)) {
      placa = eqMap.get(os.equipamento_id)!.placa;
    } else if (os.placa) {
      placa = os.placa;
    }
    if (!placa) continue;

    placa = placa.toUpperCase().trim();
    placasComOS.add(placa);

    if (!osPorPlaca[placa]) osPorPlaca[placa] = [];
    osPorPlaca[placa].push(os);
  }

  // ── 4. Construir lista de TODAS as placas da frota ──────────────────────────
  // Excluir placas de teste/fictícias que não devem aparecer no dashboard
  const placasBloqueadas = new Set(["QWE-5555", "QWE-5556", "XYZ-3876", "XYZ-9876", "ABC-1234"]);

  const todasPlacas = new Set<string>();
  equipamentos?.forEach((eq) => {
    if (eq.placa) {
      const p = eq.placa.toUpperCase().trim();
      if (!placasBloqueadas.has(p)) todasPlacas.add(p);
    }
  });
  // Adicionar placas das OS que possam não estar cadastradas
  placasComOS.forEach(p => {
    if (!placasBloqueadas.has(p)) todasPlacas.add(p);
  });

  // Aplicar filtros
  let placasFiltradas = Array.from(todasPlacas);

  if (filtros?.placa) {
    placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase());
  }

  if (filtros?.categoria || filtros?.modulo) {
    const eqFiltradas = new Set<string>();
    equipamentos?.forEach((eq) => {
      if (filtros?.categoria && eq.categoria?.toUpperCase() !== filtros.categoria.toUpperCase()) return;
      if (filtros?.modulo && eq.modulo?.toUpperCase() !== filtros.modulo.toUpperCase()) return;
      if (eq.placa) eqFiltradas.add(eq.placa.toUpperCase());
    });
    placasFiltradas = placasFiltradas.filter(p => eqFiltradas.has(p));
  }

  // ── 5. Calcular KPIs ──────────────────────────────────────────────────────
  const osFinal = allOS.filter((os) => {
    let placa = "";
    if (os.equipamento_id && eqMap.has(os.equipamento_id)) {
      placa = eqMap.get(os.equipamento_id)!.placa;
    } else if (os.placa) {
      placa = os.placa;
    }
    if (!placa) return false;
    placa = placa.toUpperCase().trim();
    if (filtros?.placa && placa !== filtros.placa.toUpperCase()) return false;
    if (filtros?.status && os.status !== filtros.status) return false;
    return placasFiltradas.includes(placa);
  });

  const totalOS = osFinal.length;
  const emAndamento = osFinal.filter((o) => o.status === "Aberta").length;
  const osFechadas = osFinal.filter((o) => o.status === "Fechada").length;
  const horasManutencao = osFinal.reduce(
    (acc, o) => acc + (Number(o.horas_manutencao) || 0), 0
  );

  // Status existentes
  const statusSet = new Set<string>();
  allOS.forEach((o) => { if (o.status) statusSet.add(o.status); });

  // ── 6. Disponibilidade por veículo (TODA A FROTA) ──────────────────────────
  // Fórmula: Disp = ((Horas Totais Período - Horas em Manutenção) / Horas Totais Período) * 100
  // Veículos SEM OS no período = 100%
  const horasTotaisPeriodo = diasTranscorridos * 24;
  const veiculos: VeiculoDisp[] = [];

  for (const placa of placasFiltradas) {
    const osDoVeiculo = osPorPlaca[placa] || [];

    if (osDoVeiculo.length === 0) {
      // Sem OS → 100% disponível
      veiculos.push({
        placa,
        disponibilidade: 100,
        totalOS: 0,
        osFechadas: 0,
        horasManut: 0,
      });
      continue;
    }

    // ── Fórmula PCM: H.Calendário = diasTranscorridos × 24
    // Horas Indisponíveis = soma das horas de manutenção de cada OS
    //   1º usa horas_manutencao declarado   (campo preenchido pelo usuário)
    //   2º usa data_fechamento - data_abertura  (cálculo real da duração)
    //   3º usa 0  (não assume valor se não há dado suficiente)
    let horasIndisp = 0;
    let totalOSVeiculo = osDoVeiculo.length;
    let fechadasVeiculo = 0;

    for (const os of osDoVeiculo) {
      const horasDeclaradas = Number(os.horas_manutencao) || 0;

      if (horasDeclaradas > 0) {
        // Campo declarado pelo usuário — usa diretamente
        horasIndisp += horasDeclaradas;
      } else if (os.data_abertura && os.data_fechamento) {
        // Calcula a duração real pela diferença de datas (sem cap artificioso)
        const abertura = new Date(os.data_abertura).getTime();
        const fechamento = new Date(os.data_fechamento).getTime();
        const diffHoras = Math.max(0, (fechamento - abertura) / (1000 * 60 * 60));
        horasIndisp += diffHoras;
      } else if (os.status === "Aberta" && os.data_abertura) {
        // OS ainda aberta: conta desde a abertura até agora
        const abertura = new Date(os.data_abertura).getTime();
        const agora = Date.now();
        const diffHoras = Math.max(0, (agora - abertura) / (1000 * 60 * 60));
        // Limita ao máximo do período para não ultrapassar 100% indisponível
        horasIndisp += Math.min(diffHoras, horasTotaisPeriodo);
      }
      // Se não há nenhum dado (horas=0, sem datas, status desconhecido) → soma 0

      if (os.status === "Fechada") fechadasVeiculo++;
    }

    // Limitar horasIndisp ao máximo do período (impossível ser > 100% indisponível)
    horasIndisp = Math.min(horasIndisp, horasTotaisPeriodo);

    const disp =
      horasTotaisPeriodo > 0
        ? Math.max(0, Math.min(100, ((horasTotaisPeriodo - horasIndisp) / horasTotaisPeriodo) * 100))
        : 100;

    veiculos.push({
      placa,
      disponibilidade: Math.round(disp * 10) / 10,
      totalOS: totalOSVeiculo,
      osFechadas: fechadasVeiculo,
      horasManut: Math.round(horasIndisp * 10) / 10,
    });
  }

  veiculos.sort((a, b) => a.disponibilidade - b.disponibilidade);

  // ── 7. Disponibilidade média e KPIs de manutenção ─────────────────────────
  // Média calculada sobre TODA a frota (veículos sem OS = 100%).
  // Isso é consistente com a fórmula padrão:
  //   Disponibilidade Frota = (Σ horas disponíveis) / (Σ horas totais período)
  const horasTotaisFrota = horasTotaisPeriodo * veiculos.length;
  const horasIndispFrota = veiculos.reduce((acc, v) => acc + v.horasManut, 0);
  const disponibilidadeMedia =
    horasTotaisFrota > 0
      ? Math.max(0, Math.min(100, ((horasTotaisFrota - horasIndispFrota) / horasTotaisFrota) * 100))
      : 0;

  // Horas totais de manutenção = soma de horasManut de TODOS os veículos (calculado real)
  const horasManutTotal = veiculos.reduce((acc, v) => acc + v.horasManut, 0);

  // MTTR = Tempo Médio de Reparo = total horas manutenção / nº de OS fechadas
  const totalOSFechadas = veiculos.reduce((acc, v) => acc + v.osFechadas, 0);
  const mttr = totalOSFechadas > 0
    ? Math.round((horasManutTotal / totalOSFechadas) * 10) / 10
    : 0;

  // MTBF = Tempo Médio Entre Falhas = (horas operação total) / nº de falhas
  // Horas operação = horas do período × nº veículos com OS - horas manutenção
  const veiculosComOS = veiculos.filter(v => v.totalOS > 0);
  const totalFalhas = veiculosComOS.reduce((acc, v) => acc + v.totalOS, 0);
  const horasOperacao = (horasTotaisPeriodo * veiculosComOS.length) - horasManutTotal;
  const mtbf = totalFalhas > 0
    ? Math.round((horasOperacao / totalFalhas) * 10) / 10
    : 0;

  // ── 8. Preventivas (filtradas pela mesma placa, se selecionada) ─────────────
  const { data: prevData } = await supabase
    .from("preventivas")
    .select("equipamento_id, ultimo_horimetro, horimetro_atual, intervalo_horas, equipamentos(placa)");

  const preventivas: PreventivaStatus[] = [];
  prevData?.forEach((p: any) => {
    const placa = p.equipamentos?.placa?.toUpperCase()?.trim();
    if (!placa) return;
    // Respeita filtro de placa selecionado
    if (filtros?.placa && placa !== filtros.placa.toUpperCase()) return;
    // Respeita filtro de categoria / módulo (só mostrar preventivas de placas da frota filtrada)
    if (!placasFiltradas.includes(placa)) return;

    const restantes =
      (Number(p.ultimo_horimetro) + Number(p.intervalo_horas)) -
      Number(p.horimetro_atual);
    let status: "atrasado" | "atencao" | "no_prazo";
    if (restantes < 0) status = "atrasado";
    else if (restantes <= 50) status = "atencao";
    else status = "no_prazo";
    preventivas.push({ placa, horas_restantes: restantes, status });
  });
  preventivas.sort((a, b) => a.horas_restantes - b.horas_restantes);

  // ── 9. Documentos ──────────────────────────────────────────────────────────
  const hojeStr = hoje.toISOString().split("T")[0];
  const em30dias = new Date(hoje);
  em30dias.setDate(hoje.getDate() + 30);
  const em30Str = em30dias.toISOString().split("T")[0];

  const { data: eqs } = await supabase
    .from("equipamentos")
    .select("laudo_validade, crlv_validade, implemento_validade, tacografo_validade, civ_validade");

  let docsValidos = 0;
  let docsAVencer = 0;
  let docsVencidos = 0;

  eqs?.forEach((eq) => {
    [eq.laudo_validade, eq.crlv_validade, eq.implemento_validade, eq.tacografo_validade, eq.civ_validade]
      .filter(Boolean)
      .forEach((val) => {
        if (val < hojeStr) docsVencidos++;
        else if (val <= em30Str) docsAVencer++;
        else docsValidos++;
      });
  });

  // ── 10. Disponibilidade por semana do período ──────────────────────────────
  // Divide o mês em semanas e calcula a disponibilidade de cada semana
  const dispSemanal: DispSemanal[] = [];
  const horasPorSemana = 7 * 24; // 168 h por semana
  const numVeiculos = placasFiltradas.length || 1;

  for (let semana = 1; semana <= 5; semana++) {
    const diaInicio = (semana - 1) * 7 + 1;
    const diaFim = Math.min(semana * 7, diasNoMes);
    if (diaInicio > diasNoMes) break;

    const anoSem = anoFiltro ?? anoAtual;
    const mesSem = mesFiltro ?? mesAtual;
    const inicioSem = new Date(anoSem, mesSem - 1, diaInicio);
    const fimSem = new Date(anoSem, mesSem - 1, diaFim, 23, 59, 59);

    // OS dos veículos filtrados nessa semana
    let horasIndispSem = 0;
    for (const os of osFinal) {
      const abertura = os.data_abertura ? new Date(os.data_abertura) : null;
      if (!abertura || abertura < inicioSem || abertura > fimSem) continue;
      const horas = Number(os.horas_manutencao) || 0;
      if (horas > 0) {
        horasIndispSem += horas;
      } else if (os.data_fechamento) {
        const diff = (new Date(os.data_fechamento).getTime() - abertura.getTime()) / 3600000;
        horasIndispSem += Math.max(0, diff);
      }
    }

    const diasSem = diaFim - diaInicio + 1;
    const horasTotaisSem = diasSem * 24 * numVeiculos;
    const horasIndispCapSem = Math.min(horasIndispSem, horasTotaisSem);
    const dispSem = horasTotaisSem > 0
      ? Math.max(0, Math.min(100, ((horasTotaisSem - horasIndispCapSem) / horasTotaisSem) * 100))
      : 100;

    dispSemanal.push({
      semana: `S${semana}`,
      disp: Math.round(dispSem * 10) / 10,
    });
  }

  // ── 11. Anos disponíveis ───────────────────────────────────────────────────
  const { data: allOSForYears } = await supabase
    .from("ordens_servico")
    .select("data_abertura");

  const anosSet = new Set<number>();
  anosSet.add(anoAtual);
  allOSForYears?.forEach((o) => {
    if (o.data_abertura) {
      const y = parseInt(o.data_abertura.slice(0, 4));
      if (!isNaN(y)) anosSet.add(y);
    }
  });

  // ── 11. Placas para filtro (TODA A FROTA) ───────────────────────────────────
  const placasFrota = Array.from(todasPlacas).sort();

  const filtroOpcoes: FiltroOpcoes = {
    meses: [
      { value: 1, label: "Janeiro" }, { value: 2, label: "Fevereiro" },
      { value: 3, label: "Março" }, { value: 4, label: "Abril" },
      { value: 5, label: "Maio" }, { value: 6, label: "Junho" },
      { value: 7, label: "Julho" }, { value: 8, label: "Agosto" },
      { value: 9, label: "Setembro" }, { value: 10, label: "Outubro" },
      { value: 11, label: "Novembro" }, { value: 12, label: "Dezembro" },
    ],
    anos: Array.from(anosSet).sort((a, b) => b - a),
    categorias: Array.from(categoriasSet).sort(),
    placas: placasFrota,
    modulos: Array.from(modulosSet).sort(),
    statusList: Array.from(statusSet).sort(),
  };

  return {
    totalOS,
    emAndamento,
    osFechadas,
    disponibilidadeMedia: Math.round(disponibilidadeMedia * 10) / 10,
    horasManutencao: Math.round(horasManutTotal * 10) / 10,
    mttr,
    mtbf,
    totalEquipamentos,
    veiculos,
    preventivas,
    docsValidos,
    docsAVencer,
    docsVencidos,
    filtroOpcoes,
    periodoLabel,
    dispSemanal,
  };
}
