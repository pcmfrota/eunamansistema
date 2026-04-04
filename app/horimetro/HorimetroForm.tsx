'use client';

import { useState } from "react";
import { Plus } from "lucide-react";
import { registrarHorimetro } from "./actions";

export default function HorimetroForm({ equipamentos }: { equipamentos: any[] }) {
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMensagem(null);
    
    const formData = new FormData(e.currentTarget);
    const result = await registrarHorimetro(formData);
    
    if ('error' in result) {
      setMensagem({ tipo: 'erro', texto: result.error });
    } else {
      setMensagem({ tipo: 'sucesso', texto: 'Apontamento registrado com sucesso!' });
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm h-fit">
      <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Novo Apontamento</h2>
      </div>
      
      <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
        
        {mensagem && (
          <div className={`p-3 rounded-lg text-sm font-medium ${mensagem.tipo === 'erro' ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:border-red-900/' : 'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-900'}`}>
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="equipamento_id" className="text-sm font-medium">Equipamento <span className="text-red-500">*</span></label>
            <select 
              id="equipamento_id" 
              name="equipamento_id"
              required
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione...</option>
              {equipamentos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.placa} - {eq.modelo}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="data" className="text-sm font-medium">Data Referência <span className="text-red-500">*</span></label>
            <input 
              type="date" 
              id="data" 
              name="data"
              required
              defaultValue={new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="horimetro_inicial" className="text-sm font-medium">Horímetro Inicial <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              id="horimetro_inicial" 
              name="horimetro_inicial"
              required
              step="0.1"
              min="0"
              placeholder="Ex: 1540.5"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="horimetro_final" className="text-sm font-medium">Horímetro Final <span className="text-red-500">*</span></label>
            <input 
              type="number" 
              id="horimetro_final" 
              name="horimetro_final"
              required
              step="0.1"
              min="0"
              placeholder="Ex: 1548.5"
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="observacoes" className="text-sm font-medium">Observações</label>
          <textarea 
            id="observacoes"
            name="observacoes" 
            rows={3}
            placeholder="Opcional. Registre qualquer anomalia notada durante a operação."
            className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y"
          />
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              <Plus size={18} />
              {loading ? 'Registrando...' : 'Registrar Apontamento'}
            </button>
        </div>
      </form>
    </div>
  )
}
