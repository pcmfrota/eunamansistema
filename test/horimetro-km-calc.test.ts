import { describe, it, expect } from 'vitest'
import {
  calcularUso, classificarLeituras, periodoAnterior, periodoComparacao, periodoDoAtalho, statusLeitura,
  variacaoPercentual, montarLinhas, serieTemporal, calcularKpis, diasEntre, diaLocalSP,
  listarMeses, fmtNum, fmtData, usoValido, type LeituraBruta, type EquipamentoAtivo,
} from '@/lib/horimetro-km-calc'

/*
 * PLACA DE TESTE 1 — PESADO (horímetro), período 01/10/2026 a 30/11/2026
 *   20/09  1.000 h  (antes do período → NÃO entra no uso)
 *   05/10  1.100 h  (primeira leitura do período)
 *   25/10  1.250 h
 *   10/11  1.240 h  (regressiva → inconsistência, ignorada)
 *   20/11  1.400 h  (última leitura do período)
 * Cálculo manual (só leituras dentro do período):
 *   uso = 1.400 − 1.100 = 300 h
 *   outubro = 1.250−1.100 = 150 h ; novembro = 1.400−1.250 = 150 h
 *   meses com leitura = 2 → média mensal = 300 ÷ 2 = 150 h ; projeção anual = 150 × 12 = 1.800 h
 *   dias corridos 05/10 → 20/11 = 46 → média diária = 300 ÷ 46 ≈ 6,52 h/dia
 *   média anual (um só ano) = 300 h
 *
 * PLACA DE TESTE 2 — LEVE (KM), período 01/11/2026 a 30/11/2026, sem leitura anterior
 *   02/11 50.000 km ; 12/11 50.300 km ; 22/11 51.000 km
 * Cálculo manual:
 *   uso = 51.000 − 50.000 = 1.000 km ; 1 mês → média mensal 1.000 km ; projeção 12.000 km
 *   dias 02/11 → 22/11 = 20 → média diária 50 km/dia
 */
const placa1 = [
  { data: '2026-09-20', valor: 1000 },
  { data: '2026-10-05', valor: 1100 },
  { data: '2026-10-25', valor: 1250 },
  { data: '2026-11-10', valor: 1240 },
  { data: '2026-11-20', valor: 1400 },
]
const placa2 = [
  { data: '2026-11-12', valor: 50300 },
  { data: '2026-11-02', valor: 50000 },
  { data: '2026-11-22', valor: 51000 },
]

describe('calcularUso — placas de teste conferidas à mão', () => {
  it('placa 1 (pesado, leitura antes do período fora do cálculo, uma regressiva)', () => {
    const r = calcularUso(placa1, '2026-10-01', '2026-11-30')
    expect(r.leituraInicial).toBe(1100)
    expect(r.dataInicial).toBe('2026-10-05')
    expect(r.leituraFinal).toBe(1400)
    expect(r.uso).toBe(300)
    expect(r.insuficiente).toBe(false)
    expect(r.usoPorMes).toEqual({ '2026-10': 150, '2026-11': 150 })
    expect(r.mesesComLeitura).toBe(2)
    expect(r.mediaMensal).toBe(150)
    expect(r.projecaoAnual).toBe(1800)
    expect(r.mediaDiaria).toBeCloseTo(300 / 46, 6)
    expect(r.mediaAnual).toBe(300)
    expect(r.inconsistencias).toBe(1)
    expect(r.ultimaLeitura).toBe('2026-11-20')
  })

  it('placa 2 (leve, sem base anterior, leituras fora de ordem)', () => {
    const r = calcularUso(placa2, '2026-11-01', '2026-11-30')
    expect(r.uso).toBe(1000)
    expect(r.leituraInicial).toBe(50000)
    expect(r.mediaMensal).toBe(1000)
    expect(r.projecaoAnual).toBe(12000)
    expect(r.mediaDiaria).toBe(50)
    expect(r.inconsistencias).toBe(0)
  })

  it('soma dos meses é igual ao uso', () => {
    const r = calcularUso(placa1, '2026-10-01', '2026-11-30')
    expect(Object.values(r.usoPorMes).reduce((s, v) => s + v, 0)).toBe(r.uso)
  })

  it('período sem leitura: uso 0, médias nulas e última leitura anterior preservada', () => {
    const r = calcularUso(placa1, '2026-12-01', '2026-12-31')
    expect(r.temLeituraNoPeriodo).toBe(false)
    expect(r.uso).toBe(0)
    expect(r.mediaMensal).toBeNull()
    expect(r.ultimaLeitura).toBe('2026-11-20')
  })

  it('ignora leituras depois do fim do período', () => {
    const r = calcularUso(placa1, '2026-10-01', '2026-10-31')
    expect(r.uso).toBe(150)
    expect(r.leituraFinal).toBe(1250)
  })

  it('uma única leitura no período (mesmo com leitura antes): insuficiente, sem uso nem médias', () => {
    const r = calcularUso([{ data: '2026-10-06', valor: 900 }, { data: '2026-11-19', valor: 1000 }], '2026-11-01', '2026-11-30')
    expect(r.temLeituraNoPeriodo).toBe(true)
    expect(r.insuficiente).toBe(true)
    expect(r.uso).toBe(0)
    expect(usoValido(r)).toBeNull()
    expect(r.leituraInicial).toBe(1000)
    expect(r.mediaDiaria).toBeNull()
    expect(r.mediaMensal).toBeNull()
    expect(r.projecaoAnual).toBeNull()
  })
})

describe('classificarLeituras', () => {
  it('compara com a última leitura VÁLIDA, não com a regressiva', () => {
    const c = classificarLeituras([
      { data: '2026-01-01', valor: 100 },
      { data: '2026-01-02', valor: 90 },
      { data: '2026-01-03', valor: 95 },
      { data: '2026-01-04', valor: 120 },
    ])
    expect(c.map(p => p.inconsistente)).toEqual([false, true, true, false])
    expect(c[3].diferenca).toBe(20)
  })

  it('desempata leituras do mesmo dia pela ordem de registro', () => {
    const c = classificarLeituras([
      { data: '2026-01-01', valor: 110, ordem: '2026-01-01T15:00' },
      { data: '2026-01-01', valor: 100, ordem: '2026-01-01T09:00' },
    ])
    expect(c.map(p => p.valor)).toEqual([100, 110])
    expect(c.some(p => p.inconsistente)).toBe(false)
  })
})

describe('períodos', () => {
  it('atalhos', () => {
    expect(periodoDoAtalho('mes-atual', '2026-11-23')).toEqual({ inicio: '2026-11-01', fim: '2026-11-30' })
    expect(periodoDoAtalho('mes-anterior', '2026-01-10')).toEqual({ inicio: '2025-12-01', fim: '2025-12-31' })
    expect(periodoDoAtalho('ultimos-3-meses', '2026-02-15')).toEqual({ inicio: '2025-12-01', fim: '2026-02-28' })
    expect(periodoDoAtalho('ano-anterior', '2026-11-23')).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' })
  })

  it('período anterior equivalente', () => {
    expect(periodoAnterior({ inicio: '2026-11-01', fim: '2026-11-30' })).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
    expect(periodoAnterior({ inicio: '2026-09-01', fim: '2026-11-30' })).toEqual({ inicio: '2026-06-01', fim: '2026-08-31' })
    expect(periodoAnterior({ inicio: '2026-01-01', fim: '2026-12-31' })).toEqual({ inicio: '2025-01-01', fim: '2025-12-31' })
    // intervalo livre: mesmo número de dias, terminando na véspera
    expect(periodoAnterior({ inicio: '2026-10-28', fim: '2026-11-26' })).toEqual({ inicio: '2026-09-28', fim: '2026-10-27' })
  })

  it('utilitários de data', () => {
    expect(diasEntre('2026-02-27', '2026-03-01')).toBe(2)
    expect(listarMeses('2026-11-15', '2027-01-03')).toEqual(['2026-11', '2026-12', '2027-01'])
    expect(diaLocalSP('2026-11-18T02:30:00Z')).toBe('2026-11-17') // 23h30 em Brasília
  })
})

describe('período de comparação escolhido', () => {
  const nov = { inicio: '2026-11-01', fim: '2026-11-30' }
  it('anterior = mês anterior', () => {
    expect(periodoComparacao(nov, 'anterior')).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })
  it('mesmo período do ano anterior (inclusive fevereiro bissexto)', () => {
    expect(periodoComparacao(nov, 'ano-anterior')).toEqual({ inicio: '2025-11-01', fim: '2025-11-30' })
    expect(periodoComparacao({ inicio: '2028-02-01', fim: '2028-02-29' }, 'ano-anterior')).toEqual({ inicio: '2027-02-01', fim: '2027-02-28' })
    expect(periodoComparacao({ inicio: '2027-02-01', fim: '2027-02-28' }, 'ano-anterior')).toEqual({ inicio: '2026-02-01', fim: '2026-02-28' })
    expect(periodoComparacao({ inicio: '2026-03-10', fim: '2026-04-15' }, 'ano-anterior')).toEqual({ inicio: '2025-03-10', fim: '2025-04-15' })
  })
  it('datas livres; inválidas caem no período anterior', () => {
    expect(periodoComparacao(nov, 'custom', { inicio: '2026-01-01', fim: '2026-06-30' })).toEqual({ inicio: '2026-01-01', fim: '2026-06-30' })
    expect(periodoComparacao(nov, 'custom', { inicio: '2026-06-30', fim: '2026-01-01' })).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
    expect(periodoComparacao(nov, 'custom', {})).toEqual({ inicio: '2026-10-01', fim: '2026-10-31' })
  })
})

describe('status, variação e formatação', () => {
  it('status', () => {
    expect(statusLeitura(1, 0, 7)).toBe('Inconsistente')
    expect(statusLeitura(0, 8, 7)).toBe('Atrasada')
    expect(statusLeitura(0, null, 7)).toBe('Atrasada')
    expect(statusLeitura(0, 7, 7)).toBe('Em dia')
  })
  it('variação %', () => {
    expect(variacaoPercentual(150, 100)).toBe(50)
    expect(variacaoPercentual(50, 100)).toBe(-50)
    expect(variacaoPercentual(10, 0)).toBeNull()
    expect(variacaoPercentual(10, null)).toBeNull()
  })
  it('pt-BR', () => {
    expect(fmtNum(14372)).toBe('14.372')
    expect(fmtNum(41328.3, 1)).toBe('41.328,3')
    expect(fmtData('2026-11-05')).toBe('05/11/2026')
  })
})

describe('montarLinhas + agregações', () => {
  const eqs: EquipamentoAtivo[] = [
    { id: 'e1', placa: 'PES0001', tipo: 'COMBOIO', categoria: 'PESADA', modulo: null },
    { id: 'e2', placa: 'LEV0001', tipo: 'STRADA', categoria: 'LEVE', modulo: null },
    { id: 'e3', placa: 'PES0002', tipo: 'PIPA', categoria: 'PESADA', modulo: null },
  ]
  const L = (id: string, eq: string, unidade: string, valor: number, data: string, km: number | null = null): LeituraBruta =>
    ({ id, equipamento_id: eq, unidade, valor_novo: valor, km_novo: km, data, ordem: data, por: null, obs: null })
  const leituras: LeituraBruta[] = [
    ...placa1.map((p, i) => L(`a${i}`, 'e1', 'h', p.valor, p.data, i === 4 ? 200500 : i === 2 ? 200000 : null)),
    ...placa2.map((p, i) => L(`b${i}`, 'e2', 'km', p.valor, p.data)),
  ]
  const periodo = { inicio: '2026-11-01', fim: '2026-11-30' }
  const linhas = montarLinhas(eqs, leituras, periodo, '2026-11-23', 7)

  it('classifica frota, separa horímetro e KM e calcula status', () => {
    const [p, l, semLeitura] = linhas
    expect(p.frota).toBe('pesado')
    // Em novembro o pesado só tem 1 leitura válida (1.240 é regressiva): insuficiente.
    expect(p.principal.insuficiente).toBe(true)
    expect(p.principal.uso).toBe(0)
    expect(p.km?.insuficiente).toBe(true) // só 200.500 em novembro
    expect(p.status).toBe('Inconsistente')
    expect(l.frota).toBe('leve')
    expect(l.principal.uso).toBe(1000)
    expect(l.diasSemLeitura).toBe(1)
    expect(l.status).toBe('Em dia')
    expect(semLeitura.status).toBe('Atrasada')
    expect(semLeitura.ultimaLeitura).toBeNull()
  })

  it('KPIs e série mensal', () => {
    const k = calcularKpis(linhas, 'mensal')
    expect(k.frotas).toBe(3)
    expect(k.horasTotais).toBe(0)
    expect(k.kmTotais).toBe(1000)
    expect(k.semLeitura).toBe(1)
    expect(k.inconsistencias).toBe(1)
    expect(serieTemporal(linhas, 'h', { inicio: '2026-10-01', fim: '2026-11-30' }, 'mensal'))
      .toEqual([{ chave: '2026-10', valor: 0 }, { chave: '2026-11', valor: 0 }])
    // Out–nov inteiro: 1.100 → 1.250 em outubro, 1.250 → 1.400 em novembro.
    const linhas2 = montarLinhas(eqs, leituras, { inicio: '2026-10-01', fim: '2026-11-30' }, '2026-11-23', 7)
    expect(serieTemporal(linhas2, 'h', { inicio: '2026-10-01', fim: '2026-11-30' }, 'mensal'))
      .toEqual([{ chave: '2026-10', valor: 150 }, { chave: '2026-11', valor: 150 }])
  })
})
