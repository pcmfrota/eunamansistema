import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { EquipamentoInsert, EquipamentoUpdate } from '../models/equipamento';

export class EquipamentoService {
  static async getAll() {
    const { data, error } = await EquipamentoRepository.list();
    if (error) throw new Error(error.message);
    return data;
  }

  static async create(data: EquipamentoInsert) {
    if (!data.placa || !data.tipo) {
      throw new Error('Placa e Tipo são obrigatórios');
    }

    const { error } = await EquipamentoRepository.create({
      ...data,
      placa: data.placa.toUpperCase().trim(),
      tipo: data.tipo.toUpperCase().trim(),
      categoria: data.categoria?.toUpperCase().trim() || 'PESADA',
      modulo: data.modulo?.trim() || 'BASE',
    });

    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async update(id: string, data: EquipamentoUpdate) {
    const { error } = await EquipamentoRepository.update(id, {
      ...data,
      placa: data.placa?.toUpperCase().trim(),
      tipo: data.tipo?.toUpperCase().trim(),
      categoria: data.categoria?.toUpperCase().trim(),
      modulo: data.modulo?.trim(),
    });

    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async delete(id: string) {
    const { error } = await EquipamentoRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async deleteBulk(ids: string[]) {
    const { error } = await EquipamentoRepository.deleteMany(ids);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async import(rows: any[]) {
    const inserts: EquipamentoInsert[] = rows.map(row => {
      const placa = String(this.getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || '').toUpperCase().trim();
      if (!placa) return null;
      
      return {
        placa,
        tipo: String(this.getVal(row, ['tipo', 'Tipo', 'Modelo']) || 'OUTROS').toUpperCase().trim(),
        categoria: String(this.getVal(row, ['categoria', 'Categoria', 'Classe']) || 'PESADA').toUpperCase().trim(),
        modulo: String(this.getVal(row, ['modulo', 'Módulo', 'Setor']) || 'BASE').trim(),
        ultimoHist: parseFloat(String(this.getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori']) || '0').replace(',', '.')) || 0
      };
    }).filter(Boolean) as EquipamentoInsert[];

    if (inserts.length === 0) throw new Error('Nenhum equipamento válido encontrado');

    const { error } = await EquipamentoRepository.upsertMany(inserts);
    if (error) throw new Error(error.message);
    
    return { success: true, count: inserts.length };
  }

  private static getVal(row: any, aliases: string[]) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
      const key = Object.keys(row).find(k => k.toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return null;
  }
}
