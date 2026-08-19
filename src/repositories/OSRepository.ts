import { createClient } from '@/utils/supabase/server';
import { OSInsert, OSUpdate } from '../models/os';
import { registrarExclusao, registrarExclusoesEmLote } from '@/lib/audit-log';

export class OSRepository {
  static async create(data: OSInsert | OSInsert[]) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').insert(data as any).select();
  }

  static async update(id: string, data: OSUpdate) {
    const supabase = createClient();
    return await supabase.from('ordens_servico').update(data).eq('id', id).select();
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

  static async deleteMany(ids: string[]) {
    const supabase = createClient();

    let rows: any[] = [];
    try {
      const { data } = await supabase.from('ordens_servico').select('*').in('id', ids);
      rows = data || [];
    } catch (err) {
      console.warn('[OSRepository.deleteMany] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('ordens_servico').delete().in('id', ids);

    if (!result.error) {
      await registrarExclusoesEmLote(
        supabase,
        'Ordem de Serviço',
        'ordens_servico',
        rows.map(r => ({
          registroId: r.id,
          descricao: `OS Nº ${r.numero_os} — Placa ${r.placa}`,
          dados: r,
        }))
      );
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

  static async updateEquipamentoHorimetro(_id: string, _value: number) {
    // Horímetro agora é gerenciado pela tabela horimetros
    return;
  }
}
