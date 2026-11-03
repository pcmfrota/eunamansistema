// Cópia MÍNIMA de src/repositories/OSRepository.ts (app principal) — só o método create,
// usado pela cascata do Checklist Mecânico (abre uma OS automática ao fechar um checklist,
// ver field-app/src/modules/checklist-mecanicos/actions.ts). Os demais métodos (update/
// delete/listAll/importação) ficam para quando o módulo OS for portado de verdade (Fase 6).
import { createClient } from '@/utils/supabase/client';
import { OSInsert } from '../models/os';

export class OSRepository {
  static async create(data: OSInsert | OSInsert[]) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').insert(data as any).select();
  }
}
