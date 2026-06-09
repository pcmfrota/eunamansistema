export interface BacklogItem {
  id?: string;
  semana?: string | null;
  mes?: string | null;
  ano?: string | null;
  data_evidencia?: string | null;
  modulo?: string | null;
  regiao_programa?: string | null;
  frota?: string | null;
  tag?: string | null;
  tipo?: string | null;
  descricao?: string | null;
  origem?: string | null;
  colaborador?: string | null;
  criticidade?: string | null;
  tempo_execucao?: string | null;
  campo_base?: string | null;
  os?: string | null;
  material?: string | null;
  nr_rc?: string | null;
  nr_ordem?: string | null;
  fornecedor?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface BacklogItemInsert extends Omit<BacklogItem, 'id' | 'created_at'> {}
export interface BacklogItemUpdate extends Partial<BacklogItemInsert> {}
