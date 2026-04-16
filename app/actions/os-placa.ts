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
    // Usa o período Suzano exato
    inicio = dataInicio
    fim = dataFim.includes('T') ? dataFim : `${dataFim}T23:59:59`
  } else if (mes && ano) {
    // Fallback: mês civil
    inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const lastDay = new Date(ano, mes, 0).getDate()
    fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}T23:59:59`
  } else {
    // Sem filtro de data — retorna tudo
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo')
      .eq('placa', placa.toUpperCase())
      .order('data_abertura', { ascending: false })
      .limit(50)
    if (error) return []
    return (data || []) as OrdemServicoResumo[]
  }

  // OS que tocam o período:
  // - Abertas dentro do período, OU
  // - Fechadas dentro do período, OU
  // - Abertas antes do período e ainda abertas (sem fechamento)
  const { data, error } = await supabase
    .from('ordens_servico')
    .select('id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo')
    .eq('placa', placa.toUpperCase())
    .lte('data_abertura', fim)          // Abertura antes ou dentro do fim do período
    .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`)  // Ainda aberta OU fechada depois do início
    .order('data_abertura', { ascending: false })
    .limit(100)

  if (error) return []
  return (data || []) as OrdemServicoResumo[]
}
