'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, RefreshCcw, Route, Search, Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { CheckboxMultiSelect } from '@/components/checkbox-multi-select'
import {
  montarLinhas, somarDias, somarMeses, fimDoMes, fmtNum, fmtData, tipoFrota, usoValido,
  type ResultadoUso, type Periodo,
} from '@/lib/horimetro-km-calc'
import { useLeiturasDashboard } from './useLeiturasDashboard'
import { hojeLocal } from './useFiltrosUrl'
import { exportarTabela } from './exportar'

const FOLGA_BASE_DIAS = 92
const MESES_NOME = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const nomeMes = (am: string) => `${MESES_NOME[+am.slice(5, 7) - 1]} ${am.slice(0, 4)}`
const selectCls = 'px-3 py-2 text-[13px] font-semibold rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer'
const arred = (v: number | null) => (v == null ? null : Math.round(v * 10) / 10)

type Celula = { r: ResultadoUso | null }
type Linha = { placa: string; tipo: string; modulo: string; civil: ResultadoUso | null; suzano: ResultadoUso | null }

/** Três células de um período: primeiro KM, último KM e excedente (último − primeiro). */
function CelulasPeriodo({ r }: Celula) {
  const exced = usoValido(r)
  const base = 'px-3 py-2 text-right tabular-nums border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
  const km = (v: number | null, d: string | null) => v == null ? <span className="text-zinc-300 dark:text-zinc-700">—</span> : (
    <div className="leading-tight"><div className="font-semibold text-zinc-700 dark:text-zinc-200">{fmtNum(v, 1)} KM</div><div className="text-[10px] text-zinc-400">{fmtData(d)}</div></div>
  )
  return (
    <>
      <td className={base}>{km(r?.temLeituraNoPeriodo ? r.leituraInicial : null, r?.dataInicial ?? null)}</td>
      <td className={base}>{km(r?.temLeituraNoPeriodo ? r.leituraFinal : null, r?.dataFinal ?? null)}</td>
      <td className={`${base} font-extrabold`}>
        {exced != null ? <span className="text-blue-700 dark:text-blue-400">{fmtNum(exced, 1)} KM</span>
          : r?.insuficiente ? <span className="text-[10px] font-bold uppercase text-amber-600" title="Só 1 leitura de KM no período: precisa de pelo menos 2">1 leitura</span>
          : <span className="text-[10px] font-bold uppercase text-zinc-400">Sem leitura</span>}
      </td>
    </>
  )
}

/**
 * Planilha de KM excedente dos PESADOS: KM rodado em cada mês = último KM − primeiro KM lançados
 * dentro do mês. Mostra lado a lado o mês normal (dia 1 ao último dia) e o mês operacional Suzano (RF).
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
  const equipamentos = useMemo(() => pesados.filter(e =>
    (!categorias.length || categorias.includes(e.tipo || 'SEM TIPO')) &&
    (!modulos.length || modulos.includes(e.modulo || 'SEM MÓDULO')) &&
    (!busca.trim() || e.placa.toUpperCase().includes(busca.trim().toUpperCase()))
  ), [pesados, categorias, modulos, busca])

  const linhas = useMemo<Linha[]>(() => {
    if (!dados) return []
    const civil = montarLinhas(equipamentos, dados.leituras, perCivil, hoje, 7)
    const suz = rfSel && leiturasRf ? montarLinhas(equipamentos, leiturasRf, { inicio: rfSel.inicio, fim: rfSel.fim }, hoje, 7) : []
    return civil.map((l, i) => ({
      placa: l.equipamento.placa, tipo: l.equipamento.tipo || '—', modulo: l.equipamento.modulo || '—',
      civil: l.km, suzano: suz[i]?.km ?? null,
    })).sort((a, b) => (usoValido(b.civil) ?? -1) - (usoValido(a.civil) ?? -1) || a.placa.localeCompare(b.placa))
  }, [dados, equipamentos, perCivil.inicio, perCivil.fim, hoje, rfSel, leiturasRf]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = (k: 'civil' | 'suzano') => linhas.reduce((s, l) => s + (usoValido(l[k]) ?? 0), 0)
  const comKm = (k: 'civil' | 'suzano') => linhas.filter(l => usoValido(l[k]) != null).length
  const rotuloRf = rfSel ? `RF'${String(rfSel.mes).padStart(2, '0')}/${rfSel.ano} (${fmtData(rfSel.inicio)} a ${fmtData(rfSel.fim)})` : 'Mês Suzano'

  const exportar = (f: 'xlsx' | 'csv') => {
    setMenuExp(false)
    const rows = linhas.map(l => ({
      Placa: l.placa, Categoria: l.tipo, 'Módulo': l.modulo,
      [`${nomeMes(mes)} - 1º KM`]: arred(l.civil?.temLeituraNoPeriodo ? l.civil.leituraInicial : null),
      [`${nomeMes(mes)} - Último KM`]: arred(l.civil?.temLeituraNoPeriodo ? l.civil.leituraFinal : null),
      [`${nomeMes(mes)} - KM excedente`]: arred(usoValido(l.civil)),
      [`${rotuloRf} - 1º KM`]: arred(l.suzano?.temLeituraNoPeriodo ? l.suzano.leituraInicial : null),
      [`${rotuloRf} - Último KM`]: arred(l.suzano?.temLeituraNoPeriodo ? l.suzano.leituraFinal : null),
      [`${rotuloRf} - KM excedente`]: arred(usoValido(l.suzano)),
    }))
    void exportarTabela(rows, `km_excedente_pesados_${mes}`, 'KM excedente', f)
  }

  const th = 'px-3 py-2 font-bold border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap'
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
          <button type="button" disabled={!linhas.length} onClick={() => setMenuExp(a => !a)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40">
            <Download size={13} /> Exportar
          </button>
          {menuExp && (
            <div className="absolute right-0 z-30 mt-1 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
              <button type="button" onClick={() => exportar('xlsx')} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileSpreadsheet size={13} className="text-emerald-600" /> Excel (.xlsx)</button>
              <button type="button" onClick={() => exportar('csv')} className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><FileText size={13} className="text-zinc-500" /> CSV</button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {([['civil', nomeMes(mes)], ['suzano', rotuloRf]] as const).map(([k, rot]) => (
              <div key={k} className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                  KM excedente · {k === 'civil' ? 'mês normal' : 'mês Suzano'} <Route size={16} className="text-blue-600" />
                </div>
                <div className="text-2xl font-extrabold tabular-nums text-zinc-900 dark:text-white">{fmtNum(total(k), 1)} <span className="text-sm font-bold text-blue-600">KM</span></div>
                <div className="text-[11px] text-zinc-500">{rot} · {comKm(k)} de {linhas.length} placas com KM no período</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                  <th rowSpan={2} className={`${th} sticky left-0 z-10 bg-zinc-50 dark:bg-zinc-950 text-left`}>Placa</th>
                  <th rowSpan={2} className={`${th} text-left`}>Categoria</th>
                  <th rowSpan={2} className={`${th} text-left`}>Módulo</th>
                  <th colSpan={3} className={`${th} text-center text-blue-700 dark:text-blue-400`}>Mês normal · {nomeMes(mes)}</th>
                  <th colSpan={3} className={`${th} text-center text-emerald-700 dark:text-emerald-400`}>Mês Suzano · {rotuloRf}</th>
                </tr>
                <tr className="bg-zinc-50 dark:bg-zinc-950 text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className={`${th} text-right`}>1º KM</th><th className={`${th} text-right`}>Último KM</th><th className={`${th} text-right`}>KM excedente</th>
                  <th className={`${th} text-right`}>1º KM</th><th className={`${th} text-right`}>Último KM</th><th className={`${th} text-right`}>KM excedente</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(l => (
                  <tr key={l.placa} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="sticky left-0 z-10 bg-white dark:bg-zinc-900 px-3 py-2 font-bold text-amber-700 dark:text-amber-400 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.placa}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.tipo}</td>
                    <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300 border-b border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{l.modulo}</td>
                    <CelulasPeriodo r={l.civil} />
                    <CelulasPeriodo r={l.suzano} />
                  </tr>
                ))}
                {!linhas.length && <tr><td colSpan={9} className="p-8 text-center text-sm text-zinc-400">Nenhuma placa no filtro</td></tr>}
              </tbody>
              {linhas.length > 0 && (
                <tfoot>
                  <tr className="bg-zinc-100 dark:bg-zinc-950 font-bold text-zinc-800 dark:text-zinc-100">
                    <td className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-950 px-3 py-2 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">Total: {linhas.length} placas</td>
                    <td colSpan={2} className="px-3 py-2 border-r border-zinc-200 dark:border-zinc-800" />
                    <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">{comKm('civil')} placas com KM</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400 border-r border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{fmtNum(total('civil'), 1)} KM</td>
                    <td colSpan={2} className="px-3 py-2 text-right text-[11px] text-zinc-500 border-r border-zinc-200 dark:border-zinc-800">{comKm('suzano')} placas com KM</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtNum(total('suzano'), 1)} KM</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="text-[11px] text-zinc-500">
            KM excedente = último KM lançado no período − primeiro KM lançado no período (só pesados ativos). Placa com uma única leitura de KM no período aparece como &quot;1 leitura&quot;; KM fora da sequência (provável erro de digitação) é ignorado.
          </p>
        </>
      )}
    </div>
  )
}
