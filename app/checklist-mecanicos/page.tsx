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

  // Carregar dados iniciais dos checklists (sem verificação de permissão aqui - feita pelo auth-context no frontend)
  const { data: checklists, error: checklistError } = await supabase
    .from('checklists_mecanicos')
    .select('*')
    .order('criado_em', { ascending: false })

  // Obter role do usuário (apenas para passar ao cliente)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = (profile?.role || 'visitante').toLowerCase().trim()

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
