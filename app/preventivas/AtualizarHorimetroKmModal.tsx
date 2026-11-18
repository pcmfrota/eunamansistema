'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Gauge, X, Save, ChevronDown, AlertTriangle } from 'lucide-react'

export type PrevParaAtualizar = {
  id: string
  ultimo_horimetro: number
  horimetro_atual: number
  intervalo_horas: number
  data_atualizacao: string | null
  km_atual?: number | null
  ultimo_km?: number | null
  equipamentos: { placa: string; tipo: string; categoria: string; modulo: string | null } | null
}

export type DadosAtualizacao = {
  data_referencia: string
  horimetro_atual: number
  km_atual: number | null
  ultimo_km: number | null
  ultimo_horimetro: number
  intervalo_horas: number
  observacoes: string | null
}

type Props = {
  prev: PrevParaAtualizar
  /** 'h' = pesados/Zocar (pede horímetro + KM); 'km' = leves (o valor principal já é o KM). */
  unidade: 'h' | 'km'
  salvando: boolean
  onClose: () => void
  onSave: (dados: DadosAtualizacao) => void
}

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const num = (v: string): number | null => {
  const t = v.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return isNaN(n) ? null : n
}

const inputCls = 'w-full px-3 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white'
const labelCls = 'text-xs font-black uppercase tracking-tighter text-zinc-500 ml-1'

/**
 * Modal "Atualizar Horímetro e KM" do Controle de Horímetro e KM. Substitui a edição direto
 * na linha da tabela: cada atualização vira também uma leitura datada no histórico, que é o
 * que aparece no Calendário de Leituras.
 */
export default function AtualizarHorimetroKmModal({ prev, unidade, salvando, onClose, onSave }: Props) {
  const ehLeve = unidade === 'km'
  const [data, setData] = useState(hoje())
  const [horimetro, setHorimetro] = useState('')
  const [kmAtual, setKmAtual] = useState('')
  const [ultimoKm, setUltimoKm] = useState(prev.ultimo_km != null ? String(prev.ultimo_km) : '')
  const [ultimoHorimetro, setUltimoHorimetro] = useState(String(prev.ultimo_horimetro ?? ''))
  const [intervalo, setIntervalo] = useState(String(prev.intervalo_horas ?? ''))
  const [obs, setObs] = useState('')
  const [mostrarAjustes, setMostrarAjustes] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [montado, setMontado] = useState(false)

  useEffect(() => { setMontado(true) }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !salvando) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, salvando])

  const vHorimetro = num(horimetro)
  const vKmAtual = num(kmAtual)
  const avisos: string[] = []
  if (vHorimetro != null && prev.horimetro_atual != null && vHorimetro < prev.horimetro_atual) {
    avisos.push(`${ehLeve ? 'O KM' : 'O horímetro'} informado (${vHorimetro}${unidade}) é menor que o último registrado (${prev.horimetro_atual}${unidade}).`)
  }
  if (!ehLeve && vKmAtual != null && prev.km_atual != null && vKmAtual < prev.km_atual) {
    avisos.push(`O KM informado (${vKmAtual} km) é menor que o último registrado (${prev.km_atual} km).`)
  }

  const salvar = () => {
    setErro(null)
    if (!data) return setErro('Informe a data da leitura.')
    if (vHorimetro == null) return setErro(ehLeve ? 'Informe o KM atual.' : 'Informe o horímetro atual.')
    if (!ehLeve && vKmAtual == null) return setErro('Informe o KM atual.')
    const vUltimoKm = num(ultimoKm)
    if (!ehLeve && kmAtual.trim() && ultimoKm.trim() && vUltimoKm == null) return setErro('Último KM inválido.')
    const vUltimoH = num(ultimoHorimetro)
    const vIntervalo = num(intervalo)
    if (vUltimoH == null || vIntervalo == null || vIntervalo <= 0) return setErro('Confira os ajustes da preventiva (último e intervalo).')
    onSave({
      data_referencia: data,
      horimetro_atual: vHorimetro,
      km_atual: ehLeve ? null : vKmAtual,
      ultimo_km: ehLeve ? null : vUltimoKm,
      ultimo_horimetro: vUltimoH,
      intervalo_horas: vIntervalo,
      observacoes: obs.trim() || null,
    })
  }

  if (!montado) return null
  const eq = prev.equipamentos

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={e => { if (e.target === e.currentTarget && !salvando) onClose() }}>
      <div className="bg-white dark:bg-zinc-950 w-full max-w-lg rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[92vh] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 rounded-lg"><Gauge size={18} /></div>
            <div>
              <h2 className="font-black text-zinc-800 dark:text-zinc-100 uppercase tracking-tight text-sm">Atualizar {ehLeve ? 'KM' : 'Horímetro e KM'}</h2>
              <p className="text-xs text-zinc-500"><span className="font-bold text-amber-600 dark:text-amber-400">{eq?.placa}</span> · {eq?.tipo}{eq?.modulo ? ` · ${eq.modulo}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={salvando} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X size={18} /></button>
        </div>

        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Data da leitura <span className="text-red-500">*</span></label>
            <input type="date" className={inputCls} value={data} max={hoje()} onChange={e => setData(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{ehLeve ? 'KM anterior' : 'Horímetro anterior'}</label>
              <div className={inputCls + ' bg-zinc-100 dark:bg-zinc-900/60 text-zinc-500'}>{prev.horimetro_atual ?? '-'}{unidade}</div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelCls}>{ehLeve ? 'KM atual' : 'Horímetro atual'} <span className="text-red-500">*</span></label>
              <input inputMode="decimal" autoFocus className={inputCls} placeholder={ehLeve ? 'Ex.: 45230' : 'Ex.: 8850'} value={horimetro} onChange={e => setHorimetro(e.target.value)} />
            </div>
          </div>

          {!ehLeve && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>Último KM</label>
                <input inputMode="decimal" className={inputCls} placeholder="KM da última preventiva" value={ultimoKm} onChange={e => setUltimoKm(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={labelCls}>KM atual <span className="text-red-500">*</span></label>
                <input inputMode="decimal" className={inputCls} placeholder={prev.km_atual != null ? `Anterior: ${prev.km_atual}` : 'Ex.: 182450'} value={kmAtual} onChange={e => setKmAtual(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className={labelCls}>Observações</label>
            <textarea rows={2} className={inputCls + ' font-medium resize-none'} value={obs} onChange={e => setObs(e.target.value)} />
          </div>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl">
            <button type="button" onClick={() => setMostrarAjustes(v => !v)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-tight text-zinc-500">
              Ajustes da preventiva (último {ehLeve ? 'KM' : 'horímetro'} e intervalo)
              <ChevronDown size={14} className={mostrarAjustes ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
            {mostrarAjustes && (
              <div className="grid grid-cols-2 gap-3 px-3 pb-3">
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Último (preventiva)</label>
                  <input inputMode="decimal" className={inputCls} value={ultimoHorimetro} onChange={e => setUltimoHorimetro(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelCls}>Intervalo ({unidade})</label>
                  <input inputMode="decimal" className={inputCls} value={intervalo} onChange={e => setIntervalo(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {avisos.map(a => (
            <div key={a} className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {a} Será salvo mesmo assim.
            </div>
          ))}
          {erro && <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold">{erro}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} disabled={salvando} className="px-5 py-2.5 rounded-xl text-sm font-bold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-500/20 disabled:opacity-50">
            <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar leitura'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
