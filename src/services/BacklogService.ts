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
    const items: BacklogItemInsert[] = rows.map(r => ({
      semana: String(r.semana || r.Semana || '').trim(),
      mes: String(r.mes || r.Mês || r.Mes || '').trim(),
      ano: String(r.ano || r.Ano || '').trim(),
      data_evidencia: String(r.data_evidencia || r["Data Evidência"] || r["Data Evidencia"] || '').trim(),
      modulo: String(r.modulo || r["Módulo"] || r.Modulo || '').trim(),
      regiao_programa: String(r.regiao_programa || r["Região x Prog."] || r["Regiao x Prog"] || '').trim(),
      frota: String(r.frota || r.Frota || r.Placa || '').trim().toUpperCase(),
      tag: String(r.tag || r.TAG || '').trim().toUpperCase(),
      tipo: String(r.tipo || r.Tipo || '').trim(),
      descricao: String(r.descricao || r["Descrição"] || r.Descricao || '').trim(),
      origem: String(r.origem || r.Origem || '').trim(),
      criticidade: String(r.criticidade || r.Criticidade || '').trim(),
      tempo_execucao: String(r.tempo_execucao || r["Tempo Exec."] || r["Tempo Execucao"] || '').trim(),
      campo_base: String(r.campo_base || r["Campo/Base"] || '').trim(),
      os: String(r.os || r.OS || r["O.S"] || '').trim(),
      material: String(r.material || r.Material || '').trim(),
      nr_rc: String(r.nr_rc || r["Nº RC"] || r["Nr RC"] || '').trim(),
      nr_ordem: String(r.nr_ordem || r["Nº Ordem"] || r["Nr Ordem"] || '').trim(),
      fornecedor: String(r.fornecedor || r.Fornecedor || '').trim(),
      status: String(r.status || r.Status || 'Aberta').trim()
    }));

    const { error } = await BacklogRepository.insertMany(items);
    if (error) throw new Error(error.message);
    
    return { success: true, count: items.length };
  }
}
