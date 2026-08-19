'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { registrarExclusao, registrarExclusoesEmLote } from '@/lib/audit-log'

export type ConfigCategory = 'motivos' | 'sistemas' | 'sub-sistemas'

export async function buscarConfiguracoes() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('aux_config')
    .select('*')
    .order('value', { ascending: true })

  if (error) {
    console.warn('Tabela aux_config não encontrada ou erro:', error.message)
    return []
  }

  return data
}

export async function salvarConfiguracao(category: ConfigCategory, value: string) {
  const supabase = createClient()
  const val = value.trim().toUpperCase()
  if (!val) return { error: 'Valor não pode ser vazio' }

  const { error } = await supabase
    .from('aux_config')
    .upsert({ category, value: val }, { onConflict: 'category, value' })

  if (error) return { error: error.message }
  
  revalidatePath('/base-dados')
  return { success: true }
}

export async function excluirConfiguracao(id: string) {
  const supabase = createClient()

  let row: any = null
  try {
    const { data } = await supabase
      .from('aux_config')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    row = data
  } catch (err) {
    console.warn('[excluirConfiguracao] Falha ao buscar snapshot antes da exclusão:', err)
  }

  const { error } = await supabase
    .from('aux_config')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  await registrarExclusao({
    supabase,
    modulo: 'Base de Dados',
    tabelaOrigem: 'aux_config',
    registroId: id,
    descricao: row ? `${row.category} — ${row.value}` : null,
    dados: row,
  })

  revalidatePath('/base-dados')
  return { success: true }
}

export async function excluirVariasConfiguracoes(ids: string[]) {
  const supabase = createClient()

  let rows: any[] = []
  try {
    const { data } = await supabase
      .from('aux_config')
      .select('*')
      .in('id', ids)
    rows = data || []
  } catch (err) {
    console.warn('[excluirVariasConfiguracoes] Falha ao buscar snapshot antes da exclusão:', err)
  }

  const { error } = await supabase
    .from('aux_config')
    .delete()
    .in('id', ids)

  if (error) return { error: error.message }

  const rowsById = new Map(rows.map(r => [String(r.id), r]))
  await registrarExclusoesEmLote(
    supabase,
    'Base de Dados',
    'aux_config',
    ids.map(id => {
      const row = rowsById.get(String(id))
      return {
        registroId: id,
        descricao: row ? `${row.category} — ${row.value}` : null,
        dados: row ?? null,
      }
    })
  )

  revalidatePath('/base-dados')
  return { success: true }
}

export async function importarConfiguracoes(itens: { category: string, value: string }[]) {
  const supabase = createClient()
  
  const cleanItems = itens
    .map(i => ({
      category: i.category.toLowerCase().replace(' ', '-'),
      value: String(i.value).trim().toUpperCase()
    }))
    .filter(i => i.value && ['motivos', 'sistemas', 'sub-sistemas'].includes(i.category))

  const { error, count } = await supabase
    .from('aux_config')
    .upsert(cleanItems, { onConflict: 'category, value' })

  if (error) return { error: error.message }
  
  revalidatePath('/base-dados')
  return { success: true, count: cleanItems.length }
}
