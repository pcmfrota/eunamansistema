"use server";

import { createClient } from "@/utils/supabase/server";

// ─── Helper: get today in BR timezone ─────────────────────────────────────────
function hojeBR() {
  return new Date(Date.now() - 3 * 3600 * 1000);
}

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

export type DispSemanal = { semana: string; disp: number };

export type ParadaCategoria = { categoria: string; quantidade: number };
export type RankFalha = { placa: string; falhas: number; mtbf: number };
export type DispTipo = { tipo: string; disponibilidade: number; total: number };
export type StatusFrotaItem = { placa: string; tipo: string; status: string; disponibilidade: number; modulo: string };
export type ManutTipo = { tipo: string; quantidade: number };

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
  veiculos: VeiculoDisp[];
  preventivas: PreventivaStatus[];
  docsValidos: number;
  docsAVencer: number;
  docsVencidos: number;
  filtroOpcoes: FiltroOpcoes;
  periodoLabel: string;
  dispSemanal: DispSemanal[];
  paradasPorCategoria: ParadaCategoria[];
  rankingFalhas: RankFalha[];
  dispPorTipo: DispTipo[];
  statusFrota: StatusFrotaItem[];
  manutPorTipo: ManutTipo[];
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
    
    // MÊS FECHADO PCM: Usa a quantidade bruta de dias do mês ao invés de limitar os dias transcorridos apenas até o dia atual
    diasTranscorridos = diasNoMes;
  } else if (anoFiltro && !mesFiltro) {
    // ── Ano inteiro, sem mês ───────────────────────────────────────────────────
    inicioFiltro = `${anoFiltro}-01-01`;
    fimFiltro = `${anoFiltro}-12-31T23:59:59`;
    
    // ANO FECHADO PCM: O ano sempre terá o calendário cheio nas horas totais
    const isBissexto = (anoFiltro % 4 === 0 && (anoFiltro % 100 !== 0 || anoFiltro % 400 === 0));
    diasTranscorridos = isBissexto ? 366 : 365;
    diasNoMes = 31;
  } else if (mesFiltro && !anoFiltro) {
    // ── Mês específico, todos os anos ─────────────────────────────────────────
    // Mostra todos os anos para o mês selecionado (sem corte de ano)
    inicioFiltro = null;
    fimFiltro = null;
    diasNoMes = new Date(anoAtual, mesFiltro, 0).getDate();
    diasTranscorridos = diasNoMes;
  } else {
    // ── Sem filtro: usa o Ano Atual como fechado ──────────────────────────────
    inicioFiltro = null;
    fimFiltro = null;
    diasNoMes = 31;
    // PCM ANO FECHADO (padrão quando sem filtros)
    const isBissexto = (anoAtual % 4 === 0 && (anoAtual % 100 !== 0 || anoAtual % 400 === 0));
    diasTranscorridos = isBissexto ? 366 : 365;
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
    .select("id, status, horas_manutencao, data_abertura, data_fechamento, equipamento_id, placa, classe, foi_enviado_reserva, horario_parada, horas_reserva_chegou");

  if (inicioFiltro) osQuery = osQuery.gte("data_abertura", inicioFiltro);
  if (fimFiltro)    osQuery = osQuery.lte("data_abertura", fimFiltro);

  const { data: osPeriodo } = await osQuery;
  const allOS = osPeriodo ?? [];

  // ── 2. Buscar equipamentos do banco ────────────────────────────────────────
  const { data: equipamentos } = await supabase
    .from("equipamentos")
    .select("id, placa, tipo, categoria, modulo, laudo_validade, crlv_validade, implemento_validade, tacografo_validade, civ_validade");

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
        disponibilidade_operacional: 100,
        totalOS: 0,
        osFechadas: 0,
        horasManut: 0,
        horasOperacional: 0,
      });
      continue;
    }

    // ── Fórmula PCM: H.Calendário = diasTranscorridos × 24
    // Horas Indisponíveis = soma das horas de manutenção de cada OS
    //   1º usa horas_manutencao declarado   (campo preenchido pelo usuário)
    //   2º usa data_fechamento - data_abertura  (cálculo real da duração)
    //   3º usa 0  (não assume valor se não há dado suficiente)
    let horasIndisp = 0;
    let horasIndispOp = 0;
    let totalOSVeiculo = osDoVeiculo.length;
    let fechadasVeiculo = 0;

    for (const os of osDoVeiculo) {
      const horasDeclaradas = Number(os.horas_manutencao) || 0;
      let currentMec = 0;

      if (horasDeclaradas > 0) {
        // Campo declarado pelo usuário — usa diretamente
        currentMec = horasDeclaradas;
      } else if (os.data_abertura && os.data_fechamento) {
        // Calcula a duração real pela diferença de datas (sem cap artificioso)
        const abertura = new Date(os.data_abertura).getTime();
        const fechamento = new Date(os.data_fechamento).getTime();
        currentMec = Math.max(0, (fechamento - abertura) / (1000 * 60 * 60));
      } else if (os.status === "Aberta" && os.data_abertura) {
        // OS ainda aberta: conta desde a abertura até agora
        const abertura = new Date(os.data_abertura).getTime();
        const agora = Date.now();
        currentMec = Math.max(0, (agora - abertura) / (1000 * 60 * 60));
        // Limita ao máximo do período para não ultrapassar 100% indisponível
        currentMec = Math.min(currentMec, horasTotaisPeriodo);
      }
      
      horasIndisp += currentMec;

      // Cálculo Operacional (Caminhão Reserva)
      let currentOp = currentMec; // Por padrão, impacto operacional = mecânico

      if (os.foi_enviado_reserva && os.horario_parada) {
        const parada = new Date(os.horario_parada).getTime();
        if (os.horas_reserva_chegou) {
          const reserva = new Date(os.horas_reserva_chegou).getTime();
          currentOp = Math.max(0, (reserva - parada) / (1000 * 60 * 60));
        } else if (os.status === "Aberta") {
          const agora = Date.now();
          currentOp = Math.max(0, (agora - parada) / (1000 * 60 * 60));
        }
      }

      horasIndispOp += currentOp;

      if (os.status === "Fechada") fechadasVeiculo++;
    }

    // Limitar ao máximo do período (impossível ser > 100% indisponível)
    horasIndisp = Math.min(horasIndisp, horasTotaisPeriodo);
    horasIndispOp = Math.min(horasIndispOp, horasTotaisPeriodo);

    const disp =
      horasTotaisPeriodo > 0
        ? Math.max(0, Math.min(100, ((horasTotaisPeriodo - horasIndisp) / horasTotaisPeriodo) * 100))
        : 100;

    const dispOp =
      horasTotaisPeriodo > 0
        ? Math.max(0, Math.min(100, ((horasTotaisPeriodo - horasIndispOp) / horasTotaisPeriodo) * 100))
        : 100;

    veiculos.push({
      placa,
      disponibilidade: Math.round(disp * 10) / 10,
      disponibilidade_operacional: Math.round(dispOp * 10) / 10,
      totalOS: totalOSVeiculo,
      osFechadas: fechadasVeiculo,
      horasManut: Math.round(horasIndisp * 10) / 10,
      horasOperacional: Math.round(horasIndispOp * 10) / 10,
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

  // ── 9. Documentos (Usa os dados já buscados anteriormente) ─────────────────
  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const hojeSaoPaulo = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const em30dias = new Date(hojeSaoPaulo);
  em30dias.setDate(em30dias.getDate() + 30);
  const em30Str = em30dias.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  let docsValidos = 0;
  let docsAVencer = 0;
  let docsVencidos = 0;

  equipamentos?.forEach((eq) => {
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

  // ── 12. NOVOS KPIs ──────────────────────────────────────────────────────────

  // DM = (HT - HM) / HT × 100  (Disponibilidade Mecânica)
  const dm = horasTotaisFrota > 0
    ? Math.round(((horasTotaisFrota - horasIndispFrota) / horasTotaisFrota) * 1000) / 10
    : 0;

  // DO = (HT - HO) / HT * 100 (Disponibilidade Operacional Real baseada no PCM)
  const horasIndispOpFrota = veiculos.reduce((acc, v) => acc + v.horasOperacional, 0);
  const doOperacional = horasTotaisFrota > 0
    ? Math.round(((horasTotaisFrota - horasIndispOpFrota) / horasTotaisFrota) * 1000) / 10
    : 0;

  // Backlog = Horas pendentes (OS abertas) / Capacidade (8h/dia × equipe estimada)
  const horasPendentes = osFinal
    .filter(o => o.status === "Aberta")
    .reduce((acc, o) => acc + (Number(o.horas_manutencao) || 8), 0);
  const capacidadeDiaria = 8; // 8h/dia por mecânico
  const backlog = Math.round((horasPendentes / capacidadeDiaria) * 10) / 10;

  // Paradas por Categoria (agrupa OS por classe)
  const paradasMap: Record<string, number> = {};
  osFinal.forEach(os => {
    const classe = (os as any).classe || "Outros";
    paradasMap[classe] = (paradasMap[classe] || 0) + 1;
  });
  const paradasPorCategoria = Object.entries(paradasMap)
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Ranking de Falhas (top 10 equipamentos com mais OS)
  const rankingFalhas = veiculos
    .filter(v => v.totalOS > 0)
    .map(v => ({
      placa: v.placa,
      falhas: v.totalOS,
      mtbf: v.osFechadas > 0
        ? Math.round(((horasTotaisPeriodo - v.horasManut) / v.totalOS) * 10) / 10
        : 0,
    }))
    .sort((a, b) => b.falhas - a.falhas)
    .slice(0, 10);

  // Manutenção por Tipo (Preventiva, Corretiva, etc.)
  const manutTipoMap: Record<string, number> = {};
  osFinal.forEach(os => {
    const tipo = (os as any).classe || "Outros";
    manutTipoMap[tipo] = (manutTipoMap[tipo] || 0) + 1;
  });
  const manutPorTipo = Object.entries(manutTipoMap)
    .map(([tipo, quantidade]) => ({ tipo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  // Disponibilidade por Tipo de Equipamento
  const tipoMap: Record<string, { somaDisp: number; count: number }> = {};
  veiculos.forEach(v => {
    const eq = equipamentos?.find(e => e.placa?.toUpperCase() === v.placa);
    const tipo = eq?.tipo || "OUTROS";
    if (!tipoMap[tipo]) tipoMap[tipo] = { somaDisp: 0, count: 0 };
    tipoMap[tipo].somaDisp += v.disponibilidade;
    tipoMap[tipo].count += 1;
  });
  const dispPorTipo = Object.entries(tipoMap)
    .map(([tipo, d]) => ({
      tipo,
      disponibilidade: Math.round((d.somaDisp / d.count) * 10) / 10,
      total: d.count,
    }))
    .sort((a, b) => a.disponibilidade - b.disponibilidade);

  // Status da Frota (tabela dinâmica)
  const statusFrota = veiculos.map(v => {
    const eq = equipamentos?.find(e => e.placa?.toUpperCase() === v.placa);
    const osAbertas = (osPorPlaca[v.placa] || []).filter(o => o.status === "Aberta").length;
    let status = "Disponível";
    if (osAbertas > 0) status = "Manutenção";
    else if (v.disponibilidade >= 95) status = "Disponível";
    else if (v.disponibilidade >= 90) status = "Atenção";
    else status = "Crítico";
    return {
      placa: v.placa,
      tipo: eq?.tipo || "—",
      status,
      disponibilidade: v.disponibilidade,
      modulo: eq?.modulo || "—",
    };
  }).sort((a, b) => a.disponibilidade - b.disponibilidade);

  return {
    totalOS,
    emAndamento,
    osFechadas,
    disponibilidadeMedia: Math.round(disponibilidadeMedia * 10) / 10,
    dm,
    doOperacional,
    horasManutencao: Math.round(horasManutTotal * 10) / 10,
    mttr,
    mtbf,
    backlog,
    totalEquipamentos,
    veiculos,
    preventivas,
    docsValidos,
    docsAVencer,
    docsVencidos,
    filtroOpcoes,
    periodoLabel,
    dispSemanal,
    paradasPorCategoria,
    rankingFalhas,
    dispPorTipo,
    statusFrota,
    manutPorTipo,
  };
}
