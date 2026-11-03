// Cópia de src/repositories/OSRepository.ts (app principal) — CRUD completo (Fase 6: módulo
// OS portado pro field-app), exceto deleteMany/importação (fora de escopo de campo). `create`
// já existia antes disso, criado pra cascata do Checklist Mecânico (ver
// field-app/src/modules/checklist-mecanicos/actions.ts) — mantido como estava.
import { createClient } from '@/utils/supabase/client';
import { OSInsert, OSUpdate } from '../models/os';
import { registrarExclusao } from '@/lib/audit-log';

export class OSRepository {
  static async create(data: OSInsert | OSInsert[]) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').insert(data as any).select();
  }

  static async update(id: string, data: OSUpdate) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').update(data as any).eq('id', id).select();
  }

  static async delete(id: string) {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from('ordens_servico').select('*').eq('id', id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn('[OSRepository.delete] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('ordens_servico').delete().eq('id', id);

    if (!result.error) {
      await registrarExclusao({
        supabase,
        modulo: 'Ordem de Serviço',
        tabelaOrigem: 'ordens_servico',
        registroId: id,
        descricao: `OS Nº ${row?.numero_os} — Placa ${row?.placa}`,
        dados: row,
      });
    }

    return result;
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
}
