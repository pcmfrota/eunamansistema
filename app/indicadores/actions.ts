'use server'

import { createClient } from '@/utils/supabase/server'

export type IndicadorVeiculo = {
  placa: string
  categoria: string
  modulo: string
  area: string
  // DM: Disponibilidade Mecânica
  dm: number          // %
  dmHorasTotal: number
  dmHorasManut: number
  // DO: Disponibilidade Operacional
  do_: number         // % (do é palavra reservada)
  doHorasOp: number
  doHorasTotal: number
  // outros
  totalOS: number
  osFechadas: number
  osAbertas: number
}

export type IndicadoresData = {
  veiculos: IndicadorVeiculo[]
  dmMedia: number
  doMedia: number
  periodoLabel: string
  diasTranscorridos: number
  horasTotaisPeriodo: number
  filtroOpcoes: {
    meses: { value: number; label: string }[]
    anos: number[]
    categorias: string[]
    placas: string[]
    areas: string[]
  }
}

function hojeBR() {
  return new Date(Date.now() - 3 * 3600 * 1000)
}

const MESES_NOME = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Placas fictícias/teste
const PLACAS_BLOQUEADAS = new Set(['QWE-5555', 'QWE-5556', 'XYZ-3876', 'XYZ-9876', 'ABC-1234'])

export async function getIndicadoresData(filtros?: {
  mes?: number
  ano?: number
  categoria?: string
  area?: string
  placa?: string
}): Promise<IndicadoresData> {
  const supabase = createClient()
  
  // Regra D-1: Hoje é D0, Ontem é D-1
  const agora = new Date()
  const ontem = new Date(agora)
  ontem.setDate(ontem.getDate() - 1)
  ontem.setHours(23, 59, 59, 999)

  const mesAtual = agora.getMonth() + 1
  const anoAtual = agora.getFullYear()

  const mesFiltro = filtros?.mes && filtros.mes > 0 ? filtros.mes : null
  const anoFiltro = filtros?.ano && filtros.ano > 0 ? filtros.ano : null

  let inicioFiltro: string | null = null
  let fimFiltro: string | null = null
  let diasTranscorridos: number
  let diasNoMes: number

  if (mesFiltro && anoFiltro) {
    inicioFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}-01`
    const fimMesDate = new Date(anoFiltro, mesFiltro, 0)
    diasNoMes = fimMesDate.getDate()
    
    // Se for o mês atual, conta apenas até ontem
    if (mesFiltro === mesAtual && anoFiltro === anoAtual) {
      diasTranscorridos = Math.max(0, ontem.getDate())
      fimFiltro = ontem.toISOString()
    } else {
      diasTranscorridos = diasNoMes
      fimFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}T23:59:59`
    }
  } else if (anoFiltro && !mesFiltro) {
    inicioFiltro = `${anoFiltro}-01-01`
    const isCurrentYear = anoFiltro === anoAtual
    const dInicioAno = new Date(anoFiltro, 0, 1)
    
    if (isCurrentYear) {
      fimFiltro = ontem.toISOString()
      diasTranscorridos = Math.max(0, Math.floor((ontem.getTime() - dInicioAno.getTime()) / 86400000) + 1)
    } else {
      fimFiltro = `${anoFiltro}-12-31T23:59:59`
      diasTranscorridos = 365 // simplificação, ou calculo exato se bissexto
      const dFimAno = new Date(anoFiltro, 11, 31)
      diasTranscorridos = Math.floor((dFimAno.getTime() - dInicioAno.getTime()) / 86400000) + 1
    }
    diasNoMes = 31
  } else {
    // Default: ano atual até ontem
    inicioFiltro = `${anoAtual}-01-01`
    fimFiltro = ontem.toISOString()
    const dInicioAno = new Date(anoAtual, 0, 1)
    diasTranscorridos = Math.max(0, Math.floor((ontem.getTime() - dInicioAno.getTime()) / 86400000) + 1)
    diasNoMes = 31
  }

  const periodoLabel =
    mesFiltro && anoFiltro ? `${MESES_NOME[mesFiltro]} ${anoFiltro}` :
    anoFiltro ? `Ano ${anoFiltro}` :
    'Todos os períodos'

  const horasTotaisPeriodo = diasTranscorridos * 24

  // ─── BUSCA PARALELA OTIMIZADA ───
  const [osRes, eqRes, yearsRes] = await Promise.all([
    supabase.from('ordens_servico').select('id, status, horas_manutencao, data_abertura, data_fechamento, equipamento_id, placa, classe')
      .or(`data_abertura.lte.${fimFiltro},data_fechamento.is.null,data_fechamento.gte.${inicioFiltro}`),
    supabase.from('equipamentos').select('id, placa, tipo, categoria, modulo, area, status, created_at'),
    supabase.from('ordens_servico').select('data_abertura')
  ]);

  const allOS = osRes.data ?? [];
  const todosEquipamentos = eqRes.data ?? [];
  const allOSYears = yearsRes.data ?? [];

  const eqMap = new Map();
  const placaInfoMap = new Map();
  const categoriasSet = new Set<string>();
  const areasSet = new Set<string>();
  const todasPlacas = new Set<string>();

  const fimFiltroTimestamp = new Date(fimFiltro!).getTime();

  todosEquipamentos.forEach((eq) => {
    if (!eq.placa) return;
    const p = eq.placa.toUpperCase().trim();
    if (PLACAS_BLOQUEADAS.has(p)) return;

    // REGRA DE VISIBILIDADE:
    // 1. Não mostrar se foi cadastrado DEPOIS do fim do mês do filtro
    const createdAt = eq.created_at ? new Date(eq.created_at).getTime() : 0;
    const fimMesFiltro = new Date(anoFiltro!, mesFiltro!, 0, 23, 59, 59).getTime();
    if (createdAt > fimMesFiltro) return;

    eqMap.set(eq.id, { ...eq, placa: p });
    placaInfoMap.set(p, eq);
    todasPlacas.add(p);
    if (eq.categoria) categoriasSet.add(eq.categoria);
    if (eq.area) areasSet.add(eq.area);
  });

  // 2. Agrupar OS por placa
  const osPorPlaca: Record<string, typeof allOS> = {};
  allOS.forEach(os => {
    let p = os.placa?.toUpperCase().trim();
    if (!p && os.equipamento_id) p = eqMap.get(os.equipamento_id)?.placa;
    if (!p || PLACAS_BLOQUEADAS.has(p)) return;
    if (!osPorPlaca[p]) osPorPlaca[p] = [];
    osPorPlaca[p].push(os);
  });

  // 3. Filtro de Placas e Status Inativo
  let placasFiltradas = Array.from(todasPlacas).filter(p => {
    const eq = placaInfoMap.get(p);
    const isCurrentlyInactive = String(eq?.status || '').toUpperCase().trim() === "INATIVO";
    const hadActivity = !!osPorPlaca[p];

    // Se está inativo e não teve atividade no período, oculta (atende ao pedido do usuário)
    if (isCurrentlyInactive && !hadActivity) return false;

    if (filtros?.placa && p !== filtros.placa.toUpperCase().trim()) return false;
    if (filtros?.categoria && (eq?.categoria || "").toUpperCase().trim() !== filtros.categoria.toUpperCase().trim()) return false;
    if (filtros?.area && (eq?.area || "").toUpperCase().trim() !== filtros.area.toUpperCase().trim()) return false;
    
    return true;
  });

  // Calcular indicadores por veículo
  const veiculos: IndicadorVeiculo[] = []

  for (const placa of placasFiltradas) {
    const osDoVeiculo = osPorPlaca[placa] || []
    const info = placaInfoMap.get(placa) ?? { categoria: '', modulo: '', area: '' }

    let horasManutTotalDM = 0
    let osAbertas = 0
    let osFechadasV = 0

    for (const os of osDoVeiculo) {
      const horasDecl = Number(os.horas_manutencao) || 0
      let horasOS = 0

      if (horasDecl > 0) {
        horasOS = horasDecl
      } else if (os.data_abertura && os.data_fechamento) {
        const ab = new Date(os.data_abertura).getTime()
        const fe = new Date(os.data_fechamento).getTime()
        horasOS = Math.max(0, (fe - ab) / 3600000)
      } else if (os.status === 'Aberta' && os.data_abertura) {
        const ab = new Date(os.data_abertura).getTime()
        // Regra D-1: se aberta, conta apenas até ontem
        horasOS = Math.max(0, (ontem.getTime() - ab) / 3600000)
      }

      horasManutTotalDM += horasOS
      if (os.status === 'Fechada') osFechadasV++
      if (os.status === 'Aberta') osAbertas++
    }

    horasManutTotalDM = Math.min(horasManutTotalDM, horasTotaisPeriodo)

    const dm = horasTotaisPeriodo > 0
      ? Math.max(0, Math.min(100, ((horasTotaisPeriodo - horasManutTotalDM) / horasTotaisPeriodo) * 100))
      : 100

    const horasOp = Math.max(0, horasTotaisPeriodo - horasManutTotalDM)
    const do_ = horasTotaisPeriodo > 0
      ? Math.max(0, Math.min(100, (horasOp / horasTotaisPeriodo) * 100))
      : 100

    veiculos.push({
      placa,
      categoria: info.categoria,
      modulo: info.modulo,
      area: info.area || 'SEM ÁREA',
      dm: Math.round(dm * 10) / 10,
      dmHorasTotal: horasTotaisPeriodo,
      dmHorasManut: Math.round(horasManutTotalDM * 10) / 10,
      do_: Math.round(do_ * 10) / 10,
      doHorasOp: Math.round(horasOp * 10) / 10,
      doHorasTotal: horasTotaisPeriodo,
      totalOS: osDoVeiculo.length,
      osFechadas: osFechadasV,
      osAbertas,
    })
  }

  veiculos.sort((a, b) => a.dm - b.dm)

  // Médias gerais (ponderadas pela frota)
  const horasTotaisFrota = horasTotaisPeriodo * veiculos.length
  const horasManutFrota = veiculos.reduce((acc, v) => acc + v.dmHorasManut, 0)
  const dmMedia = horasTotaisFrota > 0
    ? Math.round(Math.max(0, Math.min(100, ((horasTotaisFrota - horasManutFrota) / horasTotaisFrota) * 100)) * 10) / 10
    : 100
  const horasOpFrota = veiculos.reduce((acc, v) => acc + v.doHorasOp, 0)
  const doMedia = horasTotaisFrota > 0
    ? Math.round(Math.max(0, Math.min(100, (horasOpFrota / horasTotaisFrota) * 100)) * 10) / 10
    : 100

  // Médias e Filtros já foram carregados no Promise.all
  const anosSet = new Set<number>([anoAtual]);
  allOSYears?.forEach((o: any) => {
    if (o.data_abertura) {
      const y = parseInt(o.data_abertura.slice(0, 4));
      if (!isNaN(y)) anosSet.add(y);
    }
  });

  const filtroOpcoes = {
    meses: [
      { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' },
      { value: 3, label: 'Março' }, { value: 4, label: 'Abril' },
      { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
      { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' },
      { value: 9, label: 'Setembro' }, { value: 10, label: 'Outubro' },
      { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
    ],
    anos: Array.from(anosSet).sort((a, b) => b - a),
    categorias: Array.from(categoriasSet).sort(),
    placas: Array.from(todasPlacas).sort(),
    areas: Array.from(new Set(["COLHEITA", "CARREGAMENTO", "BASE", ...areasSet])).sort(),
  }

  return {
    veiculos,
    dmMedia,
    doMedia,
    periodoLabel,
    diasTranscorridos,
    horasTotaisPeriodo,
    filtroOpcoes,
  }
}
