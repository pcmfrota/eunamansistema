export interface FichaCaptacao {
  id: string;
  ano: number;
  mes: number;
  placa: string;
  motorista: string;
  processo: string;
  nucleo: string;
  supervisor_suzano?: string;
  assinatura_supervisor?: string | null;
  codigo?: string;
  revisao?: string;
  status: 'Aberta' | 'Fechada';
  criado_por?: string;
  created_at?: string;
  reaberta_em?: string | null;
  lancamentos?: LancamentoCaptacao[];
}

export interface LancamentoCaptacao {
  id: string;
  ficha_id: string;
  data: string; // YYYY-MM-DD
  id_ponto: string;
  hora_inicial: string; // HH:MM
  hora_final: string; // HH:MM
  volume_captado: number;
  fazenda_captada: string;
  up_captacao: string;
  atividade: string;
  fazenda_atividade: string;
  up_atividade: string;
  foto_ponto?: string; // Base64
  created_at?: string;
}
