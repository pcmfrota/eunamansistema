'use client'

import React, { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useFormDraft } from '@/hooks/use-form-draft'
import { criarEquipamento, atualizarEquipamento } from './actions'

interface EquipamentoModalProps {
  isOpen: boolean
  onClose: () => void
  editingVehicle?: any
}

export default function EquipamentoModal({ isOpen, onClose, editingVehicle }: EquipamentoModalProps) {
  const [loading, setLoading] = useState(false)
  
  const initialForm = {
    placa: '',
    tipo: '',
    categoria: '',
    modulo: '',
    horimetro: '',
    ultimaAtualizacao: new Date().toISOString().split('T')[0]
  }

  const { form, setForm, handleInputChange, clearDraft } = useFormDraft(
    editingVehicle ? `edit-eq-${editingVehicle.id}` : 'novo-equipamento',
    editingVehicle || initialForm
  )

  useEffect(() => {
    if (editingVehicle) {
      setForm({
        placa: editingVehicle.placa || '',
        tipo: editingVehicle.tipo || '',
        categoria: editingVehicle.categoria || '',
        modulo: editingVehicle.modulo || '',
        horimetro: editingVehicle.ultimoHist?.toString() || editingVehicle.horimetro || '',
        ultimaAtualizacao: editingVehicle.ultimaAtualizacao || new Date().toISOString().split('T')[0]
      })
    } else {
      // If we are opening "New" and there was no editing previously, we keep the draft
      // But if we just closed "Edit", we might want to reset to draft/initial
    }
  }, [editingVehicle, setForm])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const res = editingVehicle 
        ? await atualizarEquipamento(editingVehicle.id, formData)
        : await criarEquipamento(formData)

      if ('error' in res) {
        alert(res.error)
      } else {
        clearDraft()
        onClose()
      }
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar equipamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {editingVehicle ? "Editar Veículo" : "Novo Veículo"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {editingVehicle ? "Atualize os dados do veículo abaixo" : "Preencha as informações para cadastrar um novo veículo no sistema."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto w-full flex-1">
            <div className="flex flex-col gap-6">
              
              <div className="bg-[#f0f5ff] dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Informações Básicas</h3>
                  {!editingVehicle && (
                    <button type="button" onClick={clearDraft} className="text-xs text-blue-600 hover:underline"> Limpar Rascunho </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Placa <span className="text-red-500">*</span></label>
                    <input name="placa" required value={form.placa} onChange={handleInputChange} type="text" placeholder="ABC1234" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Tipo <span className="text-red-500">*</span></label>
                    <select name="tipo" required value={form.tipo} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white">
                      <option value="">Selecione</option>
                      <option value="COMBOIO">COMBOIO</option>
                      <option value="MUNCK">MUNCK</option>
                      <option value="MULTIFUNCIONAL">MULTIFUNCIONAL</option>
                      <option value="PIPA">PIPA</option>
                      <option value="ESCAVADEIRA">ESCAVADEIRA</option>
                      <option value="CARRETAGEM">CARRETAGEM</option>
                      <option value="OUTROS">OUTROS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Categoria <span className="text-red-500">*</span></label>
                    <select name="categoria" required value={form.categoria} onChange={handleInputChange} className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white">
                      <option value="">Selecione</option>
                      <option value="PESADA">PESADA</option>
                      <option value="LEVE">LEVE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Módulo <span className="text-red-500">*</span></label>
                    <input name="modulo" required value={form.modulo} onChange={handleInputChange} type="text" placeholder="BASE" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all dark:text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-[#ecfdf5] dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Horímetro / KM</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Valor Atual</label>
                    <input name="horimetro" value={form.horimetro} onChange={handleInputChange} type="text" placeholder="103276" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Data da Última Atualização</label>
                    <input name="ultimaAtualizacao" value={form.ultimaAtualizacao} onChange={handleInputChange} type="date" className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all dark:text-white" />
                  </div>
                </div>
              </div>

            </div>
          </div>
          
          <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-white dark:bg-slate-900 rounded-b-xl shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors shadow-sm">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50">
              {loading ? 'Salvando...' : (editingVehicle ? "Salvar Alterações" : "Cadastrar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
