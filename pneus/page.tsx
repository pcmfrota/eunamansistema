import { createClient } from '@/utils/supabase/server'
import PneusClient from './PneusClient'

export default async function PneusPage() {
  const supabase = createClient()

  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, tipo, modulo')
    .order('placa')

  const { data: inspecoes } = await supabase
    .from('inspecoes_pneus')
    .select(`
      id, equipamento_id, data_inspecao, km_atual, condicao, observacoes,
      de, dd, tei, tee, tdi, tde, tei1, tee1, tdi1, tde1, estepe,
      equipamentos(placa, tipo)
    `)
    .order('data_inspecao', { ascending: false })

  return (
    <PneusClient
      equipamentos={equipamentos || []}
      inspecoes={(inspecoes as any) || []}
    />
  )
}
