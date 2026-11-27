// Regras do Controle de Baterias — puro (sem React/Supabase) pra ser usado na tela,
// nas server actions e nos testes.

export type SituacaoGarantia = 'ativa' | 'proxima' | 'vencida'

/** Vencimento dentro desta quantidade de dias = "próxima do vencimento". */
export const DIAS_ALERTA_GARANTIA = 30

export const BUCKET_CERTIFICADOS = 'baterias-certificados'
export const TIPOS_CERTIFICADO = ['application/pdf', 'image/jpeg', 'image/png'] as const
export const EXTENSOES_CERTIFICADO = '.pdf,.jpg,.jpeg,.png'
export const TAMANHO_MAX_CERTIFICADO = 10 * 1024 * 1024

export type Bateria = {
  id: string
  modelo: string
  numero_serie: string
  fornecedor: string
  data_venda: string
  data_vencimento_garantia: string
  garantia_dias?: number | null
  certificado_path: string | null
  certificado_nome: string | null
  certificado_tipo: string | null
  observacoes: string | null
  criado_por: string | null
  criado_por_nome: string | null
  atualizado_por?: string | null
  atualizado_por_nome?: string | null
  filial_id: string
  created_at?: string
  updated_at?: string
  /** Só no aparelho: lançamento offline aguardando sincronização. */
  _isPendingSync?: boolean
  /** Só no aparelho: certificado escolhido offline (data URL) ainda não enviado. */
  _certificadoLocal?: { dataUrl: string; nome: string; tipo: string } | null
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
const utc = (iso: string) => {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

/** Data de hoje (aaaa-mm-dd) no fuso local do aparelho. */
export function hojeIso(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
}

/** Dias corridos de `de` até `ate` (pode ser negativo). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((utc(ate) - utc(de)) / 86400000)
}

/** Período de garantia: dias entre a venda e o vencimento (não os dias restantes). */
export function garantiaDias(dataVenda: string, dataVencimento: string): number | null {
  if (!ISO.test(dataVenda || '') || !ISO.test(dataVencimento || '')) return null
  return diasEntre(dataVenda, dataVencimento)
}

/** Dias que faltam até o vencimento (negativo = já venceu). */
export function diasRestantes(dataVencimento: string, hoje: string = hojeIso()): number {
  return diasEntre(hoje, dataVencimento)
}

/**
 * Situação na data de hoje:
 * - vencida: hoje depois do vencimento;
 * - próxima: vence em até 30 dias (inclusive hoje);
 * - ativa: vence depois disso.
 */
export function situacaoGarantia(dataVencimento: string, hoje: string = hojeIso()): SituacaoGarantia {
  const r = diasRestantes(dataVencimento, hoje)
  if (r < 0) return 'vencida'
  if (r <= DIAS_ALERTA_GARANTIA) return 'proxima'
  return 'ativa'
}

export const SITUACAO_LABEL: Record<SituacaoGarantia, string> = {
  ativa: 'Garantia ativa',
  proxima: 'Próxima do vencimento',
  vencida: 'Garantia vencida',
}

export type DadosBateria = {
  modelo: string
  numero_serie: string
  fornecedor: string
  data_venda: string
  data_vencimento_garantia: string
}

/** Validação dos campos obrigatórios — mesma regra na tela e no servidor. */
export function validarBateria(d: Partial<DadosBateria>): string | null {
  if (!d.modelo?.trim()) return 'Informe o modelo da bateria.'
  if (!d.numero_serie?.trim()) return 'Informe o número de série.'
  if (!d.fornecedor?.trim()) return 'Informe o fornecedor.'
  if (!d.data_venda || !ISO.test(d.data_venda)) return 'Informe a data da venda.'
  if (!d.data_vencimento_garantia || !ISO.test(d.data_vencimento_garantia)) return 'Informe a data de vencimento da garantia.'
  if (d.data_vencimento_garantia <= d.data_venda) return 'O vencimento da garantia deve ser depois da data da venda.'
  return null
}

/** Número de série comparável (sem espaços nas pontas, maiúsculo) — igual ao índice único do banco. */
export const chaveSerie = (s: string) => s.trim().toUpperCase()

/** Nome seguro pro caminho no Storage. */
export function nomeArquivoSeguro(nome: string): string {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_')
  return base.slice(-80) || 'certificado'
}

/** Opções rápidas de garantia (meses) no cadastro. */
export const PRAZOS_GARANTIA_MESES = [3, 6, 12, 24] as const

/**
 * Data da venda + N meses (mesmo dia; se o mês não tiver o dia, usa o último dia do mês).
 * Ex.: 06/11/2026 + 12 = 06/11/2027; 31/08/2026 + 6 = 28/02/2027.
 */
export function somarMeses(dataIso: string, meses: number): string | null {
  if (!ISO.test(dataIso || '')) return null
  const [a, m, d] = dataIso.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimoDia))
  return alvo.toISOString().slice(0, 10)
}
