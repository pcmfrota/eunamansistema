'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { registrarExclusao } from '@/lib/audit-log'

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
  itens_lavados?: string[]
  tipo_frota?: 'pesado' | 'leve' | null
  imagem_1_url?: string
  imagem_2_url?: string
  imagem_3_url?: string
  imagem_horimetro_url?: string
  created_at: string
  validated_at?: string
  registrado_por?: string | null
  registrado_por_nome?: string | null
}

// Quem está autenticado no momento — grava no lançamento (mesmo padrão do Boletim de
// Pneus) pra saber quem registrou a lavagem, já que o campo "colaborador" agora é
// preenchido automaticamente com esse mesmo nome (lançamento rápido, sem seleção manual).
async function getUsuarioAtual() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { registrado_por: null, registrado_por_nome: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    registrado_por: user.id,
    registrado_por_nome: profile?.full_name || user.email || 'Usuário',
  };
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
    .select('placa, modulo, categoria, area, status')
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
  const horimetro = Number(formData.get('horimetro'))
  const km = Number(formData.get('km'))
  const lavagem_realizada = formData.get('lavagem_realizada') === 'true'
  const observacoes = formData.get('observacoes') as string
  const tipo_frota = (formData.get('tipo_frota') as string) || null

  let itens_lavados: string[] = []
  const itensRaw = formData.get('itens_lavados') as string | null
  if (itensRaw) {
    try { itens_lavados = JSON.parse(itensRaw) } catch { itens_lavados = [] }
  }

  // Status logic: km é sempre obrigatório; horímetro só é exigido pra frota pesada —
  // carro leve não tem esse campo no formulário, então não pode travar o status em
  // "Pendente" por falta dele.
  let status = 'Lavado'
  if (!km || (tipo_frota !== 'leve' && !horimetro)) {
    status = 'Pendente'
  }
  if (!lavagem_realizada) {
    status = 'Não realizado'
  }

  const lavagemData: any = {
    placa,
    data,
    horimetro,
    km,
    status,
    lavagem_realizada,
    observacoes,
    itens_lavados,
    tipo_frota,
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

  // "Colaborador" (quem lavou) não é mais escolhido manualmente — é sempre quem está
  // logado fazendo o lançamento (lançamento rápido, pensado pro app). Só preenchemos
  // isso (e registrado_por/registrado_por_nome) na criação: numa edição, preserva quem
  // registrou originalmente em vez de trocar pelo usuário que está editando agora.
  const { data: existing } = id
    ? await supabase.from('lavagens').select('id').eq('id', id).maybeSingle()
    : { data: null }

  if (!existing) {
    const usuario = await getUsuarioAtual()
    lavagemData.registrado_por = usuario.registrado_por
    lavagemData.registrado_por_nome = usuario.registrado_por_nome
    lavagemData.colaborador = usuario.registrado_por_nome
  }

  // O cliente já manda um UUID de verdade mesmo em registros novos (pra poder salvar
  // localmente offline antes de sincronizar) — por isso é upsert por id, não um
  // if/else de "tem id → update, não tem → insert": um id novo que ainda não existe
  // na tabela cairia no update e não salvaria nada (update em id inexistente não dá
  // erro, só não afeta nenhuma linha).
  const { data: saved, error } = id
    ? await supabase.from('lavagens').upsert({ ...lavagemData, id }, { onConflict: 'id' }).select().single()
    : await supabase.from('lavagens').insert([lavagemData]).select().single()

  if (error) {
    console.error('Error saving lavagem:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/lavagens')
  return { success: true, data: saved }
}

export async function deleteLavagem(id: string) {
  const supabase = createClient()

  let lavagemSnapshot: any = null
  try {
    const { data } = await supabase
      .from('lavagens')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    lavagemSnapshot = data
  } catch (snapshotError) {
    console.warn(`Falha ao capturar snapshot da lavagem ${id} antes da exclusão:`, snapshotError)
  }

  const { error } = await supabase.from('lavagens').delete().eq('id', id)

  if (error) {
    console.error('Error deleting lavagem:', error)
    return { success: false, error: error.message }
  }

  await registrarExclusao({
    supabase,
    modulo: 'Controle de Lavagens',
    tabelaOrigem: 'lavagens',
    registroId: id,
    descricao: lavagemSnapshot ? `Lavagem — Placa ${lavagemSnapshot.placa} (${lavagemSnapshot.data})` : null,
    dados: lavagemSnapshot,
  })

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
