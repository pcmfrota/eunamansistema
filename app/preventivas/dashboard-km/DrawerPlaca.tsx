'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertOctagon, PencilLine, ChevronDown, ChevronUp } from 'lucide-react'
import { fmtNum, fmtData, usoValido, type LinhaPlaca, type Unidade, type Periodo, type PontoClassificado } from '@/lib/horimetro-km-calc'
import { EvolucaoChart } from './Graficos'
import { StatusBadge } from './TabelaAnalitica'
import { Segmentado } from './FiltrosBar'

/**
 * Painel lateral da placa: leituras DO PERÍODO filtrado + a leitura-base (última antes do início,
 * de onde parte o cálculo do uso). O histórico mais antigo fica recolhido.
 */
export default function DrawerPlaca({ linha, periodo, onClose, onCorrigir }: { linha: LinhaPlaca; periodo: Periodo; onClose: () => void; onCorrigir?: (idLeitura: string) => void }) {
  const temKm = linha.pontosKm.length > 0
  const [serie, setSerie] = useState<Unidade>(linha.unidade)
  const [montado, setMontado] = useState(false)
  const [verAntigas, setVerAntigas] = useState(false)
  useEffect(() => { setMontado(true) }, [])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  if (!montado) return null

  const pontos = serie === linha.unidade ? linha.pontos : linha.pontosKm
  const r = serie === linha.unidade ? linha.principal : linha.km
  const eq = linha.equipamento
  const doPeriodo = pontos.filter(p => p.data >= periodo.inicio && p.data <= periodo.fim)
  const antes = pontos.filter(p => p.data < periodo.inicio)
  const antigas = antes
  const pontosGrafico = doPeriodo
  const linhaTabela = (p: PontoClassificado, i: number, extra?: string) => (
    <tr key={p.id || `${p.data}-${i}`} className={`border-b border-zinc-100 dark:border-zinc-800/60 ${p.inconsistente ? 'bg-red-50/60 dark:bg-red-900/10' : extra || ''}`} title={p.obs || undefined}>
      <td className="py-1.5">{fmtData(p.data)}</td>
      <td className="py-1.5 text-right font-semibold">{fmtNum(p.valor, 1)} {serie}</td>
      <td className={`py-1.5 text-right ${p.inconsistente ? 'text-red-600 font-bold' : 'text-zinc-500'}`}>
        {p.inconsistente && <AlertOctagon size={11} className="inline mr-1 -mt-0.5" />}
        {p.diferenca == null ? '—' : `${p.diferenca > 0 ? '+' : ''}${fmtNum(p.diferenca, 1)}`}
      </td>
      <td className="py-1.5 pl-3 text-zinc-500 truncate max-w-[110px]">{p.por || '—'}</td>
      {onCorrigir && (
        <td className="py-1.5 text-right">
          {p.id && (
            <button type="button" onClick={() => onCorrigir(p.id as string)} title="Corrigir esta leitura" aria-label="Corrigir esta leitura"
              className={`p-1 rounded-md hover:bg-amber-100 dark:hover:bg-amber-900/30 ${p.inconsistente ? 'text-amber-600' : 'text-zinc-400 hover:text-amber-600'}`}>
              <PencilLine size={13} />
            </button>
          )}
        </td>
      )}
    </tr>
  )
  const colunas = onCorrigir ? 5 : 4
  const separador = (texto: string) => (
    <tr><td colSpan={colunas} className="pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">{texto}</td></tr>
  )

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/40" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <aside className="w-full sm:max-w-md h-full bg-white dark:bg-zinc-950 shadow-2xl flex flex-col" role="dialog" aria-label={`Histórico de ${eq.placa}`}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-extrabold text-amber-700 dark:text-amber-400">{eq.placa}</h2>
            <p className="text-xs text-zinc-500">{eq.tipo} · {linha.frota === 'leve' ? 'Leve (KM)' : 'Pesado (horímetro)'}{eq.modulo ? ` · ${eq.modulo}` : ''}</p>
            <div className="mt-2"><StatusBadge status={linha.status} /></div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {temKm && linha.unidade === 'h' && (
            <Segmentado<Unidade> valor={serie} onChange={setSerie} opcoes={[{ v: 'h', l: 'Horímetro' }, { v: 'km', l: 'KM' }]} />
          )}
          <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-2"><div className="text-zinc-400">Uso no período</div><div className="font-bold">{r?.insuficiente ? <span className="text-amber-600">Insuficiente</span> : usoValido(r) != null ? `${fmtNum(r!.uso, 1)} ${serie}` : '—'}</div></div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-2"><div className="text-zinc-400">Média mensal</div><div className="font-bold">{r?.mediaMensal != null ? `${fmtNum(r.mediaMensal, 1)} ${serie}` : '—'}</div></div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900 p-2"><div className="text-zinc-400">Média diária</div><div className="font-bold">{r?.mediaDiaria != null ? `${fmtNum(r.mediaDiaria, 1)} ${serie}` : '—'}</div></div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-2">
            <EvolucaoChart pontos={pontosGrafico} unidade={serie} altura={180} />
          </div>

          <table className="w-full text-xs tabular-nums">
            <thead>
              <tr className="text-[11px] uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <th className="py-2 text-left font-bold">Data</th>
                <th className="py-2 text-right font-bold">Leitura</th>
                <th className="py-2 text-right font-bold">Diferença</th>
                <th className="py-2 text-left font-bold pl-3">Por</th>
                {onCorrigir && <th className="py-2 w-8" aria-label="Corrigir" />}
              </tr>
            </thead>
            <tbody>
              {separador(`No período (${fmtData(periodo.inicio)} a ${fmtData(periodo.fim)}) · ${doPeriodo.length} leitura${doPeriodo.length === 1 ? '' : 's'}`)}
              {[...doPeriodo].reverse().map((p, i) => linhaTabela(p, i))}
              {!doPeriodo.length && (
                <tr><td colSpan={colunas} className="py-3 text-center text-zinc-400">Nenhuma leitura lançada neste período.</td></tr>
              )}
              {verAntigas && antigas.length > 0 && separador('Histórico anterior')}
              {verAntigas && [...antigas].reverse().map((p, i) => linhaTabela(p, i, 'text-zinc-400'))}
            </tbody>
          </table>
          {antigas.length > 0 && (
            <button type="button" onClick={() => setVerAntigas(v => !v)} className="self-start flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
              {verAntigas ? <><ChevronUp size={13} /> Ocultar histórico anterior</> : <><ChevronDown size={13} /> Ver histórico anterior ({antigas.length})</>}
            </button>
          )}
          {r?.insuficiente ? (
            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">Só 1 leitura lançada no período: são necessárias pelo menos 2 leituras dentro do período para calcular o uso.</p>
          ) : usoValido(r) != null && (
            <p className="text-[11px] text-zinc-500">Uso no período = última leitura do período ({fmtData(r!.dataFinal)}) − primeira leitura do período ({fmtData(r!.dataInicial)}).</p>
          )}
          {pontos.some(p => p.inconsistente) && (
            <p className="text-[11px] text-red-600 dark:text-red-400">Linhas em vermelho são leituras fora da sequência (muito altas ou menores que as anteriores, provável erro de digitação): ficam fora dos cálculos até serem corrigidas{onCorrigir ? ' (use o lápis para corrigir)' : ''}.</p>
          )}
        </div>
      </aside>
    </div>,
    document.body
  )
}
