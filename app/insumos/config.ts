// Constantes compartilhadas entre server actions e componentes client. Ficam fora de
// actions.ts de propósito: um arquivo "use server" só pode exportar funções async — o
// mesmo motivo que levou a extrair app/custos/config.ts nesta mesma base de código.

export type InsumoTipo =
  | "DIESEL_T1" | "DIESEL_T2" | "CORRENTE" | "GRAXA" | "TRANSMISSAO"
  | "FLUIDO" | "HIDRAULICO_MOTOR" | "DIFERENCIAL" | "ARLA";

export const INSUMO_TIPOS: InsumoTipo[] = [
  "DIESEL_T1", "DIESEL_T2", "CORRENTE", "GRAXA", "TRANSMISSAO", "FLUIDO", "HIDRAULICO_MOTOR", "DIFERENCIAL", "ARLA",
];

export const INSUMO_LABEL: Record<InsumoTipo, string> = {
  DIESEL_T1: "Diesel Tanque 1°",
  DIESEL_T2: "Diesel Tanque 2°",
  CORRENTE: "Corrente",
  GRAXA: "Graxa",
  TRANSMISSAO: "85W140 / Transmissão",
  FLUIDO: "Fluido de Radiador",
  HIDRAULICO_MOTOR: "Hidráulico / Motor",
  DIFERENCIAL: "85W140 LS / Diferencial",
  ARLA: "Arla",
};
