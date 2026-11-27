'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, RefreshCcw, Info, CalendarRange, BarChart3, Route, Loader2 } from 'lucide-react'
import {
  montarLinhas, montarLinhasMeses, mesesComparacao, periodoDosMeses, calcularKpis, periodoComparacao, somarDias, tipoFrota,
  type EquipamentoAtivo, type LinhaPlaca, type Unidade,
} from '@/lib/horimetro-km-calc'
import { useFiltrosUrl, hojeLocal } from './useFiltrosUrl'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import FiltrosBar, { Segmentado } from './FiltrosBar'
import KpiCards, { KpiSkeleton } from './KpiCards'
import { CardGrafico, UsoMensalChart, RankingChart, UsoPorTipoChart, EvolucaoChart } from './Graficos'
import TabelaAnalitica from './TabelaAnalitica'
import DrawerPlaca from './DrawerPlaca'
import BarraComparacao, { rotuloComparacao } from './BarraComparacao'
import PainelAnual, { type MesAnual } from './PainelAnual'
import MediasCharts from './MediasCharts'
import PlanilhaKmExcedente from './PlanilhaKmExcedente'
import { exportarDashboard, exportarTabela } from './exportar'
import EditarLeituraModal, { type LeituraEditavel } from '../EditarLeituraModal'

// Busca leituras desde ~3 meses antes do período mais antigo (filtrado ou comparação), pra achar
// a "última leitura antes do início" (base do cálculo) sem baixar o histórico inteiro.
const FOLGA_BASE_DIAS = 92

export function Atualizando() {
  return <div className="flex items-center gap-2 text-xs text-blue-600"><Loader2 size={13} className="animate-spin" /> Atualizando dados…</div>
}

const arred1 = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

/**
 * Aba "Dashboard KM & Horímetro": painel geral só com frotas ATIVAS (filtradas no banco).
 * Pesados = horímetro (h); Leves = KM. Cálculos em lib/horimetro-km-calc.ts.
 * Duas visões: período filtrado (com comparação escolhida) e anual (todos os meses de um ano).
 */
export default function DashboardKmHorimetro({ podeEditar = false }: { podeEditar?: boolean }) {
  const { filtros, atualizar, limpar, pronto } = useFiltrosUrl()
  const anual = filtros.aba === 'anual'
  const periodo = useMemo(() => ({ inicio: filtros.inicio, fim: filtros.fim }), [filtros.inicio, filtros.fim])
  // Vários meses escolhidos: cada mês é calculado sozinho e somado.
  const mesesSel = filtros.modo === 'meses' && filtros.meses.length > 1 ? filtros.meses : null
  const mesesAnt = useMemo(() => (mesesSel && filtros.cmp !== 'custom' ? mesesComparacao(mesesSel, filtros.cmp) : null), [mesesSel, filtros.cmp])
  const anterior = useMemo(
    () => mesesAnt ? periodoDosMeses(mesesAnt) : periodoComparacao(periodo, filtros.cmp, { inicio: filtros.cmpIni, fim: filtros.cmpFim }),
    [mesesAnt, periodo, filtros.cmp, filtros.cmpIni, filtros.cmpFim])
  const desde = somarDias(anterior.inicio < periodo.inicio ? anterior.inicio : periodo.inicio, -FOLGA_BASE_DIAS)
  const fimBusca = anterior.fim > periodo.fim ? anterior.fim : periodo.fim
  const { dados, carregando, erro, recarregar } = useLeiturasDashboard(desde, fimBusca, pronto)
  const hoje = hojeLocal()

  const [unidade, setUnidade] = useState<Unidade>('h')
  const [selId, setSelId] = useState<string | null>(null)
  const [corrigindo, setCorrigindo] = useState<LeituraEditavel | null>(null)
  const [mesesAnual, setMesesAnual] = useState<MesAnual[]>([])
  const setSelecionada = (l: LinhaPlaca) => setSelId(l.equipamento.id)
  useEffect(() => {
    if (filtros.frota === 'leves') setUnidade('km')
    else if (filtros.frota === 'pesados') setUnidade('h')
  }, [filtros.frota])

  // Filtro de frota / tipo / placa (o mesmo nas duas visões).
  const daFrota = useCallback((e: EquipamentoAtivo) => {
    if (filtros.frota === 'todos') return true
    const f = tipoFrota(e.categoria, e.tipo)
    return filtros.frota === 'leves' ? f === 'leve' : f === 'pesado'
  }, [filtros.frota])
  const filtroEquip = useCallback((e: EquipamentoAtivo) =>
    daFrota(e) &&
    (!filtros.tipos.length || filtros.tipos.includes(e.tipo || 'SEM TIPO')) &&
    (!filtros.placas.length || filtros.placas.includes(e.placa)),
  [daFrota, filtros.tipos, filtros.placas])

  // Opções de tipo e placa respeitam a frota escolhida.
  const ativosDaFrota = useMemo(() => (dados?.equipamentos || []).filter(daFrota), [dados, daFrota])
  const tiposDisponiveis = useMemo(() => Array.from(new Set(ativosDaFrota.map(e => e.tipo || 'SEM TIPO'))).sort(), [ativosDaFrota])
  const placasDisponiveis = useMemo(() => ativosDaFrota
    .filter(e => !filtros.tipos.length || filtros.tipos.includes(e.tipo || 'SEM TIPO'))
    .map(e => e.placa).sort(), [ativosDaFrota, filtros.tipos])
  const equipamentos = useMemo(() => (dados?.equipamentos || []).filter(filtroEquip), [dados, filtroEquip])

  const leituras = dados?.leituras
  const linhas = useMemo(() => mesesSel
    ? montarLinhasMeses(equipamentos, leituras || [], mesesSel, hoje, filtros.atraso)
    : montarLinhas(equipamentos, leituras || [], periodo, hoje, filtros.atraso), [mesesSel, equipamentos, leituras, periodo, hoje, filtros.atraso])
  const linhasAnt = useMemo(() => mesesAnt
    ? montarLinhasMeses(equipamentos, leituras || [], mesesAnt, hoje, filtros.atraso)
    : montarLinhas(equipamentos, leituras || [], anterior, hoje, filtros.atraso), [mesesAnt, equipamentos, leituras, anterior, hoje, filtros.atraso])
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

  const exportar = (f: 'xlsx' | 'csv') => {
    if (!anual) { void exportarDashboard(linhas, periodo, f); return }
    const ano = filtros.ano
    const rows = mesesAnual.map(m => ({
      'Mês': m.rotulo,
      [`Horas ${ano}`]: arred1(m.h), [`Horas ${ano - 1}`]: arred1(m.hAnt),
      [`KM ${ano}`]: arred1(m.km), [`KM ${ano - 1}`]: arred1(m.kmAnt),
    }))
    void exportarTabela(rows, `km_horimetro_anual_${ano}`, `Anual ${ano}`, f)
  }

  const placaUnica = filtros.placas.length === 1 ? linhas.find(l => l.equipamento.placa === filtros.placas[0]) : undefined

  // Esqueleto só na primeira carga; trocando filtros, os dados atuais ficam na tela até os novos chegarem.
  const carregandoTela = !pronto || (!dados && !erro)
  const seletorUnidade = filtros.frota === 'todos'
    ? <Segmentado<Unidade> valor={unidade} onChange={setUnidade} opcoes={[{ v: 'h', l: 'Horímetro (h)' }, { v: 'km', l: 'KM' }]} />
    : null
  const nomeUnidade = unidade === 'h' ? 'horas (pesados)' : 'KM (leves e KM dos pesados)'

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 p-3 sm:p-4 border border-zinc-200 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1 gap-1">
          {([
            { v: 'periodo', l: 'Visão do período', i: <CalendarRange size={14} /> },
            { v: 'anual', l: 'Visão anual (todos os meses)', i: <BarChart3 size={14} /> },
            { v: 'excedente', l: 'KM excedente (pesados)', i: <Route size={14} /> },
          ] as const).map(o => (
            <button key={o.v} type="button" onClick={() => atualizar({ aba: o.v })}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${filtros.aba === o.v ? 'bg-blue-600 text-white' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
              {o.i} {o.l}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-xs text-zinc-500"><Info size={12} /> Somente frotas ativas · Pesados em horas (h) · Leves em KM</span>
      </div>

      {filtros.aba === 'excedente' ? (pronto && <PlanilhaKmExcedente />) : <>
      <FiltrosBar
        filtros={filtros} atualizar={atualizar} limpar={limpar}
        placasDisponiveis={placasDisponiveis} tiposDisponiveis={tiposDisponiveis}
        rfs={dados?.rfs ?? []}
        podeExportar={anual ? mesesAnual.length > 0 : !!dados && linhas.length > 0}
        onExportar={exportar}
        modoAnual={anual}
        extra={anual ? null : seletorUnidade}
      />

      {anual ? (
        pronto && <PainelAnual ano={filtros.ano} onAno={ano => atualizar({ ano })} filtroEquip={filtroEquip} atraso={filtros.atraso} onDados={setMesesAnual} />
      ) : (
        <>
          <BarraComparacao filtros={filtros} atualizar={atualizar} periodo={periodo} comparacao={anterior} meses={mesesSel} mesesComparados={mesesAnt} />

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
              {carregando && <Atualizando />}
              <KpiCards atual={kpis} anterior={kpisAnt} visao={filtros.visao} temAnterior={temAnterior} rotuloComparacao={rotuloComparacao(filtros.cmp)} />

              {placaUnica && (
                <CardGrafico titulo={`Evolução da leitura — ${placaUnica.equipamento.placa}`} sub={placaUnica.unidade === 'h' ? 'Horímetro acumulado' : 'KM acumulado'}>
                  <EvolucaoChart pontos={placaUnica.pontos.filter(p => p.data >= periodo.inicio)} unidade={placaUnica.unidade} />
                </CardGrafico>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <CardGrafico titulo={filtros.visao === 'mensal' ? 'Uso mês a mês' : 'Uso por ano'} sub={unidade === 'h' ? 'Soma em horas e em KM rodado (pesados), com a média do período' : `Soma em ${nomeUnidade}, com a média do período`}>
                  {unidade === 'h' && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Horímetro (H)</p>}
                  <UsoMensalChart linhas={linhas} unidade={unidade} periodo={periodo} visao={filtros.visao} meses={mesesSel ?? undefined} />
                  {unidade === 'h' && <>
                    <p className="mt-3 mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">KM rodado</p>
                    <UsoMensalChart linhas={linhas.filter(l => l.unidade === 'h')} unidade="km" periodo={periodo} visao={filtros.visao} meses={mesesSel ?? undefined} />
                  </>}
                </CardGrafico>
                <CardGrafico titulo="Uso por categoria / tipo" sub={unidade === 'h' ? 'Soma em horas e em KM rodado (pesados)' : `Soma em ${nomeUnidade}`}>
                  {unidade === 'h' && <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">Horímetro (H)</p>}
                  <UsoPorTipoChart linhas={linhas} unidade={unidade} />
                  {unidade === 'h' && <>
                    <p className="mt-3 mb-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">KM rodado</p>
                    <UsoPorTipoChart linhas={linhas.filter(l => l.unidade === 'h')} unidade="km" />
                  </>}
                </CardGrafico>
              </div>

              <MediasCharts linhas={linhas} onSelecionar={setSelecionada} />

              {unidade === 'h' ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <CardGrafico titulo="Ranking de placas por horas" sub="Horímetro (pesados) · clique na barra para ver o histórico">
                    <RankingChart linhas={linhas} unidade="h" onSelecionar={setSelecionada} />
                  </CardGrafico>
                  <CardGrafico titulo="Ranking de placas por KM rodado" sub="KM dos pesados · clique na barra para ver o histórico">
                    <RankingChart linhas={linhas.filter(l => l.unidade === 'h')} unidade="km" onSelecionar={setSelecionada} />
                  </CardGrafico>
                </div>
              ) : (
                <CardGrafico titulo="Ranking de placas por uso no período" sub={`Em ${nomeUnidade} · clique na barra para ver o histórico`}>
                  <RankingChart linhas={linhas} unidade={unidade} onSelecionar={setSelecionada} />
                </CardGrafico>
              )}

              <TabelaAnalitica linhas={linhas} onSelecionar={setSelecionada} />
            </>
          )}
        </>
      )}

      </>}

      {!anual && filtros.aba !== 'excedente' && selecionada && <DrawerPlaca key={selecionada.equipamento.id} linha={selecionada} periodo={periodo} onClose={() => setSelId(null)} onCorrigir={podeEditar ? abrirCorrecao : undefined} />}
      {corrigindo && <EditarLeituraModal leituras={[corrigindo]} onClose={() => setCorrigindo(null)} />}
    </div>
  )
}
