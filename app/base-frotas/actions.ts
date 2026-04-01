'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function buscarEquipamentos() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('equipamentos')
    .select('*')
    .order('placa', { ascending: true })
  
  if (error) throw new Error(error.message)
  return data
}

export async function criarEquipamento(formData: FormData) {
  const supabase = createClient()
  
  const placa = (formData.get('placa') as string)?.toUpperCase().trim()
  const tipo = (formData.get('tipo') as string)?.toUpperCase().trim()
  const categoria = (formData.get('categoria') as string)?.toUpperCase().trim()
  const modulo = (formData.get('modulo') as string)?.trim() || 'BASE'
  const ultimoHist = parseFloat(formData.get('horimetro') as string) || 0

  if (!placa || !tipo) return { error: 'Placa e Tipo são obrigatórios' }

  const { error } = await supabase.from('equipamentos').insert({
    placa,
    tipo,
    categoria,
    modulo,
    ultimoHist
  })

  if (error) return { error: error.message }
  
  revalidatePath('/base-frotas')
  revalidatePath('/')
  return { success: true }
}

export async function atualizarEquipamento(id: string, formData: FormData) {
  const supabase = createClient()
  
  const placa = (formData.get('placa') as string)?.toUpperCase().trim()
  const tipo = (formData.get('tipo') as string)?.toUpperCase().trim()
  const categoria = (formData.get('categoria') as string)?.toUpperCase().trim()
  const modulo = (formData.get('modulo') as string)?.trim() || 'BASE'
  const ultimoHist = parseFloat(formData.get('horimetro') as string) || 0

  const { error } = await supabase.from('equipamentos').update({
    placa,
    tipo,
    categoria,
    modulo,
    ultimoHist
  }).eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/base-frotas')
  revalidatePath('/')
  return { success: true }
}

export async function excluirEquipamento(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('equipamentos').delete().eq('id', id)
  
  if (error) return { error: error.message }
  
  revalidatePath('/base-frotas')
  revalidatePath('/')
  return { success: true }
}

export async function excluirEquipamentosMassivo(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('equipamentos').delete().in('id', ids)
  
  if (error) return { error: error.message }
  
  revalidatePath('/base-frotas')
  revalidatePath('/')
  return { success: true }
}

export async function importarEquipamentos(rows: any[]) {
  const supabase = createClient()
  
  function getVal(row: any, aliases: string[]) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
      const key = Object.keys(row).find(k => k.toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return null;
  }

  const inserts = rows.map(row => {
    const placa = String(getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || '').toUpperCase().trim()
    if (!placa) return null
    
    return {
      placa,
      tipo: String(getVal(row, ['tipo', 'Tipo', 'Modelo']) || 'OUTROS').toUpperCase().trim(),
      categoria: String(getVal(row, ['categoria', 'Categoria', 'Classe']) || 'PESADA').toUpperCase().trim(),
      modulo: String(getVal(row, ['modulo', 'Módulo', 'Setor']) || 'BASE').trim(),
      ultimoHist: parseFloat(String(getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori']) || '0').replace(',', '.')) || 0
    }
  }).filter(Boolean)

  if (inserts.length === 0) return { error: 'Nenhum equipamento válido encontrado' }

  const { error } = await supabase.from('equipamentos').upsert(inserts, { onConflict: 'placa' })
  
  if (error) return { error: error.message }
  
  revalidatePath('/base-frotas')
  revalidatePath('/')
  return { success: true, count: inserts.length }
}
