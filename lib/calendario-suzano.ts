/**
 * Períodos operacionais Suzano ("RF'08", "RF'09", ...), tabela `calendario_suzano`.
 * Cada linha define um intervalo de datas civis arbitrário (data_inicio..data_fim) que
 * raramente coincide com o mês civil — por isso "a que mês/RF pertence esta data" nunca
 * pode ser derivado de `Date.getMonth()`, precisa checar contra esses intervalos.
 */

export type PeriodoSuzano = {
  ano: number | string
  mes: number | string
  data_inicio: string
  data_fim: string
}

export const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]

/** Período Suzano (linha de calendario_suzano) que contém a data informada, ou null se nenhum cadastrado cobre essa data. */
export function findPeriodoSuzano(dataISO: string | null | undefined, calendario: PeriodoSuzano[] | null | undefined): PeriodoSuzano | null {
  if (!dataISO) return null
  const data = dataISO.split('T')[0]
  if (!Array.isArray(calendario)) return null
  return calendario.find(p => p && p.data_inicio <= data && p.data_fim >= data) || null
}

/**
 * Mês/ano "operacional" de uma data: usa o período Suzano que contém a data quando
 * existe um cadastrado em `calendario_suzano`; só cai para o mês civil quando a data
 * não está coberta por nenhum período (ex: dado histórico anterior ao calendário).
 */
export function mesAnoOperacional(dataISO: string | null | undefined, calendario: PeriodoSuzano[] | null | undefined): { mes: string; ano: string } {
  const periodo = findPeriodoSuzano(dataISO, calendario)
  if (periodo) {
    return {
      mes: MONTHS_PT[Number(periodo.mes) - 1] || 'janeiro',
      ano: String(periodo.ano)
    }
  }

  if (!dataISO) return { mes: '', ano: '' }
  const d = new Date(dataISO)
  if (isNaN(d.getTime())) return { mes: '', ano: '' }
  return { mes: MONTHS_PT[d.getMonth()], ano: String(d.getFullYear()) }
}
