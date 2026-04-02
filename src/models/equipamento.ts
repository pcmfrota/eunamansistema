export interface Equipamento {
  id?: string;
  placa: string;
  tipo: string;
  categoria?: string | null;
  modulo: string;
  ultimoHist?: number;
  created_at?: string;
}

export interface EquipamentoInsert extends Omit<Equipamento, 'id' | 'created_at'> {}
export interface EquipamentoUpdate extends Partial<EquipamentoInsert> {}
