import { createClient } from '@/utils/supabase/server'
import { Clipboard, Clock } from 'lucide-react'
import HorimetroClient from './HorimetroClient'

export default async function HorimetroPage() {
  const supabase = createClient()

  // Buscar todos os equipamentos para os dropdowns
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, modelo')
    .order('placa')

  // Buscar o histórico completo de apontamentos para a tabela
  const { data: historico } = await supabase
    .from('horimetros')
    .select('*, equipamentos(placa, modelo)')
    .order('data_referencia', { ascending: false })
    .order('created_at', { ascending: false })

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full">
       <HorimetroClient 
          equipamentos={equipamentos || []} 
          historico={historico || []} 
       />
    </div>
  )
}
