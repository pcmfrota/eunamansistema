export interface Preventiva {
  id?: string;
  equipamento_id: string;
  ultimo_horimetro: number;
  horimetro_atual: number;
  intervalo_horas: number;
  data_atualizacao: string;
  created_at?: string;
}

export interface PreventivaInsert extends Omit<Preventiva, 'id' | 'created_at'> {}
export interface PreventivaUpdate extends Partial<PreventivaInsert> {}
