/** 
 * Repository Layer (EquipamentoRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { EquipamentoInsert, EquipamentoUpdate } from '../models/equipamento';

export class EquipamentoRepository {
  static async list() {
    const supabase = createClient();
    return await supabase.from('equipamentos').select('*').order('placa', { ascending: true });
  }

  static async create(data: EquipamentoInsert) {
    const supabase = createClient();
    return await supabase.from('equipamentos').insert(data);
  }

  static async update(id: string, data: EquipamentoUpdate) {
    const supabase = createClient();
    return await supabase.from('equipamentos').update(data).eq('id', id);
  }

  static async delete(id: string) {
    const supabase = createClient();
    return await supabase.from('equipamentos').delete().eq('id', id);
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient();
    return await supabase.from('equipamentos').delete().in('id', ids);
  }

  static async upsertMany(data: EquipamentoInsert[]) {
    const supabase = createClient();
    return await supabase.from('equipamentos').upsert(data, { onConflict: 'placa' });
  }
}
