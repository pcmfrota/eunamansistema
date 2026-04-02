/**
 * Repository Layer (PreventivaRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { PreventivaInsert, PreventivaUpdate } from '../models/preventiva';

export class PreventivaRepository {
  static async list() {
    const supabase = createClient();
    return await supabase.from('preventivas').select('*, equipamentos(placa, tipo, categoria, modulo)').order('created_at', { ascending: false });
  }

  static async create(data: PreventivaInsert) {
    const supabase = createClient();
    return await supabase.from('preventivas').insert(data);
  }

  static async upsert(data: PreventivaInsert) {
    const supabase = createClient();
    return await supabase.from('preventivas').upsert(data, { onConflict: 'equipamento_id' });
  }

  static async update(id: string, data: PreventivaUpdate) {
    const supabase = createClient();
    return await supabase.from('preventivas').update(data).eq('id', id);
  }

  static async delete(id: string) {
    const supabase = createClient();
    return await supabase.from('preventivas').delete().eq('id', id);
  }
}
