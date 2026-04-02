/**
 * Repository Layer (HorimetroRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { HorimetroInsert, HorimetroUpdate } from '../models/horimetro';

export class HorimetroRepository {
  static async list() {
    const supabase = createClient();
    return await supabase.from('horimetros').select('*, equipamentos(placa)').order('data_referencia', { ascending: false });
  }

  static async create(data: HorimetroInsert) {
    const supabase = createClient();
    return await supabase.from('horimetros').insert(data);
  }

  static async update(id: string, data: HorimetroUpdate) {
    const supabase = createClient();
    return await supabase.from('horimetros').update(data).eq('id', id);
  }

  static async delete(id: string) {
    const supabase = createClient();
    return await supabase.from('horimetros').delete().eq('id', id);
  }
}
