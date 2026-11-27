import { describe, it, expect } from 'vitest'
import { franquiaDe, limiteFrota, resumirPorFranquia, resumirPorArea, FRANQUIAS_KM } from '@/lib/franquia-km'

describe('franquias do contrato (item 2.4)', () => {
  it('limites da frota batem com o contrato', () => {
    const lim = Object.fromEntries(FRANQUIAS_KM.map(f => [f.chave, limiteFrota(f)]))
    expect(lim).toEqual({ 'PIPA|COLHEITA': 15000, 'COMBOIO|COLHEITA': 27000, 'COMBOIO|CARREGAMENTO': 6750, 'MUNCK|COLHEITA': 15000 })
  })
  it('acha a franquia por tipo + área (ignora caixa/espaço)', () => {
    expect(franquiaDe(' pipa ', 'colheita')?.kmPorVeiculo).toBe(2500)
    expect(franquiaDe('COMBOIO', 'CARREGAMENTO')?.veiculosContrato).toBe(2)
    expect(franquiaDe('MUNCK', 'CARREGAMENTO')).toBeNull()
    expect(franquiaDe('SKID', 'COLHEITA')).toBeNull()
  })
})

describe('resumirPorFranquia', () => {
  it('excedente é da frota (média), não da placa', () => {
    // Pipa: uma placa rodou 4.000 (acima de 2.500), mas a frota soma 10.000 < 15.000 → sem excedente.
    const g = resumirPorFranquia([
      { placa: 'A', tipo: 'PIPA', area: 'COLHEITA', km: 4000 },
      { placa: 'B', tipo: 'PIPA', area: 'COLHEITA', km: 6000 },
      { placa: 'C', tipo: 'PIPA', area: 'COLHEITA', km: null },
    ]).find(x => x.chave === 'PIPA|COLHEITA')!
    expect(g.kmRodado).toBe(10000)
    expect(g.placas).toBe(3)
    expect(g.comKm).toBe(2)
    expect(g.mediaPorVeiculo).toBeCloseTo(10000 / 6)
    expect(g.excedente).toBe(0)
    expect(g.pctLimite).toBeCloseTo(66.67, 1)
  })
  it('passa do limite → excedente = KM rodado − limite', () => {
    const g = resumirPorFranquia([
      { placa: 'A', tipo: 'COMBOIO', area: 'CARREGAMENTO', km: 4000 },
      { placa: 'B', tipo: 'COMBOIO', area: 'CARREGAMENTO', km: 3500 },
    ]).find(x => x.chave === 'COMBOIO|CARREGAMENTO')!
    expect(g.excedente).toBe(750) // 7.500 − 6.750
    expect(g.mediaPorVeiculo).toBe(3750) // (3.750 − 3.375) × 2 = 750
  })
  it('grupo sem franquia aparece separado, sem excedente', () => {
    const r = resumirPorFranquia([{ placa: 'X', tipo: 'MUNCK', area: 'CARREGAMENTO', km: 787 }])
    const g = r.find(x => x.chave === 'MUNCK|CARREGAMENTO')!
    expect(g.franquia).toBeNull()
    expect(g.kmRodado).toBe(787)
    expect(g.excedente).toBeNull()
    // as 4 franquias do contrato sempre aparecem (mesmo sem placa no filtro), na ordem do contrato
    expect(r.slice(0, 4).map(x => x.chave)).toEqual(FRANQUIAS_KM.map(f => f.chave))
  })
  it('resumo por área soma limite/excedente e separa KM sem franquia', () => {
    const grupos = resumirPorFranquia([
      { placa: 'A', tipo: 'COMBOIO', area: 'CARREGAMENTO', km: 7000 },
      { placa: 'B', tipo: 'MUNCK', area: 'CARREGAMENTO', km: 500 },
      { placa: 'C', tipo: 'MUNCK', area: 'COLHEITA', km: 16000 },
    ])
    const areas = resumirPorArea(grupos)
    expect(areas.map(a => a.area)).toEqual(['COLHEITA', 'CARREGAMENTO'])
    expect(areas[0]).toMatchObject({ kmRodado: 16000, limite: 15000 + 15000 + 27000, excedente: 1000, kmSemFranquia: 0 })
    expect(areas[1]).toMatchObject({ kmRodado: 7000, limite: 6750, excedente: 250, kmSemFranquia: 500 })
  })
})
