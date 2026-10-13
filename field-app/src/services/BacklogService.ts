import { BacklogRepository } from '../repositories/BacklogRepository';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';

const VALID_COLUMNS = new Set([
  'id',
  'semana',
  'mes',
  'ano',
  'data_evidencia',
  'modulo',
  'regiao_programa',
  'frota',
  'tag',
  'tipo',
  'descricao',
  'origem',
  'colaborador',
  'criticidade',
  'tempo_execucao',
  'campo_base',
  'os',
  'material',
  'nr_rc',
  'nr_ordem',
  'fornecedor',
  'status',
  'data_conclusao',
  'data_programacao',
  'status_programacao',
  'observacao',
  'evidencia_imagem',
  'created_at'
]);

export class BacklogService {
  static async getAll(limit: number = 5000) {
    const { data, error } = await BacklogRepository.list(limit);
    if (error) throw new Error(error.message);
    
    // Normalize existing database items on the fly
    const normalized = (data || []).map(item => {
      let status = item.status;
      let criticidade = item.criticidade;

      const st = String(status || '').toUpperCase().trim();
      if (st === 'ABERTA' || st === 'EM ANDAMENTO' || st === 'PENDENTE' || !st) {
        status = 'PENDENTE';
      } else if (st === 'CONCLUIDO' || st === 'CONCLUÍDO' || st === 'ENCERRADA' || st === 'ENCERRADO') {
        status = 'ENCERRADO';
      } else if (st === 'PROGRAMADO' || st === 'PROGRAMADA') {
        status = 'PROGRAMADO';
      }

      const cr = String(criticidade || '').toUpperCase().trim();
      if (cr === 'A' || cr === 'INTERDIÇÃO' || cr === 'INTERDICAO' || cr === 'ALTA') {
        criticidade = 'A';
      } else {
        criticidade = 'B';
      }

      return {
        ...item,
        status,
        criticidade
      };
    });

    return normalized;
  }

  static async upsert(item: any) {
    // Keep only valid database columns
    const filteredItem = Object.fromEntries(
      Object.entries(item).filter(([k]) => VALID_COLUMNS.has(k))
    );

    // Sanitize all fields: '' -> null
    const sanitized = Object.fromEntries(
      Object.entries(filteredItem).map(([k, v]) => [k, v === '' ? null : v])
    );

    if (sanitized.id && String(sanitized.id).startsWith('temp_')) {
      delete sanitized.id;
    }

    // Normalize status on save
    if (sanitized.status) {
      const st = String(sanitized.status).toUpperCase().trim();
      if (st === 'ABERTA' || st === 'EM ANDAMENTO' || st === 'PENDENTE') {
        sanitized.status = 'PENDENTE';
      } else if (st === 'CONCLUIDO' || st === 'CONCLUÍDO' || st === 'ENCERRADA' || st === 'ENCERRADO') {
        sanitized.status = 'ENCERRADO';
      } else if (st === 'PROGRAMADO' || st === 'PROGRAMADA') {
        sanitized.status = 'PROGRAMADO';
      }
    } else {
      sanitized.status = 'PENDENTE';
    }

    // Normalize criticidade on save
    if (sanitized.criticidade) {
      const cr = String(sanitized.criticidade).toUpperCase().trim();
      if (cr === 'A' || cr === 'INTERDIÇÃO' || cr === 'INTERDICAO' || cr === 'ALTA') {
        sanitized.criticidade = 'A';
      } else {
        sanitized.criticidade = 'B';
      }
    } else {
      sanitized.criticidade = 'B';
    }

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

    const items: any[] = rows.map(r => {
      const st = String(r.status ?? r.Status ?? 'PENDENTE').toUpperCase().trim();
      let status = 'PENDENTE';
      if (st === 'ABERTA' || st === 'EM ANDAMENTO' || st === 'PENDENTE') {
        status = 'PENDENTE';
      } else if (st === 'CONCLUIDO' || st === 'CONCLUÍDO' || st === 'ENCERRADA' || st === 'ENCERRADO') {
        status = 'ENCERRADO';
      } else if (st === 'PROGRAMADO' || st === 'PROGRAMADA') {
        status = 'PROGRAMADO';
      }

      const cr = String(r.criticidade ?? r.Criticidade ?? 'B').toUpperCase().trim();
      let criticidade = 'B';
      if (cr === 'A' || cr === 'INTERDIÇÃO' || cr === 'INTERDICAO' || cr === 'ALTA') {
        criticidade = 'A';
      }

      return {
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
        colaborador: s(r.colaborador ?? r.Colaborador ?? r.Mecânico ?? r.Mecanico),
        criticidade,
        tempo_execucao: s(r.tempo_execucao ?? r["Tempo Exec."] ?? r["Tempo Execucao"]),
        campo_base: s(r.campo_base ?? r["Campo/Base"]),
        os: s(r.os ?? r.OS ?? r["O.S"]),
        material: s(r.material ?? r.Material),
        nr_rc: s(r.nr_rc ?? r["Nº RC"] ?? r["Nr RC"]),
        nr_ordem: s(r.nr_ordem ?? r["Nº Ordem"] ?? r["Nr Ordem"]),
        fornecedor: s(r.fornecedor ?? r.Fornecedor),
        status,
        data_conclusao: s(r.data_conclusao ?? r["Data Conclusão"] ?? r["Data Conclusao"]),
        data_programacao: s(r.data_programacao ?? r["Data Programação"] ?? r["Data Programacao"]),
        status_programacao: s(r.status_programacao ?? r["Status Programação"] ?? r["Status Programacao"]),
        observacao: s(r.observacao ?? r["Observação"] ?? r.Observacao),
      };
    });

    const { error } = await BacklogRepository.insertMany(items);
    if (error) throw new Error(error.message);
    
    return { success: true, count: items.length };
  }
}
