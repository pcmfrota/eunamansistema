/**
 * Repository Layer (BacklogRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';

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
    return await supabase.from('backlog').delete().in('id', ids);
  }

  static async insertMany(items: BacklogItemInsert[]) {
    const supabase = await createClient();
    return await supabase.from('backlog').insert(items);
  }
}
