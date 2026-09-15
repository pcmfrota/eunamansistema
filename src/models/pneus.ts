// Escala de sulco (mm) em 3 faixas — fonte única usada por todo o módulo de Pneus (telas,
// esquema, PDF, filtros, dashboard): até 4mm é crítico (troca imediata), de 5 a 6mm entra em
// recapagem, acima de 6mm está bom.
export type CondicaoPneu = 'BOM' | 'RECAPAGEM' | 'CRITICO';

export function condicaoPorSulco(v: number | null | undefined): CondicaoPneu {
  if (v == null) return 'BOM';
  if (v <= 4) return 'CRITICO';
  if (v <= 6) return 'RECAPAGEM';
  return 'BOM';
}

// Posições base (Sulco 2 / meio) de cada pneu — é só esse valor que entra no cálculo da
// condição geral. Sulco 1 (direito) e Sulco 3 (esquerdo) ficam de fora de propósito: são
// medidas de apoio pra enxergar desgaste irregular na aba Sulcos Detalhados, mas tornavam a
// condição imprevisível quando um deles vinha pior que o meio sem o operador perceber.
const CAMPOS_MEIO = ['de', 'dd', 'tei', 'tee', 'tdi', 'tde', 'tei1', 'tee1', 'tdi1', 'tde1', 'estepe'] as const;

export function calcCondicaoPneu(posicoes: Record<string, number | null | undefined>): CondicaoPneu {
  const vals = CAMPOS_MEIO
    .map(k => posicoes[k])
    .filter((v): v is number => v != null);
  if (!vals.length) return 'BOM';
  return condicaoPorSulco(Math.min(...vals));
}

// Normaliza qualquer valor gravado (inclusive rótulos antigos de antes dessa escala de 3
// faixas — REGULAR, ATENCAO, TROCAR — e sinônimos aceitos na importação por Excel) pro
// conjunto atual de 3 condições. Sem isso, boletins já lançados ficariam sem bater com
// nenhuma cor/filtro depois da mudança de escala.
const SINONIMOS_CONDICAO: Record<string, CondicaoPneu> = {
  BOM: 'BOM', BOA: 'BOM', GOOD: 'BOM', OK: 'BOM', OTIMO: 'BOM', EXCELENTE: 'BOM', NOVO: 'BOM',
  RECAPAGEM: 'RECAPAGEM', REGULAR: 'RECAPAGEM', REG: 'RECAPAGEM', ATENCAO: 'RECAPAGEM', WATCH: 'RECAPAGEM', MODERADO: 'RECAPAGEM',
  CRITICO: 'CRITICO', CRITICA: 'CRITICO', CRITICAL: 'CRITICO', URGENTE: 'CRITICO', ALERTA: 'CRITICO',
  TROCAR: 'CRITICO', REPLACE: 'CRITICO', SUBSTITUIR: 'CRITICO', RUIM: 'CRITICO', MAU: 'CRITICO',
  DESGASTADO: 'CRITICO', SUCATA: 'CRITICO',
};

export function normalizarCondicaoPneu(raw: string | null | undefined, fallback: CondicaoPneu = 'BOM'): CondicaoPneu {
  if (!raw || !raw.trim()) return fallback;
  const clean = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  return SINONIMOS_CONDICAO[clean] ?? fallback;
}

// Cor por leitura de sulco (mm), em hex — usada nas caixinhas do esquema (tela e PDF).
export function corSulcoHex(v: number | null | undefined): string {
  if (v == null) return '#d4d4d8';
  const c = condicaoPorSulco(v);
  return c === 'CRITICO' ? '#ef4444' : c === 'RECAPAGEM' ? '#facc15' : '#10b981';
}

// Mesma leitura, em classes Tailwind — usada nas caixinhas do esquema em tela e nas tabelas.
export function sulcoTailwind(v: number | null | undefined): string {
  if (v == null) return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400';
  const c = condicaoPorSulco(v);
  if (c === 'CRITICO') return 'bg-red-500 text-white';
  if (c === 'RECAPAGEM') return 'bg-yellow-400 text-zinc-900';
  return 'bg-emerald-500 text-white';
}

export const CONDICAO_LABEL: Record<CondicaoPneu, string> = {
  BOM: 'BOM', RECAPAGEM: 'RECAPAGEM', CRITICO: 'CRÍTICO',
};

// Classes de badge (fundo + texto + borda) por condição já normalizada.
export const CONDICAO_BADGE_CLASSES: Record<CondicaoPneu, string> = {
  BOM: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-900/30',
  RECAPAGEM: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-400 dark:border-yellow-900/30',
  CRITICO: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-400 dark:border-red-900/30',
};

export const CONDICAO_DOT_CLASSES: Record<CondicaoPneu, string> = {
  BOM: 'bg-emerald-500', RECAPAGEM: 'bg-yellow-400', CRITICO: 'bg-red-500',
};

export const CONDICAO_HEX: Record<CondicaoPneu, string> = {
  BOM: '#22c55e', RECAPAGEM: '#facc15', CRITICO: '#ef4444',
};

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
