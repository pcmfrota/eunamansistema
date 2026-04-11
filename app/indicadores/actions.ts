'use server'

import { createClient } from '@/utils/supabase/server'

export type IndicadorVeiculo = {
  placa: string
  categoria: string
  modulo: string
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
  placa?: string
}): Promise<IndicadoresData> {
  const supabase = createClient()
  const hoje = hojeBR()
  const mesAtual = hoje.getMonth() + 1
  const anoAtual = hoje.getFullYear()

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
    fimFiltro = `${anoFiltro}-${String(mesFiltro).padStart(2, '0')}-${String(diasNoMes).padStart(2, '0')}T23:59:59`
    diasTranscorridos = mesFiltro === mesAtual && anoFiltro === anoAtual ? hoje.getDate() : diasNoMes
  } else if (anoFiltro && !mesFiltro) {
    inicioFiltro = `${anoFiltro}-01-01`
    const isCurrentYear = anoFiltro === anoAtual
    fimFiltro = isCurrentYear ? null : `${anoFiltro}-12-31T23:59:59`
    const fim = isCurrentYear ? hoje : new Date(anoFiltro, 11, 31)
    diasTranscorridos = Math.floor((fim.getTime() - new Date(anoFiltro, 0, 1).getTime()) / 86400000) + 1
    diasNoMes = 31
  } else {
    inicioFiltro = null
    fimFiltro = null
    diasNoMes = 31
    diasTranscorridos = Math.floor((hoje.getTime() - new Date(anoAtual, 0, 1).getTime()) / 86400000) + 1
  }

  const periodoLabel =
    mesFiltro && anoFiltro ? `${MESES_NOME[mesFiltro]} ${anoFiltro}` :
    anoFiltro ? `Ano ${anoFiltro}` :
    mesFiltro ? `${MESES_NOME[mesFiltro]} (todos os anos)` :
    'Todos os períodos'

  const horasTotaisPeriodo = diasTranscorridos * 24

  // Buscar OS do período
  let osQuery = supabase
    .from('ordens_servico')
    .select('id, status, horas_manutencao, data_abertura, data_fechamento, equipamento_id, placa, classe')

  if (inicioFiltro) osQuery = osQuery.gte('data_abertura', inicioFiltro)
  if (fimFiltro) osQuery = osQuery.lte('data_abertura', fimFiltro)

  const { data: osPeriodo } = await osQuery
  const allOS = osPeriodo ?? []

  // Buscar equipamentos
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, tipo, categoria, modulo')

  const eqMap = new Map<string, { placa: string; categoria: string; modulo: string }>()
  const categoriasSet = new Set<string>()
  const todasPlacas = new Set<string>()

  equipamentos?.forEach((eq) => {
    if (eq.placa) {
      const p = eq.placa.toUpperCase().trim()
      if (!PLACAS_BLOQUEADAS.has(p)) {
        eqMap.set(eq.id, {
          placa: p,
          categoria: eq.categoria || '',
          modulo: eq.modulo || '',
        })
        todasPlacas.add(p)
        if (eq.categoria) categoriasSet.add(eq.categoria)
      }
    }
  })

  // Agrupar OS por placa
  const osPorPlaca: Record<string, typeof allOS> = {}
  for (const os of allOS) {
    let placa = ''
    if (os.equipamento_id && eqMap.has(os.equipamento_id)) {
      placa = eqMap.get(os.equipamento_id)!.placa
    } else if (os.placa) {
      placa = os.placa.toUpperCase().trim()
    }
    if (!placa || PLACAS_BLOQUEADAS.has(placa)) continue
    if (!osPorPlaca[placa]) osPorPlaca[placa] = []
    osPorPlaca[placa].push(os)
    todasPlacas.add(placa)
  }

  // Mapa placa → info do equipamento
  const placaInfoMap = new Map<string, { categoria: string; modulo: string }>()
  equipamentos?.forEach((eq) => {
    if (eq.placa) {
      const p = eq.placa.toUpperCase().trim()
      placaInfoMap.set(p, { categoria: eq.categoria || '', modulo: eq.modulo || '' })
    }
  })

  // Filtrar placas
  let placasFiltradas = Array.from(todasPlacas)
  if (filtros?.placa) {
    placasFiltradas = placasFiltradas.filter(p => p === filtros.placa!.toUpperCase())
  }
  if (filtros?.categoria) {
    placasFiltradas = placasFiltradas.filter(p => {
      const info = placaInfoMap.get(p)
      return info?.categoria?.toUpperCase() === filtros.categoria!.toUpperCase()
    })
  }

  // Calcular indicadores por veículo
  const veiculos: IndicadorVeiculo[] = []

  for (const placa of placasFiltradas) {
    const osDoVeiculo = osPorPlaca[placa] || []
    const info = placaInfoMap.get(placa) ?? { categoria: '', modulo: '' }

    // ── Cálculo de horas de manutenção (corretiva + preventiva = DM)
    let horasManutTotalDM = 0
    // ── Para DO: horas de paradas operacionais (exclui operação)
    // Como não temos campo de parada operacional, usamos o mesmo conceito:
    // DO = tempo disponível para operar = total - manutenção (simplificação consistente com o sistema)
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
        horasOS = Math.max(0, (Date.now() - ab) / 3600000)
        horasOS = Math.min(horasOS, horasTotaisPeriodo)
      }

      horasManutTotalDM += horasOS
      if (os.status === 'Fechada') osFechadasV++
      if (os.status === 'Aberta') osAbertas++
    }

    horasManutTotalDM = Math.min(horasManutTotalDM, horasTotaisPeriodo)

    // DM = (TotalHoras - HorasManut) / TotalHoras * 100
    const dm = horasTotaisPeriodo > 0
      ? Math.max(0, Math.min(100, ((horasTotaisPeriodo - horasManutTotalDM) / horasTotaisPeriodo) * 100))
      : 100

    // DO = HorasOperacionais / TotalHoras * 100
    // HorasOperacionais = TotalHoras - HorasManut (paradas operacionais não rastreadas separadamente)
    const horasOp = Math.max(0, horasTotaisPeriodo - horasManutTotalDM)
    const do_ = horasTotaisPeriodo > 0
      ? Math.max(0, Math.min(100, (horasOp / horasTotaisPeriodo) * 100))
      : 100

    veiculos.push({
      placa,
      categoria: info.categoria,
      modulo: info.modulo,
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

  // Anos disponíveis
  const { data: allOSYears } = await supabase.from('ordens_servico').select('data_abertura')
  const anosSet = new Set<number>([anoAtual])
  allOSYears?.forEach((o) => {
    if (o.data_abertura) {
      const y = parseInt(o.data_abertura.slice(0, 4))
      if (!isNaN(y)) anosSet.add(y)
    }
  })

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
