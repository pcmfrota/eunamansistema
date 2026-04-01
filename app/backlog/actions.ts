'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getBacklog(limit: number = 100) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('backlog')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) return { error: error.message }
  return { data }
}

export async function upsertBacklogItem(item: any) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('backlog')
    .upsert([item])
    .select()

  if (error) return { error: error.message }
  revalidatePath('/backlog')
  return { success: true, data }
}

export async function deleteBacklogItems(ids: string[]) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('backlog')
    .delete()
    .in('id', ids)

  if (error) return { error: error.message }
  revalidatePath('/backlog')
  return { success: true }
}

export async function importarBacklog(rows: any[]) {
  const supabase = await createClient()
  
  // Transform and normalize rows if needed
  const items = rows.map(r => ({
    semana: r.semana || r.Semana,
    mes: r.mes || r.Mês || r.Mes,
    ano: r.ano || r.Ano,
    data_evidencia: r.data_evidencia || r["Data Evidência"] || r["Data Evidencia"],
    modulo: r.modulo || r["Módulo"] || r.Modulo,
    regiao_programa: r.regiao_programa || r["Região x Prog."] || r["Regiao x Prog"],
    frota: r.frota || r.Frota || r.Placa,
    tag: r.tag || r.TAG,
    tipo: r.tipo || r.Tipo,
    descricao: r.descricao || r["Descrição"] || r.Descricao,
    origem: r.origem || r.Origem,
    criticidade: r.criticidade || r.Criticidade,
    tempo_execucao: r.tempo_execucao || r["Tempo Exec."] || r["Tempo Execucao"],
    campo_base: r.campo_base || r["Campo/Base"],
    os: r.os || r.OS || r["O.S"],
    material: r.material || r.Material,
    nr_rc: r.nr_rc || r["Nº RC"] || r["Nr RC"],
    nr_ordem: r.nr_ordem || r["Nº Ordem"] || r["Nr Ordem"],
    fornecedor: r.fornecedor || r.Fornecedor,
    status: r.status || r.Status || 'Aberta'
  }))

  const { error } = await supabase
    .from('backlog')
    .insert(items)

  if (error) return { error: error.message }
  revalidatePath('/backlog')
  return { success: true, count: items.length }
}
