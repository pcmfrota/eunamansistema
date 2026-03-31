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
  // caso o usuário os tenha preenchido ou alterado no formulário
  if (tipo || modulo) {
    const atualizacoesEq: any = {}
    if (tipo) atualizacoesEq.tipo = tipo
    if (modulo) atualizacoesEq.modulo = modulo
    await supabase.from('equipamentos').update(atualizacoesEq).eq('id', equipamento_id)
  }

  // Grava a preventiva
  const { error } = await supabase.from('preventivas').insert({
    equipamento_id,
    ultimo_horimetro,
    horimetro_atual,
    intervalo_horas,
    data_atualizacao
  })
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/preventivas')
  revalidatePath('/')
  return { success: true }
}
