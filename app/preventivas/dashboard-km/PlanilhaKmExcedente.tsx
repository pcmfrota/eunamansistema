'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertCircle, AlertTriangle, RefreshCcw, Route, Search, Download, FileSpreadsheet, FileText, Loader2, Gauge, X, ChevronRight, CheckCircle2 } from 'lucide-react'
import { CheckboxMultiSelect } from '@/components/checkbox-multi-select'
import { somarDias, fmtNum, fmtData, tipoFrota, usoValido, montarLinhas, type ResultadoUso } from '@/lib/horimetro-km-calc'
import { franquiaDe, resumirPorFranquia, resumirPorArea, type ResumoGrupo, type ResumoArea, type Franquia } from '@/lib/franquia-km'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import { hojeLocal } from './useFiltrosUrl'
import { exportarTabela, exportarAbas } from './exportar'

const FOLGA_BASE_DIAS = 92
const AREAS = ['COLHEITA', 'CARREGAMENTO'] as const
const selectCls = 'px-3 py-2 text-[13px] font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
const arred = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)
const capital = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s)
const norm = (s: string | null | undefined) => String(s || '').trim().toUpperCase()

type Linha = { placa: string; tipo: string; area: string; modulo: string; franquia: Franquia | null; km: ResultadoUso | null }
/** Painel lateral: placas de uma categoria (grupo da franquia) ou de uma área inteira. */
type Detalhe = { titulo: string; sub: string; grupo: ResumoGrupo | null; area: ResumoArea | null; placas: Linha[] }

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

const Excedente = ({ v }: { v: number | null | undefined }) => (
  <span className={`font-extrabold ${v ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{v ? `${fmtNum(v, 1)} KM` : 'Dentro'}</span>
)

/** Situação da placa contra a franquia individual (informativo — a cobrança é pela média da frota). */
function SituacaoPlaca({ l }: { l: Linha }) {
  const r = usoValido(l.km)
  if (r == null) return l.km?.insuficiente
    ? <span className="text-[10px] font-bold uppercase text-amber-600">1 leitura</span>
    : <span className="text-[10px] font-bold uppercase text-zinc-400">Sem leitura</span>
  if (!l.franquia) return <span className="text-[10px] font-bold uppercase text-zinc-400">Sem franquia</span>
  const dif = r - l.franquia.kmPorVeiculo
  return dif > 0
    ? <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-red-600 dark:text-red-400"><AlertTriangle size={12} /> Excede {fmtNum(dif, 1)} KM</span>
    : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"><CheckCircle2 size={12} /> Dentro · faltam {fmtNum(-dif, 1)} KM</span>
}

function PainelDetalhe({ d, onClose }: { d: Detalhe; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const ordenadas = [...d.placas].sort((a, b) => (usoValido(b.km) ?? -1) - (usoValido(a.km) ?? -1) || a.placa.localeCompare(b.placa))
  const rodado = d.placas.reduce((s, l) => s + (usoValido(l.km) ?? 0), 0)
  const g = d.grupo, a = d.area
  const limite = g?.limite ?? a?.limite ?? null
  const excedente = g ? g.excedente : a ? a.excedente : null
  const pct = limite ? ((g ? g.kmRodado : a ? a.kmRodado : rodado) / limite) * 100 : null
  const kpi = 'rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex flex-col gap-0.5'
  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/40 backdrop-blur-[2px]" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="h-full w-full max-w-3xl bg-white dark:bg-zinc-950 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-zinc-900 dark:text-white">{d.titulo}</h2>
            <p className="text-xs text-zinc-500">{d.sub}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className={kpi}><span className="text-[10px] font-bold uppercase text-zinc-400">KM rodado</span><span className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-white">{fmtNum(g?.kmRodado ?? a?.kmRodado ?? rodado, 1)} KM</span></div>
            <div className={kpi}><span className="text-[10px] font-bold uppercase text-zinc-400">Limite da frota</span><span className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-white">{limite != null ? `${fmtNum(limite)} KM` : '—'}</span>
              {g?.franquia && <span className="text-[10px] text-zinc-400">{fmtNum(g.franquia.kmPorVeiculo)} KM × {g.franquia.veiculosContrato} veíc.</span>}</div>
            <div className={kpi}><span className="text-[10px] font-bold uppercase text-zinc-400">{g ? 'Média por veículo' : '% do limite'}</span>
              <span className="text-lg font-extrabold tabular-nums text-zinc-900 dark:text-white">{g ? (g.mediaPorVeiculo != null ? `${fmtNum(g.mediaPorVeiculo, 1)} KM` : '—') : pct != null ? `${fmtNum(pct)}%` : '—'}</span>
              {g && <BarraLimite pct={g.pctLimite} />}</div>
            <div className={`${kpi} ${excedente ? 'border-red-200 dark:border-red-900/50' : ''}`}><span className="text-[10px] font-bold uppercase text-zinc-400">KM excedente da frota</span>
              <span className="text-lg tabular-nums">{limite != null ? <Excedente v={excedente} /> : <span className="text-sm text-zinc-400">sem franquia</span>}</span></div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900 text-[10px] uppercase tracking-wide text-zinc-500">
                  {['Placa', 'Módulo', 'KM inicial', 'KM final', 'KM rodado', 'Franquia', 'Situação'].map((h, i) => (
                    <th key={h} className={`px-3 py-2 font-bold border-b border-zinc-200 dark:border-zinc-800 whitespace-nowrap ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenadas.map(l => {
                  const r = l.km
                  const tem = !!r?.temLeituraNoPeriodo
                  return (
                    <tr key={l.placa} className="border-b border-zinc-100 dark:border-zinc-800/70">
                      <td className="px-3 py-2 font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{l.placa}<div className="text-[10px] font-normal text-zinc-400">{l.tipo}</div></td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{l.modulo}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{tem ? <>{fmtNum(r!.leituraInicial, 1)} KM<div className="text-[10px] text-zinc-400">{fmtData(r!.dataInicial)}</div></> : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{tem ? <>{fmtNum(r!.leituraFinal, 1)} KM<div className="text-[10px] text-zinc-400">{fmtData(r!.dataFinal)}</div></> : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-extrabold text-blue-700 dark:text-blue-400 whitespace-nowrap">{usoValido(r) != null ? `${fmtNum(usoValido(r), 1)} KM` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500 whitespace-nowrap">{l.franquia ? `${fmtNum(l.franquia.kmPorVeiculo)} KM` : '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap"><SituacaoPlaca l={l} /></td>
                    </tr>
                  )
                })}
                {!ordenadas.length && <tr><td colSpan={7} className="p-6 text-center text-zinc-400">Nenhuma placa</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">
            A situação por placa compara o KM rodado com a franquia individual (só informativo). A cobrança do contrato é pela <b>média rodada da frota</b>: só há excedente quando o KM rodado do grupo passa do limite da frota.
          </p>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * KM excedente dos PESADOS no mês operacional Suzano (RF), conforme a franquia do contrato (item 2.4):
 * KM rodado de cada placa (último − primeiro KM lançado no RF), somado por tipo + área e comparado
 * com o limite da frota. Clicar numa categoria abre o painel com as placas.
 */
export default function PlanilhaKmExcedente() {
  const hoje = hojeLocal()
  const [rfChave, setRfChave] = useState<string>('')
  const [areasSel, setAreasSel] = useState<string[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [modulos, setModulos] = useState<string[]>([])
  const [busca, setBusca] = useState('')
  const [menuExp, setMenuExp] = useState(false)
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null)

  // 1ª busca: traz a lista de RFs (e já cobre o RF atual com folga pra detectar KM fora da sequência).
  const desdePadrao = somarDias(hoje, -120 - FOLGA_BASE_DIAS)
  const base = useLeiturasDashboard(desdePadrao, hoje, true)
  const rfs = base.dados?.rfs ?? []
  // Padrão: RF em andamento; nos 3 primeiros dias de um RF novo (ainda sem leituras), o RF anterior.
  const rfAtual = base.dados?.rfAtual ?? null
  const rfPadrao = rfAtual && hoje < somarDias(rfAtual.inicio, 3)
    ? rfs.find(r => r.fim < rfAtual.inicio) ?? rfAtual
    : rfAtual ?? rfs[0] ?? null
  const rfSel = rfs.find(r => `${r.ano}-${r.mes}` === rfChave) ?? rfPadrao
  // RF mais antigo que a janela: busca de novo a partir dele.
  const desdeRf = rfSel ? somarDias(rfSel.inicio, -FOLGA_BASE_DIAS) : desdePadrao
  const precisaOutra = !!rfSel && desdeRf < desdePadrao
  const extra = useLeiturasDashboard(precisaOutra ? desdeRf : desdePadrao, hoje, precisaOutra)
  const dados = precisaOutra ? extra.dados : base.dados
  const carregando = base.carregando || extra.carregando
  const erro = base.erro || extra.erro

  const pesados = useMemo(() => (base.dados?.equipamentos || []).filter(e => tipoFrota(e.categoria, e.tipo) === 'pesado'), [base.dados])
  const opcoesCategoria = useMemo(() => Array.from(new Set(pesados.map(e => e.tipo || 'SEM TIPO'))).sort(), [pesados])
  const opcoesModulo = useMemo(() => Array.from(new Set(pesados.map(e => e.modulo || 'SEM MÓDULO'))).sort(), [pesados])

  // Todas as placas pesadas no RF (o limite é da frota inteira; o filtro de área escolhe quais grupos aparecem).
  const todas = useMemo<Linha[]>(() => {
    if (!dados || !rfSel) return []
    const ls = montarLinhas(pesados, dados.leituras, { inicio: rfSel.inicio, fim: rfSel.fim }, hoje, 7)
    return ls.map(l => ({
      placa: l.equipamento.placa, tipo: l.equipamento.tipo || '—', area: norm(l.equipamento.area) || '—', modulo: l.equipamento.modulo || '—',
      franquia: franquiaDe(l.equipamento.tipo, l.equipamento.area), km: l.km,
    }))
  }, [dados, pesados, rfSel, hoje])

  const naArea = (area: string) => !areasSel.length || areasSel.includes(area)
  const resumo = useMemo(() => {
    const grupos = resumirPorFranquia(todas.map(l => ({ placa: l.placa, tipo: l.tipo, area: l.area, km: usoValido(l.km) })))
      .filter(g => naArea(g.area))
    return { grupos, areas: resumirPorArea(grupos) }
  }, [todas, areasSel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Planilha por placa: área + categoria + módulo + placa.
  const linhas = useMemo(() => todas.filter(l =>
    naArea(l.area) &&
    (!categorias.length || categorias.includes(l.tipo === '—' ? 'SEM TIPO' : l.tipo)) &&
    (!modulos.length || modulos.includes(l.modulo === '—' ? 'SEM MÓDULO' : l.modulo)) &&
    (!busca.trim() || l.placa.toUpperCase().includes(busca.trim().toUpperCase()))
  ).sort((a, b) => (usoValido(b.km) ?? -1) - (usoValido(a.km) ?? -1) || a.placa.localeCompare(b.placa)), [todas, areasSel, categorias, modulos, busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const comFranquia = resumo.grupos.filter(g => g.franquia)
  const semFranquia = resumo.grupos.filter(g => !g.franquia)
  const tot = {
    excedente: comFranquia.reduce((s, g) => s + (g.excedente ?? 0), 0),
    rodado: comFranquia.reduce((s, g) => s + g.kmRodado, 0),
    limite: comFranquia.reduce((s, g) => s + (g.limite ?? 0), 0),
  }
  const pctTot = tot.limite ? (tot.rodado / tot.limite) * 100 : null
  const rotuloRf = rfSel ? `RF'${String(rfSel.mes).padStart(2, '0')}/${rfSel.ano} (${fmtData(rfSel.inicio)} a ${fmtData(rfSel.fim)})` : 'Mês Suzano'
  const areasVisiveis = AREAS.filter(a => naArea(a) && comFranquia.some(g => g.area === a))

  // RF parcial: primeira leitura de KM bem depois do início do RF.
  const primeira = todas.filter(l => usoValido(l.km) != null).map(l => l.km!.dataInicial!).filter(Boolean).sort()[0]
  const parcial = rfSel && primeira && primeira > somarDias(rfSel.inicio, 3) ? primeira : null
  const emAndamento = rfSel && hoje >= rfSel.inicio && hoje <= rfSel.fim

  const placasDoGrupo = (g: ResumoGrupo) => todas.filter(l => (l.franquia?.chave ?? `${norm(l.tipo) || 'SEM TIPO'}|${norm(l.area) || 'SEM ÁREA'}`) === g.chave)
  const abrirGrupo = (g: ResumoGrupo) => setDetalhe({
    titulo: g.franquia ? g.rotulo : `${capital(g.tipo)} · ${capital(g.area)}`,
    sub: `${capital(g.area)} · ${rotuloRf}${g.franquia ? ` · franquia ${fmtNum(g.franquia.kmPorVeiculo)} KM/veículo` : ' · sem franquia no contrato'}`,
    grupo: g, area: null, placas: placasDoGrupo(g),
  })
  const abrirArea = (a: ResumoArea) => setDetalhe({
    titulo: `Total ${capital(a.area)}`, sub: `Todas as categorias com franquia · ${rotuloRf}`,
    grupo: null, area: a, placas: todas.filter(l => l.area === a.area && l.franquia),
  })

  const exportar = (f: 'xlsx' | 'csv') => {
    setMenuExp(false)
    const porPlaca = linhas.map(l => {
      const r = usoValido(l.km)
      return {
        Placa: l.placa, Categoria: l.tipo, 'Área': capital(l.area), 'Módulo': l.modulo,
        'KM inicial': arred(l.km?.temLeituraNoPeriodo ? l.km.leituraInicial : null), 'Data KM inicial': fmtData(l.km?.dataInicial),
        'KM final': arred(l.km?.temLeituraNoPeriodo ? l.km.leituraFinal : null), 'Data KM final': fmtData(l.km?.dataFinal),
        'KM rodado': arred(r), 'Franquia KM/veículo': l.franquia?.kmPorVeiculo ?? null,
        'Acima da franquia individual (KM)': r != null && l.franquia ? arred(Math.max(0, r - l.franquia.kmPorVeiculo)) : null,
      }
    })
    const nome = rfSel ? `km_excedente_RF${String(rfSel.mes).padStart(2, '0')}_${rfSel.ano}` : 'km_excedente'
    if (f === 'csv') { void exportarTabela(porPlaca, nome, 'KM por placa', 'csv'); return }
    const resumoRows = [
      ...resumo.grupos.map(g => ({
        'Mês Suzano': rotuloRf, Categoria: g.franquia ? g.rotulo : `${capital(g.tipo)} · ${capital(g.area)}`, 'Área': capital(g.area),
        'Veículos (contrato)': g.franquia?.veiculosContrato ?? null, 'Placas com KM': g.comKm,
        'Franquia KM/veículo': g.franquia?.kmPorVeiculo ?? null, 'Limite da frota (KM)': g.limite, 'KM rodado': arred(g.kmRodado),
        'Média por veículo (KM)': arred(g.mediaPorVeiculo), '% do limite': g.pctLimite == null ? null : Math.round(g.pctLimite),
        'KM excedente': g.franquia ? arred(g.excedente) : 'Sem franquia',
      })),
      ...resumo.areas.map(a => ({
        'Mês Suzano': rotuloRf, Categoria: `TOTAL ${a.area}`, 'Área': capital(a.area), 'Veículos (contrato)': null, 'Placas com KM': null,
        'Franquia KM/veículo': null, 'Limite da frota (KM)': a.limite, 'KM rodado': arred(a.kmRodado), 'Média por veículo (KM)': null,
        '% do limite': a.limite ? Math.round((a.kmRodado / a.limite) * 100) : null, 'KM excedente': arred(a.excedente),
      })),
    ]
    void exportarAbas([{ aba: 'Resumo franquia', rows: resumoRows }, { aba: 'KM por placa', rows: porPlaca }], nome)
  }

  const th = 'px-3 py-2 font-bold border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const td = 'px-3 py-2 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const linhaClicavel = 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/20 group'
  const faixa = (texto: string) => (
    <tr className="bg-green-50 dark:bg-green-950/30">
      <td colSpan={8} className="px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-wider text-green-800 dark:text-green-300 border-b border-green-200 dark:border-green-900/50">
        {texto}
      </td>
    </tr>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 backdrop-blur shadow-sm p-3 flex flex-wrap items-center gap-2">
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
        <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden text-[13px] font-semibold" role="group" aria-label="Área">
          {([['', 'Todas as áreas'], ['COLHEITA', 'Colheita'], ['CARREGAMENTO', 'Carregamento']] as const).map(([v, rot]) => {
            const ativo = v ? areasSel.length === 1 && areasSel[0] === v : !areasSel.length
            return (
              <button key={rot} type="button" onClick={() => setAreasSel(v ? [v] : [])}
                className={`px-3 py-2 transition-colors ${ativo ? 'bg-blue-600 text-white' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                {rot}
              </button>
            )
          })}
        </div>
        <CheckboxMultiSelect values={categorias} onChange={setCategorias} selecionarTodos
          options={opcoesCategoria.map(c => ({ value: c, label: c }))} placeholder="Categoria" />
        <CheckboxMultiSelect values={modulos} onChange={setModulos} selecionarTodos
          options={opcoesModulo.map(m => ({ value: m, label: m }))} placeholder="Módulo" />
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 min-w-[150px]">
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
          <button type="button" onClick={() => { base.recarregar(); extra.recarregar() }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 text-xs font-semibold"><RefreshCcw size={13} /> Tentar de novo</button>
        </div>
      )}

      {!dados && !erro ? (
        <div className="h-[360px] rounded-xl bg-zinc-200/70 dark:bg-zinc-800 animate-pulse" />
      ) : dados && (
        <>
          {carregando && <div className="flex items-center gap-2 text-xs text-blue-600"><Loader2 size={13} className="animate-spin" /> Atualizando dados…</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className={`rounded-xl border bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1 ${tot.excedente ? 'border-red-200 dark:border-red-900/50' : 'border-zinc-200 dark:border-zinc-800'}`}>
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-500">KM excedente · {areasSel.length === 1 ? capital(areasSel[0]) : 'frota'} <Route size={16} className={tot.excedente ? 'text-red-500' : 'text-blue-600'} /></div>
              <div className={`text-2xl font-extrabold tabular-nums ${tot.excedente ? 'text-red-600 dark:text-red-400' : 'text-zinc-900 dark:text-white'}`}>{fmtNum(tot.excedente, 1)} <span className="text-sm font-bold text-blue-600">KM</span></div>
              <div className="text-[11px] text-zinc-500">{rotuloRf}{emAndamento ? ' · em andamento' : ''}</div>
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">KM rodado × limite</div>
              <div className="text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{fmtNum(tot.rodado, 1)} <span className="text-sm font-bold text-zinc-400">/ {fmtNum(tot.limite)} KM</span></div>
              <BarraLimite pct={pctTot} />
            </div>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1">
              <div className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Placas com KM no RF</div>
              <div className="text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{todas.filter(l => naArea(l.area) && usoValido(l.km) != null).length} <span className="text-sm font-bold text-zinc-400">de {todas.filter(l => naArea(l.area)).length}</span></div>
              {parcial && <div className="text-[11px] font-semibold text-amber-600 flex items-center gap-1"><AlertTriangle size={12} /> Parcial: as leituras de KM começam em {fmtData(parcial)}</div>}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2"><Gauge size={15} className="text-blue-600" /> Resumo da franquia por categoria e área · {rotuloRf}</h3>
              <p className="text-[11px] text-zinc-500">Contrato item 2.4 — cobrança pela média rodada da frota por mês e tipo de equipamento. <b>Clique numa categoria</b> para ver as placas.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className={`${th} text-left`}>Categoria</th>
                    <th className={`${th} text-center`}>Veículos</th>
                    <th className={`${th} text-right`}>Franquia / veíc.</th>
                    <th className={`${th} text-right`}>Limite da frota</th>
                    <th className={`${th} text-right`}>KM rodado</th>
                    <th className={`${th} text-right`}>Média / veíc.</th>
                    <th className={`${th} text-right`}>% do limite</th>
                    <th className={`${th} text-right`}>KM excedente</th>
                  </tr>
                </thead>
                <tbody>
                  {areasVisiveis.map(area => {
                    const grupos = comFranquia.filter(g => g.area === area)
                    const a = resumo.areas.find(x => x.area === area)
                    return (
                      <Fragment key={area}>
                        {faixa(capital(area))}
                        {grupos.map(g => (
                          <tr key={g.chave} className={linhaClicavel} onClick={() => abrirGrupo(g)} title="Ver placas">
                            <td className={`${td} font-semibold text-blue-700 dark:text-blue-400`}>
                              <span className="inline-flex items-center gap-1">{g.rotulo} <ChevronRight size={13} className="opacity-40 group-hover:opacity-100" /></span>
                            </td>
                            <td className={`${td} text-center tabular-nums`} title={`${g.franquia!.veiculosContrato} no contrato · ${g.placas} no cadastro`}>
                              {g.franquia!.veiculosContrato}{g.placas !== g.franquia!.veiculosContrato && <span className="ml-1 text-[10px] text-amber-600">({g.placas} cad.)</span>}
                              <div className="text-[10px] text-zinc-400">{g.comKm} c/ KM</div>
                            </td>
                            <td className={`${td} text-right tabular-nums`}>{fmtNum(g.franquia!.kmPorVeiculo)} KM</td>
                            <td className={`${td} text-right tabular-nums font-semibold`}>{fmtNum(g.limite)} KM</td>
                            <td className={`${td} text-right tabular-nums font-semibold`}>{fmtNum(g.kmRodado, 1)} KM</td>
                            <td className={`${td} text-right tabular-nums`}>{fmtNum(g.mediaPorVeiculo, 1)} KM</td>
                            <td className={`${td} text-right`}><BarraLimite pct={g.pctLimite} /></td>
                            <td className={`${td} text-right tabular-nums`}><Excedente v={g.excedente} /></td>
                          </tr>
                        ))}
                        {a && (
                          <tr className={`bg-zinc-50 dark:bg-zinc-950 font-bold ${linhaClicavel}`} onClick={() => abrirArea(a)} title="Ver placas da área">
                            <td className={td}><span className="inline-flex items-center gap-1">Total {capital(area)} <ChevronRight size={13} className="opacity-40 group-hover:opacity-100" /></span></td>
                            <td colSpan={2} className={td} />
                            <td className={`${td} text-right tabular-nums`}>{fmtNum(a.limite)} KM</td>
                            <td className={`${td} text-right tabular-nums`}>
                              {fmtNum(a.kmRodado, 1)} KM
                              {a.kmSemFranquia > 0 && <div className="text-[10px] font-normal text-zinc-400">+ {fmtNum(a.kmSemFranquia, 1)} KM sem franquia</div>}
                            </td>
                            <td className={`${td} text-right`}>—</td>
                            <td className={`${td} text-right`}><BarraLimite pct={a.limite ? (a.kmRodado / a.limite) * 100 : null} /></td>
                            <td className={`${td} text-right tabular-nums`}><Excedente v={a.excedente} /></td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {semFranquia.length > 0 && (
                    <>
                      {faixa('Sem franquia no contrato (só KM rodado)')}
                      {semFranquia.map(g => (
                        <tr key={g.chave} className={`text-zinc-500 ${linhaClicavel}`} onClick={() => abrirGrupo(g)} title="Ver placas">
                          <td className={td}><span className="inline-flex items-center gap-1">{capital(g.tipo || 'Sem tipo')} · {capital(g.area || 'sem área')} <ChevronRight size={13} className="opacity-40 group-hover:opacity-100" /></span></td>
                          <td className={`${td} text-center tabular-nums`}>{g.placas}<div className="text-[10px] text-zinc-400">{g.comKm} c/ KM</div></td>
                          <td className={`${td} text-right`}>—</td>
                          <td className={`${td} text-right`}>—</td>
                          <td className={`${td} text-right tabular-nums`}>{g.comKm ? `${fmtNum(g.kmRodado, 1)} KM` : '—'}</td>
                          <td colSpan={3} className={`${td} text-right text-zinc-400`}>sem franquia no contrato</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                <tfoot>
                  <tr className="bg-zinc-100 dark:bg-zinc-950 font-extrabold text-zinc-800 dark:text-zinc-100">
                    <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800">Total {areasSel.length === 1 ? capital(areasSel[0]) : 'da frota'}</td>
                    <td colSpan={2} className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                    <td className="px-3 py-2 text-right tabular-nums border-r border-zinc-200 dark:border-zinc-800">{fmtNum(tot.limite)} KM</td>
                    <td className="px-3 py-2 text-right tabular-nums border-r border-zinc-200 dark:border-zinc-800">{fmtNum(tot.rodado, 1)} KM</td>
                    <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                    <td className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800"><BarraLimite pct={pctTot} /></td>
                    <td className="px-3 py-2 text-right tabular-nums"><Excedente v={tot.excedente} /></td>
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
                  <th className={`${th} sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950 text-left`}>Placa</th>
                  <th className={`${th} text-left`}>Categoria</th>
                  <th className={`${th} text-left`}>Área</th>
                  <th className={`${th} text-left`}>Módulo</th>
                  <th className={`${th} text-right`}>KM inicial</th>
                  <th className={`${th} text-right`}>KM final</th>
                  <th className={`${th} text-right`}>KM rodado</th>
                  <th className={`${th} text-right`}>Franquia</th>
                  <th className={`${th} text-right`}>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => {
                  const tem = !!l.km?.temLeituraNoPeriodo
                  return (
                    <tr key={l.placa} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className={`${td} sticky left-0 z-10 bg-white dark:bg-zinc-900 font-bold text-amber-700 dark:text-amber-400`}>{l.placa}</td>
                      <td className={`${td} text-zinc-600 dark:text-zinc-300`}>{l.tipo}</td>
                      <td className={`${td} text-zinc-600 dark:text-zinc-300`}>{capital(l.area)}</td>
                      <td className={`${td} text-zinc-600 dark:text-zinc-300`}>{l.modulo}</td>
                      <td className={`${td} text-right tabular-nums`}>{tem ? <>{fmtNum(l.km!.leituraInicial, 1)} KM<div className="text-[10px] text-zinc-400">{fmtData(l.km!.dataInicial)}</div></> : '—'}</td>
                      <td className={`${td} text-right tabular-nums`}>{tem ? <>{fmtNum(l.km!.leituraFinal, 1)} KM<div className="text-[10px] text-zinc-400">{fmtData(l.km!.dataFinal)}</div></> : '—'}</td>
                      <td className={`${td} text-right tabular-nums font-extrabold text-blue-700 dark:text-blue-400`}>{usoValido(l.km) != null ? `${fmtNum(usoValido(l.km), 1)} KM` : '—'}</td>
                      <td className={`${td} text-right tabular-nums text-zinc-500`}>{l.franquia ? `${fmtNum(l.franquia.kmPorVeiculo)} KM` : '—'}</td>
                      <td className={`${td} text-right`}><SituacaoPlaca l={l} /></td>
                    </tr>
                  )
                })}
                {!linhas.length && <tr><td colSpan={9} className="p-8 text-center text-sm text-zinc-400">Nenhuma placa no filtro</td></tr>}
              </tbody>
              {linhas.length > 0 && (
                <tfoot>
                  <tr className="bg-zinc-100 dark:bg-zinc-950 font-bold text-zinc-800 dark:text-zinc-100">
                    <td className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-950 px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">Total: {linhas.length} placas</td>
                    <td colSpan={5} className="px-3 py-2 text-right text-[11px] text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">{linhas.filter(l => usoValido(l.km) != null).length} placas com KM</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(linhas.reduce((s, l) => s + (usoValido(l.km) ?? 0), 0), 1)} KM</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">
            Período: mês operacional Suzano. KM rodado = último KM lançado no RF − primeiro KM lançado no RF (só pesados ativos). KM excedente = KM rodado do grupo − limite da frota (franquia × veículos do contrato), quando passar.
            &quot;Situação&quot; por placa compara com a franquia individual (informativo). KM fora da sequência (provável erro de digitação) é ignorado.
          </p>
        </>
      )}

      {detalhe && <PainelDetalhe d={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  )
}
