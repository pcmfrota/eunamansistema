// Bloco de descrição de atividade com horário inicial/final e foto — usado pelo field-app
// pra permitir várias descrições na mesma OS (ex: "Descrição 1", "Descrição 2"...), cada
// uma com seu próprio intervalo de horário e evidência fotográfica. A coluna `descricao`
// (texto livre) continua existindo e recebe um resumo concatenado desses blocos, pra ficar
// compatível com o que já lê/filtra por ela (site, listagens, etc.).
export interface DescricaoAtividade {
  descricao: string;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  foto?: string | null;
  // Cada descrição é de um mecânico diferente — assinatura própria (nome + matrícula +
  // desenho), não a assinatura única da OS inteira (ver `assinatura_mecanico`/`mecanicos`).
  mecanico_nome?: string | null;
  mecanico_matricula?: string | null;
  mecanico_assinatura?: string | null;
}

export interface OS {
  id?: string;
  numero_os: string;
  equipamento_id?: string | null;
  placa: string;
  modulo: string | null;
  status: 'Aberta' | 'Programado' | 'Fechada' | 'Cancelada' | 'Concluída' | string;
  data_abertura: string;
  data_fechamento?: string | null;
  horimetro?: number | null;
  km?: number | null;
  foto_horimetro?: string | null;
  foto_km?: string | null;
  operacao_tipo?: string | null;
  local?: string | null;
  classe: 'CORRETIVA' | 'PREVENTIVA' | 'PREDITIVA' | string;
  foi_enviado_reserva: boolean;
  descricao: string;
  descricoes_atividade?: DescricaoAtividade[] | null;
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
  created_by?: string | null;
  created_by_nome?: string | null;
  aprovado_por?: string | null;
  aprovado_por_nome?: string | null;
  aprovado_em?: string | null;
  // Aprovação em duas etapas: OS aberta por mecânico precisa de PCM + Supervisor de
  // Manutenção; OS aberta pelo PCM precisa só do Supervisor. `aprovado` (acima) continua
  // sendo o resultado final (true só quando todas as etapas exigidas estiverem ok), mantido
  // por compatibilidade com quem já filtra/lê por ele.
  aprovado_pcm?: boolean | null;
  aprovado_pcm_por?: string | null;
  aprovado_pcm_por_nome?: string | null;
  aprovado_pcm_em?: string | null;
  aprovado_supervisor?: boolean | null;
  aprovado_supervisor_por?: string | null;
  aprovado_supervisor_por_nome?: string | null;
  aprovado_supervisor_em?: string | null;
  created_at?: string;
}

export interface OSInsert extends Omit<OS, 'id' | 'created_at'> {}
export interface OSUpdate extends Partial<OSInsert> {}
