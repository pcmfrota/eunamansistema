import { PreventivaRepository } from '../repositories/PreventivaRepository';
import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { PreventivaInsert, PreventivaUpdate } from '../models/preventiva';

export class PreventivaService {
  static async getAll() {
    const { data, error } = await PreventivaRepository.list();
    if (error) throw new Error(error.message);
    return data;
  }

  static async create(data: PreventivaInsert, extra?: { tipo?: string, modulo?: string }) {
    if (!data.equipamento_id || isNaN(data.ultimo_horimetro) || isNaN(data.horimetro_atual)) {
      throw new Error('Preencha os campos obrigatórios');
    }

    // Side-effect: Update equipment type/modulo (Legacy behavior)
    if (extra?.tipo || extra?.modulo) {
      const updates: any = {};
      if (extra.tipo) updates.tipo = extra.tipo;
      if (extra.modulo) updates.modulo = extra.modulo;
      await EquipamentoRepository.update(data.equipamento_id, updates);
    }

    const { error } = await PreventivaRepository.create(data);
    if (error) throw new Error(error.message);

    return { success: true };
  }

  static async update(id: string, data: PreventivaUpdate) {
    const { error } = await PreventivaRepository.update(id, data);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async delete(id: string) {
    const { error } = await PreventivaRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async importBulk(data: any[]) {
    const { data: eqs } = await EquipamentoRepository.list();
    const eqMap: Record<string, string> = {};
    for (const e of eqs || []) eqMap[e.placa.toUpperCase()] = e.id;

    let count = 0;
    let errors = 0;

    for (const row of data) {
      try {
        const normalized: any = {};
        for (const key in row) normalized[key.trim().toLowerCase()] = row[key];

        const placa = String(normalized.placa || normalized.equipamento || normalized.veiculo || '').trim().toUpperCase();
        if (!placa || !eqMap[placa]) {
          errors++;
          continue;
        }

        const insertData: PreventivaInsert = {
          equipamento_id: eqMap[placa],
          ultimo_horimetro: parseFloat(normalized.ultimo || normalized['último'] || normalized.ultimo_horimetro || 0),
          horimetro_atual: parseFloat(normalized.atual || normalized.horimetro_atual || 0),
          intervalo_horas: parseFloat(normalized.intervalo || normalized.intervalo_horas || 500),
          data_atualizacao: normalized.data || normalized.data_atualizacao || new Date().toISOString()
        };

        const { error } = await PreventivaRepository.upsert(insertData);
        if (error) {
          console.error(`Erro ao importar preventiva para ${placa}:`, error.message);
          errors++;
        } else {
          count++;
        }
      } catch (err) {
        console.error(err);
        errors++;
      }
    }

    return { count, errors };
  }
}
