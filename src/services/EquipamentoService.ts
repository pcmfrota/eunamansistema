import { z } from 'zod';
import { EquipamentoRepository } from '../repositories/EquipamentoRepository';
import { EquipamentoInsert, EquipamentoUpdate } from '../models/equipamento';

const EquipamentoSchema = z.object({
  placa: z.string().min(1, 'Placa é obrigatória').transform((val: string) => val.toUpperCase().trim()),
  tipo: z.string().min(1, 'Tipo é obrigatório').transform((val: string) => val.toUpperCase().trim()),
  categoria: z.string().default('PESADA').transform((val: string) => val.toUpperCase().trim()),
  modulo: z.string().default('BASE').transform((val: string) => val.trim()),
  modelo: z.string().optional().nullable().transform((val: string | null | undefined) => val?.trim() ?? null),
  horimetro_limite_preventiva: z.number().optional().default(500),
});

export class EquipamentoService {
  static async getAll() {
    const { data, error } = await EquipamentoRepository.list();
    if (error) throw new Error(error.message);
    return data;
  }

  static async create(data: EquipamentoInsert) {
    const validated = EquipamentoSchema.parse(data);

    const { error } = await EquipamentoRepository.create(validated);

    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async update(id: string, data: EquipamentoUpdate) {
    const partialSchema = EquipamentoSchema.partial();
    const validated = partialSchema.parse(data);

    const { error } = await EquipamentoRepository.update(id, validated);

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
      try {
        const raw = {
          placa: String(this.getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa', 'Tag']) || '').trim(),
          tipo: String(this.getVal(row, ['tipo', 'Tipo', 'Modelo', 'Descrição']) || 'OUTROS').trim(),
          categoria: String(this.getVal(row, ['categoria', 'Categoria', 'Classe']) || 'PESADA').trim(),
          modulo: String(this.getVal(row, ['modulo', 'Módulo', 'Setor']) || 'BASE').trim(),
          horimetro_limite_preventiva: parseFloat(String(this.getVal(row, ['limite', 'Limite', 'Intervalo']) || '500').replace(',', '.')) || 500,
          ultimo_hist: parseFloat(String(this.getVal(row, ['ultimo_hist', 'Horímetro', 'Ultimo Hist']) || '0').replace(',', '.')) || 0
        };

        if (!raw.placa) return null;
        return EquipamentoSchema.parse(raw);
      } catch (err) {
        console.warn('Falha ao validar linha durante importação:', err);
        return null;
      }
    }).filter(Boolean) as EquipamentoInsert[];

    if (inserts.length === 0) throw new Error('Nenhum equipamento válido encontrado para importação');

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
