export interface Equipamento {
  id?: string;
  placa: string;
  tipo: string;
  categoria?: string | null;
  modulo: string;
  ultimo_hist?: number;
  created_at?: string;
  deleted_at?: string | null;
}

export interface EquipamentoInsert extends Omit<Equipamento, 'id' | 'created_at'> {}
export interface EquipamentoUpdate extends Partial<EquipamentoInsert> {}
