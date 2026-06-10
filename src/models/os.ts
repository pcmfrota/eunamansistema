export interface OS {
  id?: string;
  numero_os: string;
  equipamento_id?: string | null;
  placa: string;
  modulo: string | null;
  status: 'Aberta' | 'Em Andamento' | 'Fechada' | 'Cancelada' | 'Concluída' | string;
  data_abertura: string;
  data_fechamento?: string | null;
  horimetro?: number | null;
  operacao_tipo?: string | null;
  local?: string | null;
  classe: 'CORRETIVA' | 'PREVENTIVA' | 'PREDITIVA' | string;
  foi_enviado_reserva: boolean;
  descricao: string;
  motivo?: string | null;
  sistema?: string | null;
  sub_sistema?: string | null;
  horas_manutencao?: number | null;
  horario_parada?: string | null;
  qual_reserva?: string | null;
  horas_reserva_chegou?: string | null;
  observacoes?: string | null;
  componente?: string | null;
  mecanicos?: string[] | null;
  assinatura_mecanico?: string | null;
  fotos?: string[] | null;
  aprovado?: boolean;
  created_at?: string;
}

export interface OSInsert extends Omit<OS, 'id' | 'created_at'> {}
export interface OSUpdate extends Partial<OSInsert> {}
