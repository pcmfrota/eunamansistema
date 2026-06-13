'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export type Lavagem = {
  id: string
  placa: string
  data: string
  colaborador: string
  horimetro: number
  km: number
  status: 'Lavado' | 'Pendente' | 'Não realizado'
  lavagem_realizada: boolean
  observacoes: string
  imagem_1_url?: string
  imagem_2_url?: string
  imagem_3_url?: string
  imagem_horimetro_url?: string
  created_at: string
  validated_at?: string
}

export async function getLavagens(mes: number, ano: number) {
  const supabase = createClient()
  const startDate = `${ano}-${String(mes).padStart(2, '0')}-01`
  const endDate = new Date(ano, mes, 0).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('lavagens')
    .select('*')
    .gte('data', startDate)
    .lte('data', endDate)

  if (error) {
    console.error('Error fetching lavagens:', error)
    return []
  }

  return data as Lavagem[]
}

export async function getEquipamentos() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('equipamentos')
    .select('placa, modulo, categoria, area')
    .is('deleted_at', null)
    .order('placa')

  if (error) {
    console.error('Error fetching equipamentos:', error)
    return []
  }

  return data
}

export async function saveLavagem(formData: FormData) {
  const supabase = createClient()
  
  const id = formData.get('id') as string
  const placa = formData.get('placa') as string
  const data = formData.get('data') as string
  const colaborador = formData.get('colaborador') as string
  const horimetro = Number(formData.get('horimetro'))
  const km = Number(formData.get('km'))
  const lavagem_realizada = formData.get('lavagem_realizada') === 'true'
  const observacoes = formData.get('observacoes') as string
  
  // Status logic: if horimetro or km or images are missing, status is "Pendente"
  let status = 'Lavado'
  if (!horimetro || !km || !colaborador) {
    status = 'Pendente'
  }
  if (!lavagem_realizada) {
    status = 'Não realizado'
  }

  const lavagemData: any = {
    placa,
    data,
    colaborador,
    horimetro,
    km,
    status,
    lavagem_realizada,
    observacoes,
  }

  // Handle image uploads if any (simplification: URLs are passed directly for now)
  // In a real scenario, we'd upload to Supabase Storage here or in the client
  const img1 = formData.get('imagem_1_url')
  const img2 = formData.get('imagem_2_url')
  const img3 = formData.get('imagem_3_url')
  const imgH = formData.get('imagem_horimetro_url')

  if (img1) lavagemData.imagem_1_url = img1
  if (img2) lavagemData.imagem_2_url = img2
  if (img3) lavagemData.imagem_3_url = img3
  if (imgH) lavagemData.imagem_horimetro_url = imgH

  let error;
  if (id) {
    const { error: updateError } = await supabase
      .from('lavagens')
      .update(lavagemData)
      .eq('id', id)
    error = updateError
  } else {
    const { error: insertError } = await supabase
      .from('lavagens')
      .insert([lavagemData])
    error = insertError
  }

  if (error) {
    console.error('Error saving lavagem:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/lavagens')
  return { success: true }
}

export async function deleteLavagem(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('lavagens').delete().eq('id', id)

  if (error) {
    console.error('Error deleting lavagem:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/lavagens')
  return { success: true }
}

export async function validarLavagem(id: string) {
  const supabase = createClient()
  const { error } = await supabase
    .from('lavagens')
    .update({ validated_at: new Date().toISOString(), status: 'Lavado' })
    .eq('id', id)

  if (error) {
    console.error('Error validating lavagem:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/lavagens')
  return { success: true }
}
