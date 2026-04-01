'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarHorimetro(formData: FormData) {
  const supabase = createClient()
  
  const equipamento_id = formData.get('equipamento_id') as string
  // Map 'data_referencia' (from new modal) to 'data_referencia' (table field)
  const data_referencia = formData.get('data_referencia') || formData.get('data') as string
  const horimetro_inicial = parseFloat(formData.get('horimetro_inicial') as string)
  const horimetro_final = parseFloat(formData.get('horimetro_final') as string)
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || isNaN(horimetro_inicial) || isNaN(horimetro_final) || !data_referencia) {
    return { error: 'Preencha todos os campos obrigatórios' }
  }
  
  if (horimetro_final < horimetro_inicial) {
    return { error: 'Erro: O Horímetro final não pode ser menor que o inicial.' }
  }

  const { error } = await supabase.from('horimetros').insert({
    equipamento_id,
    data_referencia,
    horimetro_inicial,
    horimetro_final,
    observacoes
  })
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/horimetro')
  revalidatePath('/')
  return { success: true }
}

export async function atualizarHorimetro(id: string, formData: FormData) {
  const supabase = createClient()

  const equipamento_id = formData.get('equipamento_id') as string
  const data_referencia = formData.get('data_referencia') as string
  const horimetro_inicial = parseFloat(formData.get('horimetro_inicial') as string)
  const horimetro_final = parseFloat(formData.get('horimetro_final') as string)
  const observacoes = formData.get('observacoes') as string

  if (!id || !equipamento_id || isNaN(horimetro_inicial) || isNaN(horimetro_final) || !data_referencia) {
    return { error: 'Dados inválidos para atualização' }
  }

  const { error } = await supabase.from('horimetros').update({
    equipamento_id,
    data_referencia,
    horimetro_inicial,
    horimetro_final,
    observacoes
  }).eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/horimetro')
  revalidatePath('/')
  return { success: true }
}

export async function excluirHorimetro(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('horimetros').delete().eq('id', id)
  
  if (error) return { error: error.message }

  revalidatePath('/horimetro')
  revalidatePath('/')
  return { success: true }
}
