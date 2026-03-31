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
  ano?: number
): Promise<OrdemServicoResumo[]> {
  const supabase = createClient()

  let query = supabase
    .from('ordens_servico')
    .select(
      'id, numero_os, status, classe, data_abertura, data_fechamento, descricao, sistema, sub_sistema, horas_manutencao, motivo, local, modulo'
    )
    .eq('placa', placa.toUpperCase())
    .order('data_abertura', { ascending: false })

  if (mes && ano) {
    const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
    const lastDay = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`
    query = query.gte('data_abertura', inicio).lte('data_abertura', fim)
  }

  const { data, error } = await query.limit(100)
  if (error) return []
  return (data || []) as OrdemServicoResumo[]
}
