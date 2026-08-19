/**
 * Repository Layer (PreventivaRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { PreventivaInsert, PreventivaUpdate } from '../models/preventiva';
import { registrarExclusao } from '@/lib/audit-log';

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

    let row: any = null;
    try {
      const { data } = await supabase
        .from('preventivas')
        .select('*, equipamento_id, ultimo_horimetro, intervalo_horas')
        .eq('id', id)
        .maybeSingle();
      row = data;
    } catch (err) {
      console.warn('[PreventivaRepository.delete] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('preventivas').delete().eq('id', id);

    if (!result.error) {
      let placa: string | null = null;
      if (row?.equipamento_id) {
        try {
          const { data: equipamento } = await supabase
            .from('equipamentos')
            .select('placa')
            .eq('id', row.equipamento_id)
            .maybeSingle();
          placa = equipamento?.placa || null;
        } catch (err) {
          console.warn('[PreventivaRepository.delete] Falha ao resolver placa do equipamento:', err);
        }
      }

      await registrarExclusao({
        supabase,
        modulo: 'Preventiva',
        tabelaOrigem: 'preventivas',
        registroId: id,
        descricao: `Preventiva — Placa ${placa || row?.equipamento_id}`,
        dados: row,
      });
    }

    return result;
  }
}
