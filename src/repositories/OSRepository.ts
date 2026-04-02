import { createClient } from '@/utils/supabase/server';
import { OSInsert, OSUpdate } from '../models/os';

export class OSRepository {
  static async create(data: OSInsert) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').insert(data);
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
    return await supabase.from('equipamentos').select('id, placa, ultimoHist, modulo');
  }

  static async updateEquipamentoHorimetro(id: string, value: number) {
    const supabase = createClient();
    return await supabase.from('equipamentos').update({ ultimoHist: value }).eq('id', id);
  }
}
