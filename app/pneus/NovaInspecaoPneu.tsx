'use client';

import { useState } from "react";
import { Plus, X, RotateCcw } from "lucide-react";
import { registrarInspecaoPneu } from "./actions";
import { useFormDraft } from '@/hooks/use-form-draft'

interface InspecaoPneuFormValues {
  equipamento_id: string;
  eixo: string;
  sulco_mm: string;
}

export default function NovaInspecaoPneu({ equipamentos }: { equipamentos: any[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro', texto: string } | null>(null);

  const initialValues: InspecaoPneuFormValues = {
    equipamento_id: "",
    eixo: "Dianteiro Esquerdo",
    sulco_mm: "",
  };

  const { form, setForm, handleInputChange, clearDraft, hasContent: hasDraft } = useFormDraft<InspecaoPneuFormValues>('pneus', initialValues);

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
      clearDraft();
      setTimeout(() => { setIsOpen(false); setMensagem(null); }, 2000);
    }
    setLoading(false);
  };

  if (!isOpen) {
    return (
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> Nova Inspeção
        </button>
        {hasDraft && (
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" title="Rascunho pendente" />
        )}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full shadow-md animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Registrar Nova Inspeção Diária</h2>
          {hasDraft && (
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 uppercase tracking-wider">
              Rascunho
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasDraft && (
            <button 
              type="button" 
              onClick={clearDraft}
              title="Limpar Rascunho"
              className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>
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
            <select 
              name="equipamento_id" 
              required 
              value={form.equipamento_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">Selecione...</option>
              {equipamentos.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.placa}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Eixo / Posição</label>
            <select 
              name="eixo" 
              required 
              value={form.eixo}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
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
            <input 
              name="sulco_mm" 
              type="number" 
              step="0.1" 
              min="0" 
              required 
              value={form.sulco_mm}
              onChange={handleInputChange}
              placeholder="Ex: 12.5" 
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
            />
          </div>
        </div>

        <div className="flex justify-end mt-2 gap-3">
          <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? 'Salvando...' : 'Salvar Inspeção'}
          </button>
        </div>
      </form>
    </div>
  );
}
