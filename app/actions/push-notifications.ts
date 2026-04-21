'use server'

import { createClient } from '@/utils/supabase/server'

export async function salvarSubscricaoPush(subscription: any) {
  const supabase = createClient()
  
  // Obtém o usuário atual (opcional, dependendo de como você quer rastrear os pushes)
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user?.id,
      endpoint: subscription.endpoint,
      auth_key: subscription.keys.auth,
      p256dh_key: subscription.keys.p256dh,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' })

  if (error) {
    console.error('Erro ao salvar subscrição push:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
