'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PencilLine, X, Save, AlertTriangle } from 'lucide-react'
import { corrigirLeituraHorimetro, lancarLeituraCalendario } from './actions'

/** Leitura de historico_horimetros que pode ser corrigida. */
export type LeituraEditavel = {
  id: string
  placa: string
  unidade: 'h' | 'km'
  valor_novo: number
  km_novo: number | null
  valor_anterior?: number | null
  km_anterior?: number | null
  /** Dia da leitura (aaaa-mm-dd). */
  data: string
  atualizado_por_nome?: string | null
  observacoes?: string | null
}

/** Lançamento novo numa célula vazia do calendário. */
export type NovaLeitura = { preventivaId: string; placa: string; unidade: 'h' | 'km'; data: string }

type Props = {
  /** Leituras do mesmo dia/placa; se houver mais de uma, o usuário escolhe qual corrigir. */
  leituras: LeituraEditavel[]
  /** Quando informado, a janela lança uma leitura nova em vez de corrigir. */
  nova?: NovaLeitura
  onClose: () => void
}

const fmt = (v: number | null | undefined) => (v == null ? '—' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 }))
const dBr = (d: string) => d.split('-').reverse().join('/')
/** Aceita "164.679,4", "164679,4", "164679.4" e "164.679". */
const num = (v: string): number | null => {
  let t = v.trim().replace(/\s/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
/** Valor pro input no formato que o usuário digita (vírgula decimal, sem milhar). */
const paraInput = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? '' : String(v).replace('.', ','))

const inputCls = 'w-full px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 outline-none dark:text-white tabular-nums'
const labelCls = 'text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1'

/**
 * Corrigir leitura (erro de digitação): muda horímetro/KM/data de uma leitura já lançada.
 * A correção fica anotada na observação da leitura (quem, quando, de → para).
 */
export default function EditarLeituraModal({ leituras, nova, onClose }: Props) {
  const [idSel, setIdSel] = useState(leituras[leituras.length - 1]?.id)
  const l: LeituraEditavel = nova
    ? { id: '', placa: nova.placa, unidade: nova.unidade, valor_novo: NaN, km_novo: null, data: nova.data }
    : leituras.find(x => x.id === idSel) || leituras[0]
  const ehKm = l.unidade === 'km'

  const [data, setData] = useState(l.data)
  const [valor, setValor] = useState(paraInput(l.valor_novo))
  const [km, setKm] = useState(paraInput(l.km_novo))
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => { setMontado(true) }, [])
  useEffect(() => {
    setData(l.data); setValor(paraInput(l.valor_novo)); setKm(paraInput(l.km_novo)); setErro(null)
  }, [l.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose, salvando])

  const vValor = num(valor)
  const vKm = num(km)
  const avisos: string[] = []
  if (vValor != null && l.valor_anterior != null && vValor < Number(l.valor_anterior)) {
    avisos.push(`${ehKm ? 'O KM' : 'O horímetro'} (${fmt(vValor)}) ficou menor que a leitura anterior (${fmt(l.valor_anterior)}).`)
  }
  if (!ehKm && vKm != null && l.km_anterior != null && vKm < Number(l.km_anterior)) {
    avisos.push(`O KM (${fmt(vKm)}) ficou menor que o KM anterior (${fmt(l.km_anterior)}).`)
  }

  const salvar = async () => {
    setErro(null)
    if (!data) return setErro('Informe a data da leitura.')
    if (vValor == null) return setErro(ehKm ? 'Informe o KM.' : 'Informe o horímetro.')
    if (!ehKm && km.trim() && vKm == null) return setErro('KM inválido.')
    if (!navigator.onLine) return setErro(`Sem internet: ${nova ? 'o lançamento' : 'a correção'} de leitura precisa estar online.`)
    setSalvando(true)
    try {
      const res = nova
        ? await lancarLeituraCalendario({ preventiva_id: nova.preventivaId, data_referencia: data, valor_novo: vValor, km_novo: ehKm ? null : vKm, observacoes: motivo.trim() || null })
        : await corrigirLeituraHorimetro(l.id, { data_referencia: data, valor_novo: vValor, km_novo: ehKm ? null : vKm, motivo: motivo.trim() || null })
      if ('error' in res) { setErro(res.error); return }
      // Atualiza calendário/dashboard e a cópia local das preventivas (o "atual" pode ter mudado).
      window.dispatchEvent(new Event('horimetro-leitura-registrada'))
      try {
        const { syncTables } = await import('@/lib/offline-sync')
        await syncTables(['preventivas'])
        window.dispatchEvent(new Event('offline-db-updated-preventivas'))
      } catch { /* a tela recarrega no próximo sync */ }
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  if (!montado) return null

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget && !salvando) onClose() }}>
      <div className="bg-white dark:bg-zinc-950 w-full max-w-md rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 rounded-lg"><PencilLine size={18} /></div>
            <div>
              <h2 className="font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight text-sm">{nova ? 'Lançar leitura' : 'Corrigir leitura'}</h2>
              <p className="text-xs text-zinc-500"><span className="font-bold text-amber-600 dark:text-amber-400">{l.placa}</span> · {nova ? `dia ${dBr(l.data)}` : <>lançada em {dBr(l.data)}{l.atualizado_por_nome ? ` por ${l.atualizado_por_nome}` : ''}</>}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={salvando} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          {!nova && leituras.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>Leitura do dia ({leituras.length} lançamentos)</label>
              <select className={inputCls} value={idSel} onChange={e => setIdSel(e.target.value)}>
                {leituras.map((x, i) => (
                  <option key={x.id} value={x.id}>
                    {i + 1}º — {x.unidade === 'km' ? `${fmt(x.valor_novo)} km` : `${fmt(x.valor_novo)} h${x.km_novo != null ? ` · ${fmt(x.km_novo)} km` : ''}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {!nova && <div className="rounded-xl bg-zinc-50 dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-500 tabular-nums">
            Valores lançados: <b className="text-zinc-700 dark:text-zinc-200">{ehKm ? `${fmt(l.valor_novo)} km` : `${fmt(l.valor_novo)} h`}</b>
            {!ehKm && <> · <b className="text-blue-700 dark:text-blue-400">{fmt(l.km_novo)} km</b></>}
            {l.valor_anterior != null && <span className="block mt-0.5">Leitura anterior: {fmt(l.valor_anterior)} {ehKm ? 'km' : 'h'}{!ehKm && l.km_anterior != null ? ` · ${fmt(l.km_anterior)} km` : ''}</span>}
          </div>}

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Data da leitura <span className="text-red-500">*</span></label>
            <input type="date" className={inputCls} value={data} onChange={e => setData(e.target.value)} />
          </div>

          <div className={`grid gap-3 ${ehKm ? 'grid-cols-1' : 'grid-cols-2'}`}>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{ehKm ? 'KM' : 'Horímetro (h)'} <span className="text-red-500">*</span></label>
              <input inputMode="decimal" autoFocus className={inputCls} value={valor} onChange={e => setValor(e.target.value)} />
            </div>
            {!ehKm && (
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>KM</label>
                <input inputMode="decimal" className={inputCls} value={km} onChange={e => setKm(e.target.value)} placeholder="Sem KM" />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>{nova ? 'Observação' : 'Motivo da correção'}</label>
            <input className={inputCls + ' font-medium'} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder={nova ? 'Ex.: leitura esquecida' : 'Ex.: erro de digitação'} />
          </div>

          {avisos.map(a => (
            <div key={a} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {a} Confira antes de salvar.
            </div>
          ))}
          {erro && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">{erro}</div>}
          <p className="text-[11px] text-zinc-400">{nova
            ? 'A leitura entra no histórico com o seu nome. O atual da preventiva só muda se esta for a leitura mais recente da placa.'
            : 'A correção fica registrada na observação da leitura (quem corrigiu, quando e o valor antigo).'}</p>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} disabled={salvando} className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-black shadow-lg shadow-amber-500/20 disabled:opacity-50">
            <Save size={15} /> {salvando ? 'Salvando...' : nova ? 'Lançar leitura' : 'Salvar correção'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
