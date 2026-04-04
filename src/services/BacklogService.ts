import { BacklogRepository } from '../repositories/BacklogRepository';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';

export class BacklogService {
  static async getAll(limit: number = 100) {
    const { data, error } = await BacklogRepository.list(limit);
    if (error) throw new Error(error.message);
    return data;
  }

  static async upsert(item: any) {
    // Sanitize all fields: '' -> null
    const sanitized = Object.fromEntries(
      Object.entries(item).map(([k, v]) => [k, v === '' ? null : v])
    );
    const { data, error } = await BacklogRepository.upsert(sanitized);
    if (error) throw new Error(error.message);
    return { data, success: true };
  }

  static async deleteBulk(ids: string[]) {
    const { error } = await BacklogRepository.deleteMany(ids);
    if (error) throw new Error(error.message);
    return { success: true };
  }

  static async import(rows: any[]) {
    const s = (val: any) => {
      const v = String(val ?? '').trim();
      return v === '' ? null : v;
    };

    const items: any[] = rows.map(r => ({
      semana: s(r.semana ?? r.Semana),
      mes: s(r.mes ?? r.Mês ?? r.Mes),
      ano: s(r.ano ?? r.Ano),
      data_evidencia: s(r.data_evidencia ?? r["Data Evidência"] ?? r["Data Evidencia"]),
      modulo: s(r.modulo ?? r["Módulo"] ?? r.Modulo),
      regiao_programa: s(r.regiao_programa ?? r["Região x Prog."] ?? r["Regiao x Prog"]),
      frota: s(r.frota ?? r.Frota ?? r.Placa)?.toUpperCase() ?? null,
      tag: s(r.tag ?? r.TAG)?.toUpperCase() ?? null,
      tipo: s(r.tipo ?? r.Tipo),
      descricao: s(r.descricao ?? r["Descrição"] ?? r.Descricao),
      origem: s(r.origem ?? r.Origem),
      criticidade: s(r.criticidade ?? r.Criticidade),
      tempo_execucao: s(r.tempo_execucao ?? r["Tempo Exec."] ?? r["Tempo Execucao"]),
      campo_base: s(r.campo_base ?? r["Campo/Base"]),
      os: s(r.os ?? r.OS ?? r["O.S"]),
      material: s(r.material ?? r.Material),
      nr_rc: s(r.nr_rc ?? r["Nº RC"] ?? r["Nr RC"]),
      nr_ordem: s(r.nr_ordem ?? r["Nº Ordem"] ?? r["Nr Ordem"]),
      fornecedor: s(r.fornecedor ?? r.Fornecedor),
      status: s(r.status ?? r.Status) ?? 'Aberta',
      data_conclusao: s(r.data_conclusao ?? r["Data Conclusão"] ?? r["Data Conclusao"]),
      data_programacao: s(r.data_programacao ?? r["Data Programação"] ?? r["Data Programacao"]),
      status_programacao: s(r.status_programacao ?? r["Status Programação"] ?? r["Status Programacao"]),
      observacao: s(r.observacao ?? r["Observação"] ?? r.Observacao),
    }));

    const { error } = await BacklogRepository.insertMany(items);
    if (error) throw new Error(error.message);
    
    return { success: true, count: items.length };
  }
}
