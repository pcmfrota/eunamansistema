/**
 * Repository Layer (BacklogRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';
import { registrarExclusoesEmLote } from '@/lib/audit-log';

export class BacklogRepository {
  static async list(limit: number = 5000) {
    const supabase = await createClient();
    return await supabase
      .from('backlog')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  static async upsert(item: BacklogItemInsert | BacklogItemUpdate) {
    const supabase = await createClient();
    return await supabase
      .from('backlog')
      .upsert([item])
      .select();
  }

  static async deleteMany(ids: string[]) {
    const supabase = await createClient();

    let rows: any[] = [];
    try {
      const { data } = await supabase.from('backlog').select('*').in('id', ids);
      rows = data || [];
    } catch (err) {
      console.warn('[BacklogRepository.deleteMany] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('backlog').delete().in('id', ids);

    if (!result.error) {
      await registrarExclusoesEmLote(
        supabase,
        'Backlog',
        'backlog',
        rows.map(r => ({
          registroId: r.id,
          descricao: `${r.frota || 'S/ FROTA'} — ${r.descricao || ''}`,
          dados: r,
        }))
      );
    }

    return result;
  }

  static async insertMany(items: BacklogItemInsert[]) {
    const supabase = await createClient();
    return await supabase.from('backlog').insert(items);
  }
}
