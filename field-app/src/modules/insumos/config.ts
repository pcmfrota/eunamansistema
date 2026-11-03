// Port verbatim de app/insumos/config.ts — já era puro TypeScript sem nenhuma
// dependência de Next.js/Server Actions, não precisou de nenhuma conversão.

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

export const APLICACAO_POR_INSUMO: Record<InsumoTipo, string> = {
  DIESEL_T1: "DIESEL", DIESEL_T2: "DIESEL", CORRENTE: "CORRENTE", GRAXA: "GRAXA",
  TRANSMISSAO: "TRANSMISSAO", FLUIDO: "FLUIDO", HIDRAULICO_MOTOR: "HIDRAULICO_MOTOR",
  DIFERENCIAL: "DIFERENCIAL", ARLA: "ADITIVO",
};

export function labelMaterialInsumo(
  tipo: InsumoTipo,
  materiais: { material: string; aplicacao: string; ativo?: boolean }[],
  temTanque2: boolean = false
): string {
  const material = materiais.find((m) => m.aplicacao === APLICACAO_POR_INSUMO[tipo] && m.ativo !== false);
  const nome = material?.material || INSUMO_LABEL[tipo];
  if (tipo === "DIESEL_T1") return temTanque2 ? `${nome} (Tanque 1°)` : nome;
  if (tipo === "DIESEL_T2") return `${nome} (Tanque 2°)`;
  return nome;
}

export function unidadeMaterialInsumo(
  tipo: InsumoTipo,
  materiais: { unidade: string; aplicacao: string; ativo?: boolean }[]
): string {
  const material = materiais.find((m) => m.aplicacao === APLICACAO_POR_INSUMO[tipo] && m.ativo !== false);
  return material?.unidade || "";
}
