import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ChecklistClient from './ChecklistClient'

export const metadata = {
  title: 'Checklist Mecânicos | EUNAMAN SISTEMA',
  description: 'Módulo de Checklist para Caminhões da Frota',
}

export default async function ChecklistMecanicosPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Obter permissões do usuário logado
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, allowed_tabs')
    .eq('id', user.id)
    .single()

  const permissions = profile?.allowed_tabs || []
  const role = profile?.role || 'visitante'

  // Verifica acesso (Admin tem acesso livre, senão checa permissions)
  if (role !== 'admin' && !permissions.includes('/checklist-mecanicos')) {
    redirect('/')
  }

  // Carregar dados iniciais dos checklists
  const { data: checklists } = await supabase
    .from('checklists_mecanicos')
    .select('*')
    .order('criado_em', { ascending: false })

  return (
    <div className="min-h-screen w-full flex flex-col pt-[70px] lg:pt-0 lg:pl-64 transition-all duration-300 relative overflow-hidden">
      <ChecklistClient 
        initialChecklists={checklists || []}
        userRole={role}
        userId={user.id}
      />
    </div>
  )
}
