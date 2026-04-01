'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function criarPreventiva(formData: FormData) {
  const supabase = createClient()
  
  const equipamento_id = formData.get('equipamento_id') as string
  const ultimo_horimetro = parseFloat(formData.get('ultimo_horimetro') as string)
  const horimetro_atual = parseFloat(formData.get('horimetro_atual') as string)
  const intervalo_horas = parseFloat(formData.get('intervalo_horas') as string) || 500
  const data_atualizacao = formData.get('data_atualizacao') as string
  const tipo = formData.get('tipo') as string
  const modulo = formData.get('modulo') as string

  if (!equipamento_id || isNaN(ultimo_horimetro) || isNaN(horimetro_atual)) {
    return { error: 'Preencha os campos obrigatórios' }
  }

  // Atualizar os campos tipo e modulo no equipamento referenciado 
  if (tipo || modulo) {
    const atualizacoesEq: any = {}
    if (tipo) atualizacoesEq.tipo = tipo
    if (modulo) atualizacoesEq.modulo = modulo
    await supabase.from('equipamentos').update(atualizacoesEq).eq('id', equipamento_id)
  }

  const { error } = await supabase.from('preventivas').insert({
    equipamento_id,
    ultimo_horimetro,
    horimetro_atual,
    intervalo_horas,
    data_atualizacao
  })
  
  if (error) return { error: error.message }

  revalidatePath('/preventivas')
  revalidatePath('/')
  return { success: true }
}

export async function excluirPreventiva(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('preventivas').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/preventivas')
  return { success: true }
}

export async function criarPreventivasEmMassa(data: any[]) {
  const supabase = createClient()
  let count = 0
  let errors = 0

  for (const row of data) {
    try {
      // Normalize headers
      const normalized: any = {}
      for (const key in row) {
        const k = key.trim().toLowerCase()
        normalized[k] = row[key]
      }

      const placa = (normalized.placa || normalized.equipamento || normalized.veiculo || '').toString().trim().toUpperCase()
      if (!placa) continue

      // Find equipment
      const { data: eq } = await supabase
        .from('equipamentos')
        .select('id')
        .eq('placa', placa)
        .single()

      if (!eq) {
        console.warn(`Equipamento não encontrado: ${placa}`)
        continue
      }

      const ultimo = parseFloat(normalized.ultimo || normalized['último'] || normalized.ultimo_horimetro || 0)
      const atual = parseFloat(normalized.atual || normalized.horimetro_atual || 0)
      const intervalo = parseFloat(normalized.intervalo || normalized.intervalo_horas || 500)
      const data_atualizacao = normalized.data || normalized.data_atualizacao || new Date().toISOString()

      const { error } = await supabase.from('preventivas').upsert({
        equipamento_id: eq.id,
        ultimo_horimetro: ultimo,
        horimetro_atual: atual,
        intervalo_horas: intervalo,
        data_atualizacao: data_atualizacao
      }, { onConflict: 'equipamento_id' }) // Only one active preventive per equipment usually? Or just insert?
      // Based on the system, one entry per equipment seems to be the current pattern for "Programação"
      
      if (error) {
        console.error(`Erro ao importar preventiva para ${placa}:`, error)
        errors++
      } else {
        count++
      }
    } catch (err) {
      console.error(err)
      errors++
    }
  }

  revalidatePath('/preventivas')
  return { count, errors }
}
