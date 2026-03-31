'use client';

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { registrarInspecaoPneu } from "./actions";

export default function NovaInspecaoPneu({ equipamentos }: { equipamentos: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMensagem(null);
    
    const formData = new FormData(e.currentTarget);
    const result = await registrarInspecaoPneu(formData);
    
    if (result.error) {
      setMensagem({ tipo: 'erro', texto: result.error });
    } else if (result.success) {
      setMensagem({ tipo: 'sucesso', texto: 'Inspeção registrada!' });
      (e.target as HTMLFormElement).reset();
      setTimeout(() => { setIsOpen(false); setMensagem(null); }, 2000);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
      >
        <Plus size={16} /> Nova Inspeção
      </button>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full shadow-md animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Registrar Nova Inspeção Diária</h2>
        <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mensagem && (
          <div className={`p-3 rounded-lg text-sm font-medium ${mensagem.tipo === 'erro' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'}`}>
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Equipamento</label>
            <select name="equipamento_id" required className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="">Selecione...</option>
              {equipamentos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.placa}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Eixo / Posição</label>
            <select name="eixo" required className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="Dianteiro Esquerdo">Dianteiro Esquerdo</option>
              <option value="Dianteiro Direito">Dianteiro Direito</option>
              <option value="Traseiro Esq. Externo">Traseiro Esq. Externo</option>
              <option value="Traseiro Esq. Interno">Traseiro Esq. Interno</option>
              <option value="Traseiro Dir. Externo">Traseiro Dir. Externo</option>
              <option value="Traseiro Dir. Interno">Traseiro Dir. Interno</option>
              <option value="Estepe">Estepe</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Sulco Remanescente (mm)</label>
            <input name="sulco_mm" type="number" step="0.1" min="0" required placeholder="Ex: 12.5" className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        <div className="flex justify-end mt-2">
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Salvando...' : 'Salvar Inspeção'}
          </button>
        </div>
      </form>
    </div>
  );
}
