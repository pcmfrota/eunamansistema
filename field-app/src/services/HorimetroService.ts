import { HorimetroRepository } from '../repositories/HorimetroRepository';
import { HorimetroInsert, HorimetroUpdate } from '../models/horimetro';

export class HorimetroService {
  static async getAll() {
    const { data, error } = await HorimetroRepository.list();
    if (error) throw new Error(error.message);
    return data;
  }

  static async create(data: HorimetroInsert) {
    if (!data.equipamento_id || isNaN(data.horimetro_inicial) || isNaN(data.horimetro_final) || !data.data_referencia) {
      throw new Error('Preencha os campos obrigatórios');
    }

    if (data.horimetro_final < data.horimetro_inicial) {
      throw new Error('Erro: O Horímetro final não pode ser menor que o inicial.');
    }

    const { error } = await HorimetroRepository.create(data);
    if (error) throw new Error(error.message);

    return { success: true };
  }

  static async update(id: string, data: HorimetroUpdate) {
    if (data.horimetro_final !== undefined && data.horimetro_inicial !== undefined) {
      if (data.horimetro_final < data.horimetro_inicial) {
        throw new Error('Erro: O Horímetro final não pode ser menor que o inicial.');
      }
    }

    const { error } = await HorimetroRepository.update(id, data);
    if (error) throw new Error(error.message);

    return { success: true };
  }

  static async delete(id: string) {
    const { error } = await HorimetroRepository.delete(id);
    if (error) throw new Error(error.message);
    return { success: true };
  }
}
