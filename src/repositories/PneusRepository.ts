import { createClient } from '@/utils/supabase/server'
import { InspecaoPneuInsert, InspecaoPneuUpdate } from '../models/pneus'

export class PneusRepository {
  static async list() {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').select('*, equipamentos(placa)').order('data_inspecao', { ascending: false })
  }

  static async create(data: InspecaoPneuInsert) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').insert(data)
  }

  static async createMany(data: InspecaoPneuInsert[]) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').insert(data)
  }

  static async update(id: string, data: InspecaoPneuUpdate) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').update(data).eq('id', id)
  }

  static async delete(id: string) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').delete().eq('id', id)
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').delete().in('id', ids)
  }
}
