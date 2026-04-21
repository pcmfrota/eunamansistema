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
  horas_impacto_do?: number // Novo campo calculado
}

export async function buscarOSporPlaca(
  placa: string,
  mes?: number,
  ano?: number,
  dataInicio?: string,
  dataFim?: string
): Promise<OrdemServicoResumo[]> {
  const supabase = createClient()

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
      fim = `${cal.data_fim}T23:59:59`
    } else {
      // Fallback: mês civil
      inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
      const lastDay = new Date(ano, mes, 0).getDate()
      fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}T23:59:59`
    }
  } else {
    // Sem filtro de data — retorna tudo
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo, horas_reserva_chegou')
      .eq('placa', placa.toUpperCase())
      .order('data_abertura', { ascending: false })
      .limit(50)
    if (error) return []
    return (data || []) as OrdemServicoResumo[]
  }

  // OS que tocam o período:
  // - Abertas até o fim do período (data_abertura ou horario_parada), E
  // - Ainda não fechadas OU fechadas após o início do período
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo, horario_parada, horas_reserva_chegou')
    .eq('placa', placa.toUpperCase())
    .or(`data_abertura.lte.${fim},horario_parada.lte.${fim}`)
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`)
    .order('data_abertura', { ascending: false })
    .limit(100)

  if (error) return []

  // --- Coleta de Dados do Veículo e Escala ---
  // Otimizado: Busca escala e equipamento em uma única chamada
  const { data: equipInfo } = await supabase
    .from('equipamentos')
    .select(`
      id_escala,
      escalas_trabalho:id_escala (
        periodo_inicio,
        periodo_fim,
        carga_horaria
      )
    `)
    .eq('placa', placa.toUpperCase())
    .single();

  const escala = equipInfo?.escalas_trabalho as any;

  const osCalculadas = (data || []).map((os: any) => {
    let hImpactoDO = 0
      const osStart = new Date(os.horario_parada || os.data_abertura).getTime()
      const endMec = os.data_fechamento ? new Date(os.data_fechamento).getTime() : new Date().getTime()
      
      // Lógica PCM: Impacto Operacional encerra na chegada do reserva ou fim do conserto
      let osEndDO = endMec
      if (os.horas_reserva_chegou) {
        const reservaTime = new Date(os.horas_reserva_chegou).getTime()
        if (reservaTime > osStart && reservaTime < endMec) {
          osEndDO = reservaTime
        }
      }

      // Fallback para horas de manutenção se estiver zerado/nulo
      let hMecCalculada = os.horas_manutencao || (endMec - osStart) / 3600000

      if (escala && (os.data_abertura || os.horario_parada)) {
        const dIni = new Date(osStart)
        const dFim = new Date(osEndDO)
      
      for (let day = new Date(dIni.getFullYear(), dIni.getMonth(), dIni.getDate()); day <= dFim; day.setDate(day.getDate() + 1)) {
        const dStr = day.toISOString().split('T')[0]
        let shiftStart = new Date(`${dStr}T${escala.periodo_inicio}`).getTime()
        let shiftEnd = new Date(`${dStr}T${escala.periodo_fim}`).getTime()
        if (shiftEnd <= shiftStart) shiftEnd += 86400000

        const interInicio = Math.max(osStart, shiftStart)
        const interFim = Math.min(osEndDO, shiftEnd)
        if (interInicio < interFim) {
          hImpactoDO += (interFim - interInicio) / 3600000
        }
      }
    }
    return {
      ...os,
      horas_manutencao: Math.round(hMecCalculada * 10) / 10,
      horas_impacto_do: Math.round(hImpactoDO * 10) / 10
    }
  })

  return osCalculadas as OrdemServicoResumo[]
}
