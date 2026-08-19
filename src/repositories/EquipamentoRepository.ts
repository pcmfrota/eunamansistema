/** 
 * Repository Layer (EquipamentoRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { EquipamentoInsert, EquipamentoUpdate } from '../models/equipamento';
import { registrarExclusao, registrarExclusoesEmLote } from '@/lib/audit-log';

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

    let row: any = null;
    try {
      const { data } = await supabase
        .from('equipamentos')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      row = data;
    } catch (err) {
      console.warn('[EquipamentoRepository.delete] Falha ao buscar snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('equipamentos').update({ deleted_at: new Date().toISOString() }).eq('id', id);

    if (!result.error) {
      await registrarExclusao({
        supabase,
        modulo: 'Equipamento (Base de Frota)',
        tabelaOrigem: 'equipamentos',
        registroId: id,
        descricao: row ? `${row.placa} — ${row.tipo} (${row.modulo})` : null,
        dados: row,
      });
    }

    return result;
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient();

    let rows: any[] = [];
    try {
      const { data } = await supabase
        .from('equipamentos')
        .select('*')
        .in('id', ids);
      rows = data || [];
    } catch (err) {
      console.warn('[EquipamentoRepository.deleteMany] Falha ao buscar snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('equipamentos').update({ deleted_at: new Date().toISOString() }).in('id', ids);

    if (!result.error) {
      const rowsById = new Map(rows.map(r => [String(r.id), r]));
      await registrarExclusoesEmLote(
        supabase,
        'Equipamento (Base de Frota)',
        'equipamentos',
        ids.map(id => {
          const row = rowsById.get(String(id));
          return {
            registroId: id,
            descricao: row ? `${row.placa} — ${row.tipo} (${row.modulo})` : null,
            dados: row ?? null,
          };
        })
      );
    }

    return result;
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

