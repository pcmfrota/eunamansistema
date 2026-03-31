'use client';

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { criarPreventiva } from "./actions";

// Tipagem da máquina para garantir que o VS Code entenda
type Equipamento = {
  id: string;
  placa: string;
  tipo?: string;
  modulo?: string;
  categoria?: string;
  ultimoHist?: number;
};

export default function NovaPreventivaModal({ equipamentos }: { equipamentos: Equipamento[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estado para autocompletar e preencher a tela quando digita/seleciona a Placa
  const [selectedEq, setSelectedEq] = useState<Equipamento | null>(null);

  const handleSelectEquipamento = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    const eq = equipamentos.find(eq => eq.id === id);
    setSelectedEq(eq || null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const result = await criarPreventiva(formData);
    
    if (result.error) {
      alert("Erro: " + result.error);
    } else if (result.success) {
      (e.target as HTMLFormElement).reset();
      setIsOpen(false);
      setSelectedEq(null);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Plus size={16} /> Nova Preventiva
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-xl shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Nova Preventiva</h2>
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Autocomplete de Placa */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Placa</label>
            <select name="equipamento_id" required onChange={handleSelectEquipamento} className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Selecione a placa do veículo...</option>
              {equipamentos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.placa} - {eq.tipo || eq.categoria || 'Sem categoria'}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Tipo</label>
              <input name="tipo" type="text" 
                defaultValue={selectedEq?.tipo || ""}
                placeholder="EX: MULTIFUNCIONAL" 
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Módulo</label>
              <input name="modulo" type="text"
                defaultValue={selectedEq?.modulo || ""} 
                placeholder="EX: CARREGAMENTO" 
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Último Horímetro (h)</label>
              <input name="ultimo_horimetro" type="number" step="0.1" required 
                defaultValue={selectedEq?.ultimoHist || ""}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Horímetro Atual (h)</label>
              <input name="horimetro_atual" type="number" step="0.1" required 
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Intervalo (h)</label>
            <input name="intervalo_horas" type="number" step="0.1" defaultValue={500} required 
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Data da Atualização</label>
            <input name="data_atualizacao" type="date" required 
              defaultValue={new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none" 
            />
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" onClick={() => setIsOpen(false)} className="px-5 py-2.5 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
              {loading ? 'Criando...' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
