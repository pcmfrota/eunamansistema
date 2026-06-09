import { createClient } from '@/utils/supabase/server'
import BacklogClient from './BacklogClient'

export default async function BacklogPage() {
  const supabase = createClient()

  const [equipamentosRes, colaboradoresRes] = await Promise.all([
    supabase
      .from('equipamentos')
      .select('id, placa, modulo, area')
      .order('placa'),
    supabase
      .from('colaboradores')
      .select('id, nome')
      .order('nome')
  ])

  const placas = (equipamentosRes.data || []).map(e => ({
    id: e.id,
    placa: e.placa as string,
    modulo: e.modulo as string | null,
    area: e.area as string | null,
  }))

  const colaboradores = (colaboradoresRes.data || []).map(c => ({
    id: c.id,
    nome: c.nome as string,
  }))

  return <BacklogClient placas={placas} colaboradores={colaboradores} />
}
