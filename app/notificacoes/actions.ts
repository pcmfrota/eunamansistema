'use server'

import { createClient } from '@/utils/supabase/server'

// Notificações do cargo do usuário logado — a policy de SELECT já restringe isso a linhas
// de destinatario_role igual ao cargo do próprio usuário, então não precisa filtrar por
// usuário individual aqui.
export async function getMinhasNotificacoes(limit: number = 20) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.role) return { data: [] }

    const { data, error } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('destinatario_role', profile.role)
      .order('criado_em', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return { data: data || [] }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function marcarNotificacaoLida(id: string) {
  try {
    const supabase = createClient()
    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id)
    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function marcarTodasNotificacoesLidas() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile?.role) return { success: true }

    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('destinatario_role', profile.role)
      .eq('lida', false)

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
