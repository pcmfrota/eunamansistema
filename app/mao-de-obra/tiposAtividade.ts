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

/**
 * "tempo_gasto_minutos" (coluna real, sempre presente em qualquer apontamento sincronizado)
 * é a fonte de verdade — "tempo_gasto" (string "HH:MM") não existe no banco, é só
 * conveniência de exibição enquanto o rascunho está sendo editado no cliente.
 */
export function formatMinutos(minutos?: number | null): string {
  const total = Math.max(0, Math.round(minutos || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
