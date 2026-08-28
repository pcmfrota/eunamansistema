export type CondicaoPneu = 'BOM' | 'REGULAR' | 'CRITICO' | 'TROCAR';

export interface InspecaoPneu {
  id?: string;
  equipamento_id: string;
  data_inspecao: string;
  km_atual: number | null;
  condicao: CondicaoPneu;
  observacoes?: string | null;
  
  // Novos cabeçalhos Ficha Verde
  ordem_servico?: string | null;
  origem?: string | null;
  funcionario?: string | null;
  data_saida?: string | null;
  horimetro_registro?: number | null;
  
  // Anexo fotográfico (JSONB mapeando posição do pneu -> base64 compressed)
  fotos?: Record<string, string> | null;
  
  de?: number | null;
  dd?: number | null;
  tei?: number | null;
  tee?: number | null;
  tdi?: number | null;
  tde?: number | null;
  tei1?: number | null;
  tee1?: number | null;
  tdi1?: number | null;
  tde1?: number | null;
  estepe?: number | null;
  created_at?: string;

  // Quem registrou o boletim — usado no Histórico e na restrição de visualização por usuário
  registrado_por?: string | null;
  registrado_por_nome?: string | null;
}

export interface InspecaoPneuInsert extends Omit<InspecaoPneu, 'id' | 'created_at'> {}
export interface InspecaoPneuUpdate extends Partial<InspecaoPneuInsert> {}
