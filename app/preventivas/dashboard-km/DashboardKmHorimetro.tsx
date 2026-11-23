'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCcw, Info } from 'lucide-react'
import {
  montarLinhas, calcularKpis, periodoAnterior, somarDias, tipoFrota, fmtData,
  type LinhaPlaca, type Unidade,
} from '@/lib/horimetro-km-calc'
import { useFiltrosUrl, hojeLocal } from './useFiltrosUrl'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import FiltrosBar, { Segmentado } from './FiltrosBar'
import KpiCards, { KpiSkeleton } from './KpiCards'
import { CardGrafico, UsoMensalChart, RankingChart, UsoPorTipoChart, EvolucaoChart } from './Graficos'
import TabelaAnalitica from './TabelaAnalitica'
import DrawerPlaca from './DrawerPlaca'
import { exportarDashboard } from './exportar'
import EditarLeituraModal, { type LeituraEditavel } from '../EditarLeituraModal'

// Busca leituras desde ~3 meses antes do período de comparação, pra achar a "última
// leitura antes do início" (base do cálculo) sem baixar o histórico inteiro.
const FOLGA_BASE_DIAS = 92

/**
 * Aba "Dashboard KM & Horímetro": painel geral só com frotas ATIVAS (filtradas no banco).
 * Pesados = horímetro (h); Leves = KM. Cálculos em lib/horimetro-km-calc.ts.
 */
export default function DashboardKmHorimetro({ podeEditar = false }: { podeEditar?: boolean }) {
  const { filtros, atualizar, limpar, pronto } = useFiltrosUrl()
  const periodo = useMemo(() => ({ inicio: filtros.inicio, fim: filtros.fim }), [filtros.inicio, filtros.fim])
  const anterior = useMemo(() => periodoAnterior(periodo), [periodo])
  const desde = somarDias(anterior.inicio, -FOLGA_BASE_DIAS)
  const { dados, carregando, erro, recarregar } = useLeiturasDashboard(desde, periodo.fim, pronto)
  const hoje = hojeLocal()

  const [unidade, setUnidade] = useState<Unidade>('h')
  const [selId, setSelId] = useState<string | null>(null)
  const [corrigindo, setCorrigindo] = useState<LeituraEditavel | null>(null)
  const setSelecionada = (l: LinhaPlaca) => setSelId(l.equipamento.id)
  useEffect(() => {
    if (filtros.frota === 'leves') setUnidade('km')
    else if (filtros.frota === 'pesados') setUnidade('h')
  }, [filtros.frota])

  // Frotas ativas → filtro de frota / tipo / placa (opções de tipo e placa respeitam a frota escolhida).
  const ativosDaFrota = useMemo(() => (dados?.equipamentos || []).filter(e => {
    if (filtros.frota === 'todos') return true
    const f = tipoFrota(e.categoria, e.tipo)
    return filtros.frota === 'leves' ? f === 'leve' : f === 'pesado'
  }), [dados, filtros.frota])
  const tiposDisponiveis = useMemo(() => Array.from(new Set(ativosDaFrota.map(e => e.tipo || 'SEM TIPO'))).sort(), [ativosDaFrota])
  const placasDisponiveis = useMemo(() => ativosDaFrota
    .filter(e => !filtros.tipos.length || filtros.tipos.includes(e.tipo || 'SEM TIPO'))
    .map(e => e.placa).sort(), [ativosDaFrota, filtros.tipos])
  const equipamentos = useMemo(() => ativosDaFrota.filter(e =>
    (!filtros.tipos.length || filtros.tipos.includes(e.tipo || 'SEM TIPO')) &&
    (!filtros.placas.length || filtros.placas.includes(e.placa))
  ), [ativosDaFrota, filtros.tipos, filtros.placas])

  const leituras = dados?.leituras
  const linhas = useMemo(() => montarLinhas(equipamentos, leituras || [], periodo, hoje, filtros.atraso), [equipamentos, leituras, periodo, hoje, filtros.atraso])
  const linhasAnt = useMemo(() => montarLinhas(equipamentos, leituras || [], anterior, hoje, filtros.atraso), [equipamentos, leituras, anterior, hoje, filtros.atraso])
  const kpis = useMemo(() => calcularKpis(linhas, filtros.visao), [linhas, filtros.visao])
  const kpisAnt = useMemo(() => calcularKpis(linhasAnt, filtros.visao), [linhasAnt, filtros.visao])
  const temAnterior = linhasAnt.some(l => l.principal.temLeituraNoPeriodo || !!l.km?.temLeituraNoPeriodo)
  const selecionada = selId ? linhas.find(l => l.equipamento.id === selId) ?? null : null

  /** Monta a leitura pra correção a partir da linha bruta (anterior = leitura anterior da mesma placa). */
  const abrirCorrecao = (idLeitura: string) => {
    const todas = dados?.leituras || []
    const alvo = todas.find(x => x.id === idLeitura)
    if (!alvo || !selecionada) return
    const daPlaca = todas.filter(x => x.equipamento_id === alvo.equipamento_id).sort((a, b) => a.ordem.localeCompare(b.ordem))
    const ant = daPlaca[daPlaca.findIndex(x => x.id === alvo.id) - 1]
    setCorrigindo({
      id: alvo.id, placa: selecionada.equipamento.placa, unidade: alvo.unidade === 'km' ? 'km' : 'h',
      valor_novo: alvo.valor_novo, km_novo: alvo.km_novo,
      valor_anterior: ant ? ant.valor_novo : null, km_anterior: ant ? ant.km_novo : null,
      data: alvo.data, atualizado_por_nome: alvo.por, observacoes: alvo.obs,
    })
  }

  const placaUnica = filtros.placas.length === 1 ? linhas.find(l => l.equipamento.placa === filtros.placas[0]) : undefined

  const carregandoTela = !pronto || (carregando && !erro) || (!dados && !erro)
  const seletorUnidade = filtros.frota === 'todos'
    ? <Segmentado<Unidade> valor={unidade} onChange={setUnidade} opcoes={[{ v: 'h', l: 'Horímetro (h)' }, { v: 'km', l: 'KM' }]} />
    : null
  const nomeUnidade = unidade === 'h' ? 'horas (pesados)' : 'KM (leves e KM dos pesados)'

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-4 border border-zinc-200 dark:border-zinc-800">
      <FiltrosBar
        filtros={filtros} atualizar={atualizar} limpar={limpar}
        placasDisponiveis={placasDisponiveis} tiposDisponiveis={tiposDisponiveis}
        rfAtual={dados?.rfAtual ?? null}
        podeExportar={!!dados && linhas.length > 0}
        onExportar={f => { void exportarDashboard(linhas, periodo, f) }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="tabular-nums">
          Período <b className="text-zinc-700 dark:text-zinc-200">{fmtData(periodo.inicio)} a {fmtData(periodo.fim)}</b>
          {' · '}comparado com {fmtData(anterior.inicio)} a {fmtData(anterior.fim)}
        </span>
        <span className="flex items-center gap-1"><Info size={12} /> Somente frotas ativas · Pesados em horas (h) · Leves em KM</span>
      </div>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> Não foi possível carregar as leituras: {erro}</span>
          <button type="button" onClick={recarregar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-xs font-semibold"><RefreshCcw size={13} /> Tentar de novo</button>
        </div>
      )}

      {carregandoTela ? (
        <>
          <KpiSkeleton />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[300px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />)}
          </div>
          <div className="h-[360px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
        </>
      ) : dados && (
        <>
          <KpiCards atual={kpis} anterior={kpisAnt} visao={filtros.visao} temAnterior={temAnterior} />

          {placaUnica && (
            <CardGrafico titulo={`Evolução da leitura — ${placaUnica.equipamento.placa}`} sub={placaUnica.unidade === 'h' ? 'Horímetro acumulado' : 'KM acumulado'}>
              <EvolucaoChart pontos={placaUnica.pontos.filter(p => p.data >= periodo.inicio)} unidade={placaUnica.unidade} />
            </CardGrafico>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <CardGrafico titulo={filtros.visao === 'mensal' ? 'Uso mês a mês' : 'Uso por ano'} sub={`Soma em ${nomeUnidade}, com a média do período`} acao={seletorUnidade}>
              <UsoMensalChart linhas={linhas} unidade={unidade} periodo={periodo} visao={filtros.visao} />
            </CardGrafico>
            <CardGrafico titulo="Uso por categoria / tipo" sub={`Soma em ${nomeUnidade}`}>
              <UsoPorTipoChart linhas={linhas} unidade={unidade} />
            </CardGrafico>
          </div>

          <CardGrafico titulo="Ranking de placas por uso no período" sub={`Em ${nomeUnidade} · clique na barra para ver o histórico`}>
            <RankingChart linhas={linhas} unidade={unidade} onSelecionar={setSelecionada} />
          </CardGrafico>

          <TabelaAnalitica linhas={linhas} onSelecionar={setSelecionada} />
        </>
      )}

      {selecionada && <DrawerPlaca key={selecionada.equipamento.id} linha={selecionada} onClose={() => setSelId(null)} onCorrigir={podeEditar ? abrirCorrecao : undefined} />}
      {corrigindo && <EditarLeituraModal leituras={[corrigindo]} onClose={() => setCorrigindo(null)} />}
    </div>
  )
}
