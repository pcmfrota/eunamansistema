'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

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
  const { error } = await supabase
    .from('aux_config')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/base-dados')
  return { success: true }
}

export async function excluirVariasConfiguracoes(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase
    .from('aux_config')
    .delete()
    .in('id', ids)

  if (error) return { error: error.message }
  
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
