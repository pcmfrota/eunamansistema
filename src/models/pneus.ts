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
  
  // Sulco 2 (meio do pneu) de cada posição — é o valor que alimenta o Dashboard/gráficos
  // principais (mantido sem sufixo por compatibilidade com todo o histórico já lançado).
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

  // Sulco 1 (lado direito) e Sulco 3 (lado esquerdo) de cada posição — usados na aba de
  // Sulcos Detalhados e na ficha em PDF; não entram no Dashboard/gráficos principais.
  de_s1?: number | null;    de_s3?: number | null;
  dd_s1?: number | null;    dd_s3?: number | null;
  tei_s1?: number | null;   tei_s3?: number | null;
  tee_s1?: number | null;   tee_s3?: number | null;
  tdi_s1?: number | null;   tdi_s3?: number | null;
  tde_s1?: number | null;   tde_s3?: number | null;
  tei1_s1?: number | null;  tei1_s3?: number | null;
  tee1_s1?: number | null;  tee1_s3?: number | null;
  tdi1_s1?: number | null;  tdi1_s3?: number | null;
  tde1_s1?: number | null;  tde1_s3?: number | null;
  estepe_s1?: number | null; estepe_s3?: number | null;

  created_at?: string;

  // Quem registrou o boletim — usado no Histórico e na restrição de visualização por usuário
  registrado_por?: string | null;
  registrado_por_nome?: string | null;
}

export interface InspecaoPneuInsert extends Omit<InspecaoPneu, 'id' | 'created_at'> {}
export interface InspecaoPneuUpdate extends Partial<InspecaoPneuInsert> {}
