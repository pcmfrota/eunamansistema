'use client'

import { Fragment, useMemo, useState } from 'react'
import { AlertCircle, AlertTriangle, RefreshCcw, Route, Search, Download, FileSpreadsheet, FileText, Loader2, Gauge } from 'lucide-react'
import { CheckboxMultiSelect } from '@/components/checkbox-multi-select'
import {
  montarLinhas, somarDias, somarMeses, fimDoMes, fmtNum, fmtData, tipoFrota, usoValido,
  type ResultadoUso, type Periodo,
} from '@/lib/horimetro-km-calc'
import { franquiaDe, resumirPorFranquia, resumirPorArea, type ResumoGrupo, type ResumoArea } from '@/lib/franquia-km'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import { hojeLocal } from './useFiltrosUrl'
import { exportarTabela, exportarAbas } from './exportar'

const FOLGA_BASE_DIAS = 92
const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const nomeMes = (am: string) => `${MESES_NOME[+am.slice(5, 7) - 1]} ${am.slice(0, 4)}`
const selectCls = 'px-3 py-2 text-[13px] font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
const arred = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
const capital = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

type Linha = { placa: string; tipo: string; area: string; modulo: string; franquiaKm: number | null; civil: ResultadoUso | null; suzano: ResultadoUso | null }
type Periodos = 'civil' | 'suzano'

/** Três células de um período: primeiro KM, último KM e KM rodado (último − primeiro). */
function CelulasPeriodo({ r, franquiaKm }: { r: ResultadoUso | null; franquiaKm: number | null }) {
  const rodado = usoValido(r)
  const acima = rodado != null && franquiaKm != null && rodado > franquiaKm
  const base = 'px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const km = (v: number | null, d: string | null) => v == null ? <span className="text-zinc-300 dark:text-zinc-700">—</span> : (
    <div className="leading-tight"><div className="font-semibold text-zinc-700 dark:text-zinc-200">{fmtNum(v, 1)} KM</div><div className="text-[10px] text-zinc-400">{fmtData(d)}</div></div>
  )
  return (
    <>
      <td className={base}>{km(r?.temLeituraNoPeriodo ? r.leituraInicial : null, r?.dataInicial ?? null)}</td>
      <td className={base}>{km(r?.temLeituraNoPeriodo ? r.leituraFinal : null, r?.dataFinal ?? null)}</td>
      <td className={`${base} font-extrabold`}>
        {rodado != null ? (
          <span className={acima ? 'text-amber-600 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}
            title={acima ? `Acima da franquia individual (${fmtNum(franquiaKm)} KM). A cobrança é pela média da frota — veja o resumo.` : undefined}>
            {acima && <AlertTriangle size={11} className="inline mr-1 -mt-0.5" />}{fmtNum(rodado, 1)} KM
          </span>
        ) : r?.insuficiente ? <span className="text-[10px] font-bold uppercase text-amber-600" title="Só 1 leitura de KM no período: precisa de pelo menos 2">1 leitura</span>
          : <span className="text-[10px] font-bold uppercase text-zinc-400">Sem leitura</span>}
      </td>
    </>
  )
}

/** Barra de uso do limite da frota (verde até 85%, âmbar até 100%, vermelho acima). */
function BarraLimite({ pct }: { pct: number | null }) {
  if (pct == null) return null
  const cor = pct > 100 ? 'bg-red-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="w-16 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden"><div className={`h-full ${cor}`} style={{ width: `${Math.min(100, pct)}%` }} /></div>
      <span className={`text-[10px] font-bold tabular-nums ${pct > 100 ? 'text-red-600' : 'text-zinc-500'}`}>{fmtNum(pct)}%</span>
    </div>
  )
}

/** Células de um período no resumo: KM rodado, média por veículo, % do limite e excedente. */
function CelulasResumo({ g }: { g: ResumoGrupo }) {
  const base = 'px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  if (!g.franquia) {
    return (
      <>
        <td className={base}>{g.comKm ? `${fmtNum(g.kmRodado, 1)} KM` : '—'}</td>
        <td className={`${base} text-zinc-400`} colSpan={3}>sem franquia no contrato</td>
      </>
    )
  }
  return (
    <>
      <td className={`${base} font-semibold`}>{fmtNum(g.kmRodado, 1)} KM</td>
      <td className={base}>{fmtNum(g.mediaPorVeiculo, 1)} KM</td>
      <td className={base}><BarraLimite pct={g.pctLimite} /></td>
      <td className={`${base} font-extrabold ${g.excedente ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {g.excedente ? `${fmtNum(g.excedente, 1)} KM` : 'Dentro'}
      </td>
    </>
  )
}

function CelulasArea({ a }: { a: ResumoArea }) {
  const base = 'px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const pct = a.limite > 0 ? (a.kmRodado / a.limite) * 100 : null
  return (
    <>
      <td className={`${base} font-bold`}>
        {fmtNum(a.kmRodado, 1)} KM
        {a.kmSemFranquia > 0 && <div className="text-[10px] font-normal text-zinc-400">+ {fmtNum(a.kmSemFranquia, 1)} KM sem franquia</div>}
      </td>
      <td className={base}>—</td>
      <td className={base}><BarraLimite pct={pct} /></td>
      <td className={`${base} font-extrabold ${a.excedente ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {a.excedente ? `${fmtNum(a.excedente, 1)} KM` : 'Dentro'}
      </td>
    </>
  )
}

/**
 * KM excedente dos PESADOS conforme a franquia do contrato (item 2.4): KM rodado de cada placa
 * (último − primeiro KM lançado no mês), somado por tipo + área e comparado com o limite da frota.
 * Mostra lado a lado o mês normal (dia 1 ao último dia) e o mês operacional Suzano (RF).
 */
export default function PlanilhaKmExcedente() {
  const hoje = hojeLocal()
  const mesAtual = hoje.slice(0, 7)
  const meses = useMemo(() => Array.from({ length: 24 }, (_, i) => somarMeses(mesAtual, -i)), [mesAtual])
  const [mes, setMes] = useState(mesAtual)
  const [rfChave, setRfChave] = useState<string>('')
  const [categorias, setCategorias] = useState<string[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [menuExp, setMenuExp] = useState(false)

  // Busca larga o bastante pros dois períodos (mês normal e RF) com folga pra detectar KM fora da sequência.
  const perCivil: Periodo = { inicio: `${mes}-01`, fim: fimDoMes(mes) }
  const desdeBusca = somarDias(`${somarMeses(mes, -2)}-01`, -FOLGA_BASE_DIAS)
  const { dados, carregando, erro, recarregar } = useLeiturasDashboard(desdeBusca, fimDoMes(mes > mesAtual ? mes : mesAtual), true)

  const rfs = dados?.rfs ?? []
  const rfSel = rfs.find(r => `${r.ano}-${r.mes}` === rfChave) ?? dados?.rfAtual ?? rfs[0] ?? null
  // O RF escolhido pode ser mais antigo que a janela buscada: busca de novo a partir dele.
  const desdeRf = rfSel ? somarDias(rfSel.inicio, -FOLGA_BASE_DIAS) : desdeBusca
  const precisaOutraBusca = !!rfSel && desdeRf < desdeBusca
  const extra = useLeiturasDashboard(precisaOutraBusca ? desdeRf : desdeBusca, fimDoMes(mesAtual), precisaOutraBusca)
  const leiturasRf = precisaOutraBusca ? extra.dados?.leituras : dados?.leituras

  const pesados = useMemo(() => (dados?.equipamentos || []).filter(e => tipoFrota(e.categoria, e.tipo) === 'pesado'), [dados])
  const opcoesCategoria = useMemo(() => Array.from(new Set(pesados.map(e => e.tipo || 'SEM TIPO'))).sort(), [pesados])
  const opcoesModulo = useMemo(() => Array.from(new Set(pesados.map(e => e.modulo || 'SEM MÓDULO'))).sort(), [pesados])

  // Todas as placas pesadas: o resumo da franquia é sempre da frota inteira (o limite é da frota).
  const todas = useMemo<Linha[]>(() => {
    if (!dados) return []
    const civil = montarLinhas(pesados, dados.leituras, perCivil, hoje, 7)
    const suz = rfSel && leiturasRf ? montarLinhas(pesados, leiturasRf, { inicio: rfSel.inicio, fim: rfSel.fim }, hoje, 7) : []
    return civil.map((l, i) => ({
      placa: l.equipamento.placa, tipo: l.equipamento.tipo || '—', area: (l.equipamento.area || '—').toUpperCase(), modulo: l.equipamento.modulo || '—',
      franquiaKm: franquiaDe(l.equipamento.tipo, l.equipamento.area)?.kmPorVeiculo ?? null,
      civil: l.km, suzano: suz[i]?.km ?? null,
    })).sort((a, b) => (usoValido(b.civil) ?? -1) - (usoValido(a.civil) ?? -1) || a.placa.localeCompare(b.placa))
  }, [dados, pesados, perCivil.inicio, perCivil.fim, hoje, rfSel, leiturasRf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Planilha por placa: respeita os filtros.
  const linhas = useMemo(() => todas.filter(l =>
    (!categorias.length || categorias.includes(l.tipo === '—' ? 'SEM TIPO' : l.tipo)) &&
    (!modulos.length || modulos.includes(l.modulo === '—' ? 'SEM MÓDULO' : l.modulo)) &&
    (!busca.trim() || l.placa.toUpperCase().includes(busca.trim().toUpperCase()))
  ), [todas, categorias, modulos, busca])

  const resumo = useMemo(() => {
    const r = (k: Periodos) => resumirPorFranquia(todas.map(l => ({ placa: l.placa, tipo: l.tipo, area: l.area, km: usoValido(l[k]) })))
    const civil = r('civil'), suzano = r('suzano')
    return { civil, suzano, areaCivil: resumirPorArea(civil), areaSuzano: resumirPorArea(suzano) }
  }, [todas])

  const totalRodado = (k: Periodos) => linhas.reduce((s, l) => s + (usoValido(l[k]) ?? 0), 0)
  const comKm = (k: Periodos) => linhas.filter(l => usoValido(l[k]) != null).length
  const tot = (k: Periodos) => {
    const g = resumo[k].filter(x => x.franquia)
    return { excedente: g.reduce((s, x) => s + (x.excedente ?? 0), 0), rodado: g.reduce((s, x) => s + x.kmRodado, 0), limite: g.reduce((s, x) => s + (x.limite ?? 0), 0) }
  }
  const rotuloRf = rfSel ? `RF'${String(rfSel.mes).padStart(2, '0')}/${rfSel.ano} (${fmtData(rfSel.inicio)} a ${fmtData(rfSel.fim)})` : 'Mês Suzano'

  // Mês parcial: se a primeira leitura de KM do período é bem depois do início, o KM rodado está incompleto.
  const parcial = (k: Periodos, inicio: string) => {
    const datas = todas.map(l => l[k]).filter(r => usoValido(r) != null).map(r => r!.dataInicial!).filter(Boolean).sort()
    const primeira = datas[0]
    return primeira && primeira > somarDias(inicio, 3) ? primeira : null
  }
  const parcialCivil = parcial('civil', perCivil.inicio)
  const parcialSuzano = rfSel ? parcial('suzano', rfSel.inicio) : null

  const linhasResumoExport = (k: Periodos, rot: string) => [
    ...resumo[k].map(g => ({
      'Período': rot, Grupo: g.rotulo, 'Área': capital(g.area || '—'), Tipo: g.tipo,
      'Veículos (contrato)': g.franquia?.veiculosContrato ?? null, 'Placas no cadastro': g.placas, 'Placas com KM': g.comKm,
      'Franquia KM/veículo': g.franquia?.kmPorVeiculo ?? null, 'Limite da frota (KM)': g.limite,
      'KM rodado': arred(g.kmRodado), 'Média por veículo (KM)': arred(g.mediaPorVeiculo),
      '% do limite': g.pctLimite == null ? null : Math.round(g.pctLimite), 'KM excedente': g.franquia ? arred(g.excedente) : 'Sem franquia',
    })),
    ...resumo[k === 'civil' ? 'areaCivil' : 'areaSuzano'].map(a => ({
      'Período': rot, Grupo: `TOTAL ${a.area}`, 'Área': capital(a.area), Tipo: '', 'Veículos (contrato)': null, 'Placas no cadastro': null, 'Placas com KM': null,
      'Franquia KM/veículo': null, 'Limite da frota (KM)': a.limite, 'KM rodado': arred(a.kmRodado), 'Média por veículo (KM)': null,
      '% do limite': a.limite ? Math.round((a.kmRodado / a.limite) * 100) : null, 'KM excedente': arred(a.excedente),
    })),
  ]

  const exportar = (f: 'xlsx' | 'csv') => {
    setMenuExp(false)
    const porPlaca = linhas.map(l => ({
      Placa: l.placa, Categoria: l.tipo, 'Área': l.area, 'Módulo': l.modulo, 'Franquia KM/veículo': l.franquiaKm,
      [`${nomeMes(mes)} - 1º KM`]: arred(l.civil?.temLeituraNoPeriodo ? l.civil.leituraInicial : null),
      [`${nomeMes(mes)} - Último KM`]: arred(l.civil?.temLeituraNoPeriodo ? l.civil.leituraFinal : null),
      [`${nomeMes(mes)} - KM rodado`]: arred(usoValido(l.civil)),
      [`${rotuloRf} - 1º KM`]: arred(l.suzano?.temLeituraNoPeriodo ? l.suzano.leituraInicial : null),
      [`${rotuloRf} - Último KM`]: arred(l.suzano?.temLeituraNoPeriodo ? l.suzano.leituraFinal : null),
      [`${rotuloRf} - KM rodado`]: arred(usoValido(l.suzano)),
    }))
    const nome = `km_excedente_pesados_${mes}`
    if (f === 'xlsx') {
      void exportarAbas([
        { aba: 'Resumo franquia', rows: [...linhasResumoExport('civil', nomeMes(mes)), ...linhasResumoExport('suzano', rotuloRf)] },
        { aba: 'KM por placa', rows: porPlaca },
      ], nome)
    } else void exportarTabela(porPlaca, nome, 'KM por placa', 'csv')
  }

  const th = 'px-3 py-2 font-bold border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const comFranquia = resumo.civil.filter(g => g.franquia)
  const semFranquia = (k: Periodos) => resumo[k].filter(g => !g.franquia)
  const areas = Array.from(new Set(comFranquia.map(g => g.area)))

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur shadow-sm p-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
          Mês normal
          <select className={selectCls} value={mes} onChange={e => setMes(e.target.value)}>
            {meses.map(m => <option key={m} value={m}>{nomeMes(m)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 uppercase">
          Mês Suzano
          <select className={selectCls} value={rfSel ? `${rfSel.ano}-${rfSel.mes}` : ''} onChange={e => setRfChave(e.target.value)} disabled={!rfs.length}>
            {rfs.map(r => (
              <option key={`${r.ano}-${r.mes}`} value={`${r.ano}-${r.mes}`}>
                RF&apos;{String(r.mes).padStart(2, '0')}/{r.ano} · {fmtData(r.inicio).slice(0, 5)} a {fmtData(r.fim).slice(0, 5)}
              </option>
            ))}
          </select>
        </label>
        <CheckboxMultiSelect values={categorias} onChange={setCategorias} selecionarTodos
          options={opcoesCategoria.map(c => ({ value: c, label: c }))} placeholder="Categoria" />
        <CheckboxMultiSelect values={modulos} onChange={setModulos} selecionarTodos
          options={opcoesModulo.map(m => ({ value: m, label: m }))} placeholder="Módulo" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[160px]">
          <Search size={13} className="text-zinc-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Placa…" className="bg-transparent outline-none text-[13px] w-full dark:text-white" />
        </div>
        <div className="relative ml-auto">
          <button type="button" disabled={!todas.length} onClick={() => setMenuExp(a => !a)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40">
            <Download size={13} /> Exportar
          </button>
          {menuExp && (
            <div className="absolute right-0 z-30 mt-1 w-56 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
              <button type="button" onClick={() => exportar('xlsx')} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileSpreadsheet size={13} className="text-emerald-600" /> Excel (resumo + placas)</button>
              <button type="button" onClick={() => exportar('csv')} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileText size={13} className="text-zinc-500" /> CSV (placas)</button>
            </div>
          )}
        </div>
      </div>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
          <span className="flex items-center gap-2"><AlertCircle size={16} /> Não foi possível carregar as leituras: {erro}</span>
          <button type="button" onClick={recarregar} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-xs font-semibold"><RefreshCcw size={13} /> Tentar de novo</button>
        </div>
      )}

      {!dados && !erro ? (
        <div className="h-[360px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
      ) : dados && (
        <>
          {(carregando || extra.carregando) && <div className="flex items-center gap-2 text-xs text-blue-600"><Loader2 size={13} className="animate-spin" /> Atualizando dados…</div>}

          {/* Cards: excedente total da frota (soma dos grupos com franquia) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([['civil', nomeMes(mes), parcialCivil], ['suzano', rotuloRf, parcialSuzano]] as const).map(([k, rot, parc]) => {
              const t = tot(k)
              const pct = t.limite ? (t.rodado / t.limite) * 100 : null
              return (
                <div key={k} className={`rounded-xl border bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1 ${t.excedente ? 'border-red-200 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                    KM excedente · {k === 'civil' ? 'mês normal' : 'mês Suzano'} <Route size={16} className={t.excedente ? 'text-red-500' : 'text-blue-600'} />
                  </div>
                  <div className={`text-2xl font-extrabold tabular-nums ${t.excedente ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>
                    {fmtNum(t.excedente, 1)} <span className="text-sm font-bold text-blue-600">KM</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 tabular-nums">
                    {rot} · rodado {fmtNum(t.rodado, 1)} KM de {fmtNum(t.limite)} KM de limite{pct != null ? ` (${fmtNum(pct)}%)` : ''}
                  </div>
                  {parc && <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Parcial: as leituras de KM começam em {fmtData(parc)}</div>}
                </div>
              )
            })}
          </div>

          {/* Resumo por categoria e área (franquia do contrato) */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2"><Gauge size={15} className="text-blue-600" /> Resumo da franquia por categoria e área</h3>
                <p className="text-[11px] text-zinc-500">Contrato item 2.4 — cobrança pela média rodada da frota por mês e tipo de equipamento. Considera todos os pesados (os filtros valem só para a planilha por placa).</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th rowSpan={2} className={`${th} text-left sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950`}>Categoria</th>
                    <th rowSpan={2} className={`${th} text-center`}>Veículos</th>
                    <th rowSpan={2} className={`${th} text-right`}>Franquia / veíc.</th>
                    <th rowSpan={2} className={`${th} text-right`}>Limite da frota</th>
                    <th colSpan={4} className={`${th} text-center text-blue-700 dark:text-blue-400`}>Mês normal · {nomeMes(mes)}</th>
                    <th colSpan={4} className={`${th} text-center text-emerald-700 dark:text-emerald-400`}>Mês Suzano · {rotuloRf}</th>
                  </tr>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                    {[0, 1].map(i => (
                      <Fragment key={i}>
                        <th className={`${th} text-right`}>KM rodado</th><th className={`${th} text-right`}>Média / veíc.</th>
                        <th className={`${th} text-right`}>% do limite</th><th className={`${th} text-right`}>KM excedente</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {areas.map(area => {
                    const gruposCivil = resumo.civil.filter(g => g.franquia && g.area === area)
                    const aCivil = resumo.areaCivil.find(a => a.area === area)
                    const aSuz = resumo.areaSuzano.find(a => a.area === area)
                    return (
                      <Fragment key={area}>
                        <tr className="bg-zinc-100/70 dark:bg-zinc-800/40">
                          <td colSpan={12} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-800">{capital(area)}</td>
                        </tr>
                        {gruposCivil.map(g => {
                          const gs = resumo.suzano.find(x => x.chave === g.chave)!
                          return (
                            <tr key={g.chave} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                              <td className="px-3 py-2 font-semibold text-zinc-800 dark:text-zinc-100 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900">{g.rotulo}</td>
                              <td className="px-3 py-2 text-center tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap"
                                title={`${g.franquia!.veiculosContrato} no contrato · ${g.placas} no cadastro · ${g.comKm} com KM no mês normal`}>
                                {g.franquia!.veiculosContrato}
                                {g.placas !== g.franquia!.veiculosContrato && <span className="ml-1 text-[10px] text-amber-600">({g.placas} cad.)</span>}
                                <div className="text-[10px] text-zinc-400">{g.comKm} c/ KM</div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(g.franquia!.kmPorVeiculo)} KM</td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(g.limite)} KM</td>
                              <CelulasResumo g={g} />
                              <CelulasResumo g={gs} />
                            </tr>
                          )
                        })}
                        {aCivil && aSuz && (
                          <tr className="bg-zinc-50 dark:bg-zinc-950 font-bold">
                            <td className="px-3 py-2 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap sticky left-0 bg-zinc-50 dark:bg-zinc-950">Total {capital(area)}</td>
                            <td colSpan={2} className="px-3 py-2 border-b border-r border-zinc-200 dark:border-zinc-800" />
                            <td className="px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(aCivil.limite)} KM</td>
                            <CelulasArea a={aCivil} />
                            <CelulasArea a={aSuz} />
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {semFranquia('civil').length > 0 && (
                    <>
                      <tr className="bg-zinc-100/70 dark:bg-zinc-800/40">
                        <td colSpan={12} className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">Sem franquia no contrato (só KM rodado)</td>
                      </tr>
                      {semFranquia('civil').map(g => {
                        const gs = resumo.suzano.find(x => x.chave === g.chave)!
                        return (
                          <tr key={g.chave} className="text-zinc-500">
                            <td className="px-3 py-2 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap sticky left-0 bg-white dark:bg-zinc-900">{capital(g.tipo || 'Sem tipo')} · {capital(g.area || 'sem área')}</td>
                            <td className="px-3 py-2 text-center tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800">{g.placas}<div className="text-[10px] text-zinc-400">{g.comKm} c/ KM</div></td>
                            <td className="px-3 py-2 text-right border-b border-r border-zinc-200 dark:border-zinc-800">—</td>
                            <td className="px-3 py-2 text-right border-b border-r border-zinc-200 dark:border-zinc-800">—</td>
                            <CelulasResumo g={g} />
                            <CelulasResumo g={gs} />
                          </tr>
                        )
                      })}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 dark:bg-zinc-950 font-extrabold text-zinc-800 dark:text-zinc-100">
                    <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 sticky left-0 bg-zinc-100 dark:bg-zinc-950">Total da frota</td>
                    <td colSpan={2} className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                    <td className="px-3 py-2 text-right tabular-nums border-r border-zinc-200 dark:border-zinc-800">{fmtNum(tot('civil').limite)} KM</td>
                    {(['civil', 'suzano'] as const).map(k => {
                      const t = tot(k)
                      return (
                        <Fragment key={k}>
                          <td className="px-3 py-2 text-right tabular-nums border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(t.rodado, 1)} KM</td>
                          <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                          <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800"><BarraLimite pct={t.limite ? (t.rodado / t.limite) * 100 : null} /></td>
                          <td className={`px-3 py-2 text-right tabular-nums border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap ${t.excedente ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {t.excedente ? `${fmtNum(t.excedente, 1)} KM` : 'Dentro'}
                          </td>
                        </Fragment>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Planilha por placa */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                  <th rowSpan={2} className={`${th} sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950 text-left`}>Placa</th>
                  <th rowSpan={2} className={`${th} text-left`}>Categoria</th>
                  <th rowSpan={2} className={`${th} text-left`}>Área</th>
                  <th rowSpan={2} className={`${th} text-left`}>Módulo</th>
                  <th rowSpan={2} className={`${th} text-right`}>Franquia</th>
                  <th colSpan={3} className={`${th} text-center text-blue-700 dark:text-blue-400`}>Mês normal · {nomeMes(mes)}</th>
                  <th colSpan={3} className={`${th} text-center text-emerald-700 dark:text-emerald-400`}>Mês Suzano · {rotuloRf}</th>
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className={`${th} text-right`}>1º KM</th><th className={`${th} text-right`}>Último KM</th><th className={`${th} text-right`}>KM rodado</th>
                  <th className={`${th} text-right`}>1º KM</th><th className={`${th} text-right`}>Último KM</th><th className={`${th} text-right`}>KM rodado</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.placa} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 font-bold text-amber-700 dark:text-amber-400 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.placa}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.tipo}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.area}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.modulo}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-zinc-500 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.franquiaKm != null ? `${fmtNum(l.franquiaKm)} KM` : '—'}</td>
                    <CelulasPeriodo r={l.civil} franquiaKm={l.franquiaKm} />
                    <CelulasPeriodo r={l.suzano} franquiaKm={l.franquiaKm} />
                  </tr>
                ))}
                {!linhas.length && <tr><td colSpan={11} className="p-8 text-center text-sm text-zinc-400">Nenhuma placa no filtro</td></tr>}
              </tbody>
              {linhas.length > 0 && (
                <tfoot>
                  <tr className="bg-zinc-100 dark:bg-zinc-950 font-bold text-zinc-800 dark:text-zinc-100">
                    <td className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-950 px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">Total: {linhas.length} placas</td>
                    <td colSpan={4} className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                    <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">{comKm('civil')} placas com KM</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(totalRodado('civil'), 1)} KM</td>
                    <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">{comKm('suzano')} placas com KM</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtNum(totalRodado('suzano'), 1)} KM</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">
            KM rodado = último KM lançado no período − primeiro KM lançado no período (só pesados ativos). KM excedente = KM rodado da frota do grupo − limite da frota (franquia × veículos do contrato), quando passar.
            Valor em âmbar na planilha = placa acima da franquia individual (informativo; a cobrança é pela média da frota). Placa com uma única leitura de KM aparece como &quot;1 leitura&quot;; KM fora da sequência (provável erro de digitação) é ignorado.
          </p>
        </>
      )}
    </div>
  )
}
