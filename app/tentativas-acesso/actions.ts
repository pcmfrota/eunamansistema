'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { createClient } from '@/utils/supabase/server'
import { getUserFilial } from '@/utils/filial'

// Client de service role — necessário porque uma tentativa de login que falhou não gera
// sessão autenticada (RLS bloquearia o insert feito como o próprio usuário). Mesmo padrão
// já usado em app/admin/usuarios/actions.ts.
const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.')
  return createServiceClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Registra toda tentativa de login (sucesso ou falha) pra o admin acompanhar em
// /tentativas-acesso. Nunca lança erro — uma falha aqui não pode derrubar o login em si,
// mesmo padrão de "log nunca quebra o fluxo principal" do lib/audit-log.ts.
export async function registrarTentativaLogin(email: string, sucesso: boolean, motivo?: string, userId?: string) {
  try {
    const h = headers()
    const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null
    const userAgent = h.get('user-agent') || null

    const adminClient = getAdminClient()
    await adminClient.from('login_attempts').insert({
      email: (email || '').toLowerCase().trim(),
      sucesso,
      motivo: motivo || null,
      user_id: userId || null,
      ip,
      user_agent: userAgent,
    })
  } catch (err) {
    console.error('[Tentativas de Acesso] Falha ao registrar tentativa de login:', err)
  }
}

export async function getTentativasAcesso(limit: number = 500) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Não autenticado.' }

    const { isAdmin } = await getUserFilial(supabase)
    if (!isAdmin) return { error: 'Apenas o administrador pode ver as tentativas de acesso.' }

    const { data, error } = await supabase
      .from('login_attempts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw new Error(error.message)
    return { data: data || [] }
  } catch (error: any) {
    return { error: error.message }
  }
}
