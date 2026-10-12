// Constantes compartilhadas entre server actions e componentes client. Ficam fora de
// actions.ts de propósito: um arquivo "use server" só pode exportar funções async — o
// mesmo motivo que levou a extrair app/custos/config.ts nesta mesma base de código.

export type InsumoTipo =
  | "DIESEL_T1" | "DIESEL_T2" | "CORRENTE" | "GRAXA" | "TRANSMISSAO"
  | "FLUIDO" | "HIDRAULICO_MOTOR" | "DIFERENCIAL" | "ARLA";

export const INSUMO_TIPOS: InsumoTipo[] = [
  "DIESEL_T1", "DIESEL_T2", "CORRENTE", "GRAXA", "TRANSMISSAO", "FLUIDO", "HIDRAULICO_MOTOR", "DIFERENCIAL", "ARLA",
];

// Rótulo genérico (fallback), usado só quando ainda não existe nenhum material cadastrado
// pra essa aplicação — assim que houver um, labelMaterialInsumo() usa o nome de verdade.
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

// Aplicação (cadastro de Materiais) correspondente a cada linha fixa da ficha — usada pra
// buscar o nome de verdade do material em vez do rótulo genérico acima.
export const APLICACAO_POR_INSUMO: Record<InsumoTipo, string> = {
  DIESEL_T1: "DIESEL", DIESEL_T2: "DIESEL", CORRENTE: "CORRENTE", GRAXA: "GRAXA",
  TRANSMISSAO: "TRANSMISSAO", FLUIDO: "FLUIDO", HIDRAULICO_MOTOR: "HIDRAULICO_MOTOR",
  DIFERENCIAL: "DIFERENCIAL", ARLA: "ADITIVO",
};

// Nome exibido em toda a aba pra cada linha de insumo — sempre o nome do material cadastrado
// (o mesmo nome que aparece em Cadastros > Materiais e na Ficha de Recarga), nunca um rótulo
// inventado só pra essa tela. Só cai no rótulo genérico se a aplicação ainda não tiver
// nenhum material ativo cadastrado.
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

// Unidade do material cadastrado pra essa linha (L, KG, UN...), mesma lógica de
// resolução por aplicação usada em labelMaterialInsumo.
export function unidadeMaterialInsumo(
  tipo: InsumoTipo,
  materiais: { unidade: string; aplicacao: string; ativo?: boolean }[]
): string {
  const material = materiais.find((m) => m.aplicacao === APLICACAO_POR_INSUMO[tipo] && m.ativo !== false);
  return material?.unidade || "";
}
