import { BacklogRepository } from '../repositories/BacklogRepository';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';

export class BacklogService {
  static async getAll(limit: number = 100) {
    const { data, error } = await BacklogRepository.list(limit);
    if (error) throw new Error(error.message);
    return data;
  }

  static async upsert(item: BacklogItemInsert | BacklogItemUpdate) {
    const { data, error } = await BacklogRepository.upsert(item);
    if (error) throw new Error(error.message);
    return { data, success: true };
  }

  static async deleteBulk(ids: string[]) {
    const { error } = await BacklogRepository.deleteMany(ids);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async import(rows: any[]) {
    // Helper: returns trimmed string or null (never empty string)
    const str = (val: any): string | null => {
      const s = String(val ?? '').trim();
      return s === '' ? null : s;
    };

    const items: BacklogItemInsert[] = rows.map(r => ({
      semana: str(r.semana ?? r.Semana),
      mes: str(r.mes ?? r.Mês ?? r.Mes),
      ano: str(r.ano ?? r.Ano),
      data_evidencia: str(r.data_evidencia ?? r["Data Evidência"] ?? r["Data Evidencia"]),
      modulo: str(r.modulo ?? r["Módulo"] ?? r.Modulo),
      regiao_programa: str(r.regiao_programa ?? r["Região x Prog."] ?? r["Regiao x Prog"]),
      frota: str(r.frota ?? r.Frota ?? r.Placa)?.toUpperCase() ?? null,
      tag: str(r.tag ?? r.TAG)?.toUpperCase() ?? null,
      tipo: str(r.tipo ?? r.Tipo),
      descricao: str(r.descricao ?? r["Descrição"] ?? r.Descricao),
      origem: str(r.origem ?? r.Origem),
      criticidade: str(r.criticidade ?? r.Criticidade),
      tempo_execucao: str(r.tempo_execucao ?? r["Tempo Exec."] ?? r["Tempo Execucao"]),
      campo_base: str(r.campo_base ?? r["Campo/Base"]),
      os: str(r.os ?? r.OS ?? r["O.S"]),
      material: str(r.material ?? r.Material),
      nr_rc: str(r.nr_rc ?? r["Nº RC"] ?? r["Nr RC"]),
      nr_ordem: str(r.nr_ordem ?? r["Nº Ordem"] ?? r["Nr Ordem"]),
      fornecedor: str(r.fornecedor ?? r.Fornecedor),
      status: str(r.status ?? r.Status) ?? 'Aberta',
    }));

    const { error } = await BacklogRepository.insertMany(items);
    if (error) throw new Error(error.message);
    
    return { success: true, count: items.length };
  }
}
