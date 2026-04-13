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

    // Apaga dependentes primeiro (ignora erros de tabelas que não existem)
    for (const tabela of TABELAS_DEPENDENTES) {
      await (supabase.from(tabela as any) as any)
        .delete()
        .eq('equipamento_id', id);
    }

    // Agora apaga o equipamento
    return await supabase.from('equipamentos').delete().eq('id', id);
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient();

    // Apaga dependentes primeiro para cada id
    for (const tabela of TABELAS_DEPENDENTES) {
      await (supabase.from(tabela as any) as any)
        .delete()
        .in('equipamento_id', ids);
    }

    return await supabase.from('equipamentos').delete().in('id', ids);
  }

  static async upsertMany(data: EquipamentoInsert[]) {
    const supabase = createClient();
    return await supabase.from('equipamentos').upsert(data, { onConflict: 'placa' });
  }
}

