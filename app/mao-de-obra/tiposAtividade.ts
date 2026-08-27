export type TipoAtividade = { label: string; produtivo: boolean };

export const TIPOS_ATIVIDADE: TipoAtividade[] = [
  { label: "Manutenção Corretiva", produtivo: true },
  { label: "Manutenção Preventiva", produtivo: true },
  { label: "Diagnóstico / Inspeção", produtivo: true },
  { label: "Deslocamento", produtivo: true },
  { label: "Reunião / Briefing", produtivo: true },
  { label: "Treinamento", produtivo: true },
  { label: "Aguardando Peça", produtivo: false },
  { label: "Aguardando Liberação / Autorização", produtivo: false },
  { label: "Pausa / Almoço", produtivo: false },
  { label: "Ocioso / Sem Atividade", produtivo: false },
  { label: "Outro", produtivo: false },
];

export function isAtividadeProdutiva(tipo: string | undefined | null): boolean {
  return TIPOS_ATIVIDADE.find(t => t.label === tipo)?.produtivo ?? false;
}
