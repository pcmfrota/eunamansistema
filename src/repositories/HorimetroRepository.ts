/**
 * Repository Layer (HorimetroRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { HorimetroInsert, HorimetroUpdate } from '../models/horimetro';
import { registrarExclusao } from '@/lib/audit-log';

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

    let row: any = null;
    try {
      const { data } = await supabase.from('horimetros').select('*').eq('id', id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn('[HorimetroRepository.delete] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('horimetros').delete().eq('id', id);

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
          console.warn('[HorimetroRepository.delete] Falha ao resolver placa do equipamento:', err);
        }
      }

      await registrarExclusao({
        supabase,
        modulo: 'Horímetro',
        tabelaOrigem: 'horimetros',
        registroId: id,
        descricao: `Horímetro — Placa ${placa || row?.equipamento_id} (${row?.data_referencia})`,
        dados: row,
      });
    }

    return result;
  }
}
