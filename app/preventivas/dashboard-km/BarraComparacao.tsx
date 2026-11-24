'use client'

import { GitCompareArrows } from 'lucide-react'
import { fmtData, type ModoComparacao, type Periodo } from '@/lib/horimetro-km-calc'
import { Segmentado } from './FiltrosBar'
import type { FiltrosDashboard } from './useFiltrosUrl'

const inputData = 'px-2 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500'

/** Rótulo curto usado nos cartões ("+12% vs. …"). */
export function rotuloComparacao(modo: ModoComparacao): string {
  return modo === 'ano-anterior' ? 'mesmo período do ano anterior' : modo === 'custom' ? 'período escolhido' : 'período anterior'
}

/**
 * Escolha do período de comparação dos KPIs: período imediatamente anterior, mesmo período
 * do ano anterior, ou datas escolhidas à mão.
 */
export default function BarraComparacao({ filtros, atualizar, periodo, comparacao }: {
  filtros: FiltrosDashboard
  atualizar: (p: Partial<FiltrosDashboard>) => void
  periodo: Periodo
  comparacao: Periodo
}) {
  const escolher = (modo: ModoComparacao) => {
    // Ao passar pra "Escolher datas", começa com as datas que já estavam sendo comparadas.
    if (modo === 'custom') atualizar({ cmp: 'custom', cmpIni: comparacao.inicio, cmpFim: comparacao.fim })
    else atualizar({ cmp: modo })
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-zinc-500">
        <GitCompareArrows size={14} /> Comparar com
      </span>
      <Segmentado<ModoComparacao> valor={filtros.cmp} onChange={escolher} opcoes={[
        { v: 'anterior', l: 'Período anterior' },
        { v: 'ano-anterior', l: 'Mesmo período do ano anterior' },
        { v: 'custom', l: 'Escolher datas' },
      ]} />
      {filtros.cmp === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
            De
            <input type="date" className={inputData} value={filtros.cmpIni} max={filtros.cmpFim || undefined}
              onChange={e => { if (e.target.value) atualizar({ cmpIni: e.target.value }) }} />
          </label>
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
            Até
            <input type="date" className={inputData} value={filtros.cmpFim} min={filtros.cmpIni || undefined}
              onChange={e => { if (e.target.value) atualizar({ cmpFim: e.target.value }) }} />
          </label>
        </div>
      )}
      <span className="text-xs text-zinc-500 tabular-nums sm:ml-auto">
        <b className="text-zinc-700 dark:text-zinc-200">{fmtData(periodo.inicio)} a {fmtData(periodo.fim)}</b>
        {' comparado com '}
        <b className="text-zinc-700 dark:text-zinc-200">{fmtData(comparacao.inicio)} a {fmtData(comparacao.fim)}</b>
      </span>
    </div>
  )
}
