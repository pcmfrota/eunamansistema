'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function registrarHorimetro(formData: FormData) {
  const supabase = createClient()
  
  const equipamento_id = formData.get('equipamento_id') as string
  const data_referencia = formData.get('data') as string
  const horimetro_inicial = parseFloat(formData.get('horimetro_inicial') as string)
  const horimetro_final = parseFloat(formData.get('horimetro_final') as string)
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || isNaN(horimetro_inicial) || isNaN(horimetro_final) || !data_referencia) {
    return { error: 'Preencha todos os campos obrigatórios' }
  }
  
  if (horimetro_final < horimetro_inicial) {
    return { error: 'Erro: O Horímetro final não pode ser menor que o inicial.' }
  }

  // Verificar se há uma restrição única ou sobreposição, mas para simplificar:
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

  // Atualizar a linha do tempo e o dash
  revalidatePath('/horimetro')
  revalidatePath('/')
  return { success: true }
}
