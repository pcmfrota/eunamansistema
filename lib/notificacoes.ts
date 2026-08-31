'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'

// Client de service role — necessário porque quem dispara a notificação (ex: um mecânico
// lançando uma OS) não tem permissão de escrever na tabela de notificações de outros
// cargos. Mesmo padrão já usado em app/tentativas-acesso/actions.ts.
function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.')
  return createServiceClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Cria uma notificação pra cada cargo listado. Nunca lança erro — uma falha aqui não pode
// derrubar a ação principal (ex: salvar a OS), mesmo padrão de lib/audit-log.ts.
export async function notificarPapeis(
  roles: string[],
  notif: { tipo: string; titulo: string; mensagem?: string; link?: string }
) {
  try {
    const adminClient = getAdminClient()
    const rows = roles.map(role => ({
      tipo: notif.tipo,
      titulo: notif.titulo,
      mensagem: notif.mensagem || null,
      link: notif.link || null,
      destinatario_role: role,
    }))
    await adminClient.from('notificacoes').insert(rows)
  } catch (err) {
    console.error('[Notificações] Falha ao criar notificação:', err)
  }
}
