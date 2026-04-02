export interface Horimetro {
  id?: string;
  equipamento_id: string;
  data_referencia: string;
  horimetro_inicial: number;
  horimetro_final: number;
  observacoes?: string | null;
  created_at?: string;
}

export interface HorimetroInsert extends Omit<Horimetro, 'id' | 'created_at'> {}
export interface HorimetroUpdate extends Partial<HorimetroInsert> {}
