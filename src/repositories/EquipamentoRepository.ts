/** 
 * Repository Layer (EquipamentoRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { EquipamentoInsert, EquipamentoUpdate } from '../models/equipamento';

// Tabelas que têm FK para equipamentos (na ordem segura de deleção)
const TABELAS_DEPENDENTES = [
  'manutencoes',
  'ordens_servico',
  'preventivas',
  'horimetros',
  'pneus',
  'backlog',
] as const;

export class EquipamentoRepository {
  static async list() {
    const supabase = createClient();
    return await supabase.from('equipamentos').select('*').is('deleted_at', null).order('placa', { ascending: true });
  }

  static async create(data: EquipamentoInsert) {
    const supabase = createClient();
    return await supabase.from('equipamentos').insert({
      ...data,
      deleted_at: null
    });
  }

  static async update(id: string, data: EquipamentoUpdate) {
    const supabase = createClient();
    return await supabase.from('equipamentos').update(data).eq('id', id);
  }

  static async delete(id: string) {
    const supabase = createClient();
    return await supabase.from('equipamentos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient();
    return await supabase.from('equipamentos').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  }

  static async upsertMany(data: EquipamentoInsert[]) {
    const supabase = createClient();
    const dataWithDeletedAt = data.map(d => ({
      ...d,
      deleted_at: null
    }));
    return await supabase.from('equipamentos').upsert(dataWithDeletedAt, { onConflict: 'placa,deleted_at' });
  }
}

