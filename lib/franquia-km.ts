// Franquia de quilometragem da frota (contrato Suzano, item 2.4) — puro, sem React/Supabase.
//
// "Cada frota de veículos da operação tem suas franquias de quilometragem mensal específicas;
//  em caso de utilização que extrapole esse limite será cobrado a tarifa de KM excedente.
//  Para efeito de cobrança será considerada a média rodada da frota por período mensal e
//  tipo de equipamento."
//
// Logo, o excedente é por GRUPO (tipo + área), não por placa:
//   limite da frota = franquia por veículo × veículos do contrato
//   média rodada    = KM rodado do grupo ÷ veículos do contrato
//   excedente       = max(0, KM rodado do grupo − limite da frota)   (= (média − franquia) × veículos)

export type Franquia = {
  chave: string
  rotulo: string
  /** equipamentos.tipo (maiúsculo) */
  tipo: string
  /** equipamentos.area (maiúsculo): COLHEITA ou CARREGAMENTO */
  area: string
  kmPorVeiculo: number
  veiculosContrato: number
}

export const FRANQUIAS_KM: Franquia[] = [
  { chave: 'PIPA|COLHEITA', rotulo: 'Caminhões Pipa', tipo: 'PIPA', area: 'COLHEITA', kmPorVeiculo: 2500, veiculosContrato: 6 },
  { chave: 'COMBOIO|COLHEITA', rotulo: 'Comboio Colheita (módulo)', tipo: 'COMBOIO', area: 'COLHEITA', kmPorVeiculo: 3375, veiculosContrato: 8 },
  { chave: 'COMBOIO|CARREGAMENTO', rotulo: 'Comboio Carregamento (frentes)', tipo: 'COMBOIO', area: 'CARREGAMENTO', kmPorVeiculo: 3375, veiculosContrato: 2 },
  { chave: 'MUNCK|COLHEITA', rotulo: 'Munck Colheita', tipo: 'MUNCK', area: 'COLHEITA', kmPorVeiculo: 5000, veiculosContrato: 3 },
]

const norm = (s: string | null | undefined) => String(s || '').trim().toUpperCase()

export const limiteFrota = (f: Franquia) => f.kmPorVeiculo * f.veiculosContrato

export function franquiaDe(tipo: string | null | undefined, area: string | null | undefined): Franquia | null {
  const t = norm(tipo), a = norm(area)
  return FRANQUIAS_KM.find(f => f.tipo === t && f.area === a) ?? null
}

export type ItemKm = { placa: string; tipo: string | null; area: string | null; /** KM rodado no período; null = sem KM calculável */ km: number | null }

export type ResumoGrupo = {
  chave: string
  rotulo: string
  tipo: string
  area: string
  franquia: Franquia | null
  /** Placas do grupo no filtro / com KM calculável no período. */
  placas: number
  comKm: number
  kmRodado: number
  /** Só grupos com franquia: */
  limite: number | null
  mediaPorVeiculo: number | null
  excedente: number | null
  /** % do limite usado (100 = no limite). */
  pctLimite: number | null
}

/** Resumo por tipo + área. Grupos com franquia primeiro (na ordem do contrato), depois os sem franquia. */
export function resumirPorFranquia(itens: ItemKm[]): ResumoGrupo[] {
  const grupos = new Map<string, ResumoGrupo>()
  for (const f of FRANQUIAS_KM) {
    grupos.set(f.chave, {
      chave: f.chave, rotulo: f.rotulo, tipo: f.tipo, area: f.area, franquia: f,
      placas: 0, comKm: 0, kmRodado: 0, limite: limiteFrota(f), mediaPorVeiculo: 0, excedente: 0, pctLimite: 0,
    })
  }
  for (const it of itens) {
    const f = franquiaDe(it.tipo, it.area)
    const chave = f?.chave ?? `${norm(it.tipo) || 'SEM TIPO'}|${norm(it.area) || 'SEM ÁREA'}`
    let g = grupos.get(chave)
    if (!g) {
      g = { chave, rotulo: `${norm(it.tipo) || 'Sem tipo'} · ${norm(it.area) || 'sem área'}`, tipo: norm(it.tipo), area: norm(it.area), franquia: null,
        placas: 0, comKm: 0, kmRodado: 0, limite: null, mediaPorVeiculo: null, excedente: null, pctLimite: null }
      grupos.set(chave, g)
    }
    g.placas++
    if (it.km != null) { g.comKm++; g.kmRodado += it.km }
  }
  grupos.forEach(g => {
    if (!g.franquia || g.limite == null) return
    g.mediaPorVeiculo = g.kmRodado / g.franquia.veiculosContrato
    g.excedente = Math.max(0, g.kmRodado - g.limite)
    g.pctLimite = g.limite > 0 ? (g.kmRodado / g.limite) * 100 : null
  })
  const ordem = FRANQUIAS_KM.map(f => f.chave)
  return Array.from(grupos.values())
    .filter(g => g.franquia || g.placas > 0)
    .sort((a, b) => {
      const ia = ordem.indexOf(a.chave), ib = ordem.indexOf(b.chave)
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      return a.rotulo.localeCompare(b.rotulo)
    })
}

export type ResumoArea = { area: string; kmRodado: number; limite: number; excedente: number; kmSemFranquia: number }

/** Totais por área (COLHEITA, CARREGAMENTO, ...). */
export function resumirPorArea(grupos: ResumoGrupo[]): ResumoArea[] {
  const m = new Map<string, ResumoArea>()
  for (const g of grupos) {
    const a = g.area || 'SEM ÁREA'
    const r = m.get(a) ?? { area: a, kmRodado: 0, limite: 0, excedente: 0, kmSemFranquia: 0 }
    if (g.franquia) { r.kmRodado += g.kmRodado; r.limite += g.limite ?? 0; r.excedente += g.excedente ?? 0 }
    else r.kmSemFranquia += g.kmRodado
    m.set(a, r)
  }
  const pri = ['COLHEITA', 'CARREGAMENTO']
  return Array.from(m.values()).sort((x, y) => {
    const ix = pri.indexOf(x.area), iy = pri.indexOf(y.area)
    return (ix < 0 ? 9 : ix) - (iy < 0 ? 9 : iy) || x.area.localeCompare(y.area)
  })
}
