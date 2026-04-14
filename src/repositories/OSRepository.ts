import { createClient } from '@/utils/supabase/server';
import { OSInsert, OSUpdate } from '../models/os';

export class OSRepository {
  static async create(data: OSInsert | OSInsert[]) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').insert(data as any);
  }

  static async update(id: string, data: OSUpdate) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').update(data).eq('id', id);
  }

  static async delete(id: string) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').delete().eq('id', id);
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').delete().in('id', ids);
  }

  static async findById(id: string) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').select('*').eq('id', id).single();
  }

  static async listAll() {
    const supabase = createClient();
    return await supabase.from('ordens_servico').select('*').order('data_abertura', { ascending: false });
  }

  static async getEquipamentos() {
    const supabase = createClient();
    return await supabase.from('equipamentos').select('id, placa, modulo');
  }

  static async updateEquipamentoHorimetro(_id: string, _value: number) {
    // Horímetro agora é gerenciado pela tabela horimetros
    return;
  }
}
