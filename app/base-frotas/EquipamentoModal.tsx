'use client'

import React, { useState, useEffect } from 'react'
import { X, Clock, Save } from 'lucide-react'
import { criarEquipamento, salvarVeiculoCompleto } from './actions'

interface EquipamentoModalProps {
  isOpen: boolean
  onClose: () => void
  editingVehicle?: any
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const TIPOS = ['COMBOIO', 'MUNCK', 'MULTIFUNCIONAL', 'PIPA', 'ESCAVADEIRA', 'CARRETAGEM', 'SAVEIRO', 'ESTRADA', 'C3', 'SKID', 'OUTROS']

export default function EquipamentoModal({ isOpen, onClose, editingVehicle }: EquipamentoModalProps) {
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  // Estado unificado do formulário
  const [f, setF] = useState({
    tipo: '',
    customTipo: '',
    categoria: 'PESADA',
    modulo: '',
    status: 'Ativo',
    horimetro: '',
    ultimaAtualizacao: todayStr(),
    carga_horaria: '',
    periodo_inicio: '08:00',
    periodo_fim: '16:00',
  })

  // Carrega dados do veículo quando abre o modal
  useEffect(() => {
    if (!isOpen) return
    if (editingVehicle) {
      setF({
        tipo: editingVehicle.tipo || '',
        customTipo: '',
        categoria: editingVehicle.categoria || 'PESADA',
        modulo: editingVehicle.modulo || '',
        status: editingVehicle.status || 'Ativo',
        horimetro: String(editingVehicle.ultimo_hist ?? editingVehicle.ultimoHist ?? ''),
        ultimaAtualizacao: todayStr(),
        carga_horaria: editingVehicle.escala?.carga_horaria != null
          ? String(editingVehicle.escala.carga_horaria)
          : '',
        periodo_inicio: editingVehicle.escala?.periodo_inicio
          ? String(editingVehicle.escala.periodo_inicio).slice(0, 5)
          : '08:00',
        periodo_fim: editingVehicle.escala?.periodo_fim
          ? String(editingVehicle.escala.periodo_fim).slice(0, 5)
          : '16:00',
      })
    } else {
      setF({
        tipo: '',
        customTipo: '',
        categoria: 'PESADA',
        modulo: '',
        status: 'Ativo',
        horimetro: '',
        ultimaAtualizacao: todayStr(),
        carga_horaria: '',
        periodo_inicio: '08:00',
        periodo_fim: '16:00',
      })
    }
    setSaved(false)
  }, [isOpen, editingVehicle?.id])

  if (!isOpen) return null

  const set = (field: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setSaved(false)

    try {
      if (editingVehicle) {
        // EDIÇÃO — usa a nova action unificada
        const tipoFinal = f.tipo === 'OUTROS' ? f.customTipo : f.tipo
        const res = await salvarVeiculoCompleto(editingVehicle.id, {
          tipo: tipoFinal,
          categoria: f.categoria,
          modulo: f.modulo,
          status: f.status,
          horimetro: f.horimetro,
          ultimaAtualizacao: f.ultimaAtualizacao,
          carga_horaria: f.carga_horaria,
          periodo_inicio: f.periodo_inicio,
          periodo_fim: f.periodo_fim,
          placa: editingVehicle.placa,
        })
        if ('error' in res) { alert(`Erro: ${res.error}`); return }
        if (res.horimetroWarning) {
          alert(`⚠️ Dados básicos e escala salvos!\n\nHorímetro não foi salvo:\n${res.horimetroWarning}`)
        }
        setSaved(true)
        setTimeout(() => onClose(), 800)
      } else {
        // CRIAÇÃO — via FormData
        const fd = new FormData(e.currentTarget)
        if (f.tipo === 'OUTROS') fd.set('tipo', f.customTipo)
        fd.set('horimetro', f.horimetro)
        fd.set('ultimaAtualizacao', f.ultimaAtualizacao)
        fd.set('carga_horaria', f.carga_horaria)
        fd.set('periodo_inicio', f.periodo_inicio)
        fd.set('periodo_fim', f.periodo_fim)
        const res = await criarEquipamento(fd)
        if ('error' in res) { alert(`Erro: ${res.error}`); return }
        setSaved(true)
        setTimeout(() => onClose(), 800)
      }
    } catch (err) {
      console.error(err)
      alert('Erro inesperado ao salvar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white'
  const labelCls = 'block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {editingVehicle ? (
                <>
                  Editar Veículo
                  <span className="px-2.5 py-0.5 text-sm font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg uppercase tracking-wider">
                    {editingVehicle.placa}
                  </span>
                </>
              ) : 'Novo Veículo'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {editingVehicle ? 'Edite os dados e clique em Salvar' : 'Preencha as informações do novo veículo'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-5">

            {/* ── Informações Básicas ─────────────────────────────── */}
            <div className="bg-blue-50/60 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Informações Básicas</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                {/* Placa */}
                {editingVehicle ? (
                  <div>
                    <label className={labelCls}>Placa <span className="ml-1 text-[10px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">FIXO</span></label>
                    <input
                      name="placa"
                      value={editingVehicle.placa}
                      readOnly
                      className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed font-bold uppercase"
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Placa <span className="text-red-500">*</span></label>
                    <input name="placa" required type="text" placeholder="ABC1234" className={inputCls} />
                  </div>
                )}

                {/* Tipo */}
                <div>
                  <label className={labelCls}>Tipo <span className="text-red-500">*</span></label>
                  <select name="tipo" required value={f.tipo} onChange={set('tipo')} className={inputCls}>
                    <option value="">Selecione</option>
                    {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {f.tipo === 'OUTROS' && (
                    <input type="text" value={f.customTipo} onChange={set('customTipo')} placeholder="Descreva o tipo..." className={`${inputCls} mt-2`} />
                  )}
                </div>

                {/* Categoria */}
                <div>
                  <label className={labelCls}>Categoria <span className="text-red-500">*</span></label>
                  <select name="categoria" required value={f.categoria} onChange={set('categoria')} className={inputCls}>
                    <option value="">Selecione</option>
                    <option value="PESADA">PESADA</option>
                    <option value="LEVE">LEVE</option>
                  </select>
                </div>

                {/* Módulo */}
                <div>
                  <label className={labelCls}>Módulo <span className="text-red-500">*</span></label>
                  <input name="modulo" required type="text" value={f.modulo} onChange={set('modulo')} placeholder="BASE" className={inputCls} />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-red-500 mb-1.5">Status <span className="text-red-500">*</span></label>
                  <select name="status" required value={f.status} onChange={set('status')} className={`${inputCls} font-bold border-red-200 dark:border-red-900/50 focus:ring-red-500/20 focus:border-red-500 dark:text-red-400`}>
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                  </select>
                </div>

              </div>
            </div>

            {/* ── Horímetro ─────────────────────────────────────── */}
            <div className="bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-4">Horímetro / KM</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Valor Atual (horas)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={f.horimetro}
                    onChange={set('horimetro')}
                    placeholder="Ex: 103276"
                    className={`${inputCls} focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Data da Leitura</label>
                  <input
                    type="date"
                    value={f.ultimaAtualizacao}
                    onChange={set('ultimaAtualizacao')}
                    className={`${inputCls} focus:ring-emerald-500/20 focus:border-emerald-500`}
                  />
                </div>
              </div>
            </div>

            {/* ── Escala de Trabalho ────────────────────────────── */}
            <div className="bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-5">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
                <Clock size={14} className="text-amber-500" /> Escala de Trabalho (PCM)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Horas planejadas para cálculo de DM e DO. Sem preenchimento, usa 24h/dia.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>Carga Horária (h/dia)</label>
                  <select
                    value={f.carga_horaria}
                    onChange={set('carga_horaria')}
                    className={`${inputCls} focus:ring-amber-500/20 focus:border-amber-500`}
                  >
                    <option value="">Não definido (24h padrão)</option>
                    <option value="8">8h</option>
                    <option value="12">12h</option>
                    <option value="16">16h</option>
                    <option value="20">20h</option>
                    <option value="24">24h</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Início do Turno</label>
                  <input
                    type="time"
                    value={f.periodo_inicio}
                    onChange={set('periodo_inicio')}
                    className={`${inputCls} focus:ring-amber-500/20 focus:border-amber-500`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Fim do Turno</label>
                  <input
                    type="time"
                    value={f.periodo_fim}
                    onChange={set('periodo_fim')}
                    className={`${inputCls} focus:ring-amber-500/20 focus:border-amber-500`}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-2xl shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              <Save size={15} />
              {loading ? 'Salvando...' : saved ? '✓ Salvo!' : (editingVehicle ? 'Salvar Alterações' : 'Cadastrar Veículo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
