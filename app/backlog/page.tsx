import { createClient } from '@/utils/supabase/server'
import BacklogClient from './BacklogClient'

export default async function BacklogPage() {
  const supabase = createClient()

  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, modulo, area')
    .order('placa')

  const placas = (equipamentos || []).map(e => ({
    id: e.id,
    placa: e.placa as string,
    modulo: e.modulo as string | null,
    area: e.area as string | null,
  }))

  return <BacklogClient placas={placas} />
}
