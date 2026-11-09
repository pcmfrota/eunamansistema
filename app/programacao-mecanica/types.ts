export type TipoProgramacao = "inspecao" | "lubrificacao" | "calibragem" | "lavagem";
export type Periodicidade = "quinzenal" | "semanal";
export type StatusExecucao = "programado" | "em_andamento" | "executado";

export interface FotoEvidencia {
  path: string;
  url: string;
}

export interface ExecucaoProgramacao {
  id: string;
  equipamento_id: string | null;
  placa: string;
  tipo_programacao: TipoProgramacao;
  periodicidade: Periodicidade;
  data_programada: string; // YYYY-MM-DD
  data_execucao: string | null; // ISO datetime
  status: StatusExecucao;
  km: number | null;
  horimetro: number | null;
  responsavel_execucao: string | null;
  responsavel_acompanhamento: string | null;
  observacoes: string | null;
  fotos: FotoEvidencia[];
  dados_extra: Record<string, any>;
  criado_por: string | null;
  criado_por_nome: string | null;
  filial_id: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface VeiculoFrotaPesada {
  id: string;
  placa: string;
  modelo: string | null;
  tipo: string | null;
  categoria: string | null;
  modulo: string | null;
  area: string | null;
  status: string | null;
}

export const CICLO_DIAS: Record<Periodicidade, number> = {
  quinzenal: 15,
  semanal: 7,
};

export const TIPO_PROGRAMACAO_LABEL: Record<TipoProgramacao, string> = {
  inspecao: "Inspeção da Frota",
  lubrificacao: "Lubrificação de Chassi e Reapertos",
  calibragem: "Calibragem de Pneus",
  lavagem: "Lavagem dos Caminhões",
};

export const TIPO_PROGRAMACAO_PERIODICIDADE: Record<TipoProgramacao, Periodicidade> = {
  inspecao: "quinzenal",
  lubrificacao: "semanal",
  calibragem: "semanal",
  lavagem: "semanal",
};

// Frota "pesada" (categoria PESADA, status != Inativo) — base real dos 24 caminhões,
// igual em todas as 4 programações. Ver auditoria: categoria PESADA cobre COMBOIO, PIPA,
// MULTIFUNCIONAL, MUNCK e SKID — uma lista fixa de "tipos de caminhão" (como a usada antes
// no Checklist Mecânicos) ficava de fora do SKID e por isso mostrava 22 em vez de 24.
export function getFrotaPesadaAtiva(equipamentos: any[]): VeiculoFrotaPesada[] {
  return (equipamentos || [])
    .filter(e => String(e.categoria || "").toUpperCase().trim() === "PESADA")
    .filter(e => String(e.status || "").toUpperCase().trim() !== "INATIVO")
    .map(e => ({
      id: e.id,
      placa: String(e.placa || "").toUpperCase().trim(),
      modelo: e.modelo || null,
      tipo: e.tipo || null,
      categoria: e.categoria || null,
      modulo: e.modulo || null,
      area: e.area || null,
      status: e.status || null,
    }))
    .filter(e => e.placa)
    .sort((a, b) => a.placa.localeCompare(b.placa));
}
