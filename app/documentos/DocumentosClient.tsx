"use client";

import { useState } from "react";
import { Clipboard, ShieldCheck, Truck, Zap, Plus, AlertCircle, Edit2, Trash2, X, ChevronDown, Calendar as CalendarIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  DocTacografo, DocCivCipp, DocLaudoEletromecanico, DocLaudoImplemento,
  upsertTacografo, deleteTacografo,
  upsertCivCipp, deleteCivCipp,
  upsertLaudoEletro, deleteLaudoEletro,
  upsertLaudoImplemento, deleteLaudoImplemento
} from "./actions";

// --- Utilitários ---

function calcularDias(vencimentoStr: string) {
  const venc = new Date(vencimentoStr + 'T00:00:00');
  const hoje = new Date();
  hoje.setHours(0,0,0,0);
  const diffTime = venc.getTime() - hoje.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getStatusBadge(dias: number) {
  if (dias < 0) {
    return <span className="px-3 py-1 bg-red-600 text-white rounded-md font-bold text-sm shadow-sm">{dias}</span>;
  } else if (dias <= 30) {
    return <span className="px-3 py-1 bg-yellow-400 text-black rounded-md font-bold text-sm shadow-sm">{dias}</span>;
  } else {
    return <span className="px-3 py-1 bg-blue-600 text-white rounded-md font-bold text-sm shadow-sm">{dias}</span>;
  }
}

// --- Componentes Reutilizáveis ---

const ModalBase = ({ isOpen, title, onClose, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 transition-colors">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// --- Tipos de Abas ---

type TabType = "tacografo" | "civ_cipp" | "laudo_eletromecanico" | "laudo_implemento";

export default function DocumentosClient({
  isVisitante,
  initialTacografos,
  initialCivCipps,
  initialLaudosEletro,
  initialLaudosImplemento
}: {
  isVisitante: boolean;
  initialTacografos: DocTacografo[];
  initialCivCipps: DocCivCipp[];
  initialLaudosEletro: DocLaudoEletromecanico[];
  initialLaudosImplemento: DocLaudoImplemento[];
}) {
  const [activeTab, setActiveTab] = useState<TabType>("tacografo");

  // Estados dos modais
  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Estados locais para atualização otimista (opcional, ou podemos confiar no revalidatePath)
  // Por simplicidade com revalidatePath, usaremos os dados iniciais passados por props. 
  // No Next.js App Router, as server actions dão revalidatePath e a página é atualizada automaticamente.

  const openModal = (data: any = null) => {
    setEditingData(data);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    if (editingData) {
      formData.append('id', editingData.id);
    }

    try {
      if (activeTab === "tacografo") await upsertTacografo(formData);
      if (activeTab === "civ_cipp") await upsertCivCipp(formData);
      if (activeTab === "laudo_eletromecanico") await upsertLaudoEletro(formData);
      if (activeTab === "laudo_implemento") await upsertLaudoImplemento(formData);
      
      setModalOpen(false);
      setEditingData(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;
    
    try {
      if (activeTab === "tacografo") await deleteTacografo(id);
      if (activeTab === "civ_cipp") await deleteCivCipp(id);
      if (activeTab === "laudo_eletromecanico") await deleteLaudoEletro(id);
      if (activeTab === "laudo_implemento") await deleteLaudoImplemento(id);
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir.");
    }
  };

  const renderFormContent = () => {
    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
    const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 outline-none focus:border-blue-500";

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Local</label>
            <input name="local" required defaultValue={editingData?.local} className={inputCls} placeholder="Ex: MÓDULO 07" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">C.O</label>
            <input name="co" required defaultValue={editingData?.co} className={inputCls} placeholder="Ex: MUNCK" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Placa</label>
            <input name="placa" required defaultValue={editingData?.placa} className={inputCls} placeholder="Ex: ABC-1234" />
          </div>
          
          {isLaudo && (
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Período</label>
              <select name="periodo" required defaultValue={editingData?.periodo || "6 MESES"} className={inputCls}>
                <option value="3 MESES">3 MESES</option>
                <option value="6 MESES">6 MESES</option>
                <option value="1 ANO">1 ANO</option>
              </select>
            </div>
          )}
          
          {isLaudo && (
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Data de Expedição</label>
              <input type="date" name="data_expedicao" required defaultValue={editingData?.data_expedicao} className={inputCls} />
            </div>
          )}

          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Data de Vencimento</label>
            <input type="date" name="data_vencimento" required defaultValue={editingData?.data_vencimento} className={inputCls} />
          </div>
        </div>

        {isLaudo && (
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Observações</label>
            <input name="observacoes" defaultValue={editingData?.observacoes} className={inputCls} placeholder="Opcional" />
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-zinc-600 border rounded-lg">Cancelar</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    );
  };

  const renderTable = () => {
    let data: any[] = [];
    if (activeTab === "tacografo") data = initialTacografos;
    if (activeTab === "civ_cipp") data = initialCivCipps;
    if (activeTab === "laudo_eletromecanico") data = initialLaudosEletro;
    if (activeTab === "laudo_implemento") data = initialLaudosImplemento;

    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";

    return (
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-green-700 text-white font-bold text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">C.O</th>
                <th className="px-4 py-3">Placa</th>
                {isLaudo && <th className="px-4 py-3">Período</th>}
                {isLaudo && <th className="px-4 py-3">Data Expedição</th>}
                <th className="px-4 py-3">
                  {activeTab === 'tacografo' ? 'Tacógrafo (Venc)' : 
                   activeTab === 'civ_cipp' ? 'CIV e CIPP (Venc)' : 'Data Vencimento'}
                </th>
                <th className="px-4 py-3 text-center">Status</th>
                {isLaudo && <th className="px-4 py-3">Observações</th>}
                {!isVisitante && <th className="px-4 py-3 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
              {data.map((item, idx) => {
                const dias = calcularDias(item.data_vencimento);
                return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-medium uppercase">{item.local}</td>
                    <td className="px-4 py-3 uppercase">{item.co}</td>
                    <td className="px-4 py-3 font-mono font-bold">{item.placa}</td>
                    {isLaudo && <td className="px-4 py-3">{item.periodo}</td>}
                    {isLaudo && <td className="px-4 py-3">{item.data_expedicao?.split('-').reverse().join('/')}</td>}
                    <td className="px-4 py-3">{item.data_vencimento.split('-').reverse().join('/')}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(dias)}</td>
                    {isLaudo && <td className="px-4 py-3 text-red-600 font-medium uppercase text-xs">{item.observacoes}</td>}
                    {!isVisitante && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openModal(item)} className="p-1 text-zinc-400 hover:text-blue-500 mx-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-500 mx-1"><Trash2 size={16} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {data.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-500">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Clipboard className="text-blue-600" /> Documentos da Frota
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Gestão de CIV/CIPP, Tacógrafo e Laudos</p>
        </div>
        
        {!isVisitante && (
          <button
            onClick={() => openModal(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm active:scale-95"
          >
            <Plus size={18} /> Novo Registro
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
        <button
          onClick={() => setActiveTab("tacografo")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
            activeTab === "tacografo" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          )}
        >
          <CalendarIcon size={16} /> Tacógrafo
        </button>
        <button
          onClick={() => setActiveTab("civ_cipp")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
            activeTab === "civ_cipp" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          )}
        >
          <ShieldCheck size={16} /> CIV/CIPP
        </button>
        <button
          onClick={() => setActiveTab("laudo_eletromecanico")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
            activeTab === "laudo_eletromecanico" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          )}
        >
          <Zap size={16} /> Laudo Eletromecânico
        </button>
        <button
          onClick={() => setActiveTab("laudo_implemento")}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
            activeTab === "laudo_implemento" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 hover:border-zinc-300"
          )}
        >
          <Truck size={16} /> Laudo Implemento
        </button>
      </div>

      {/* Tabela Ativa */}
      {renderTable()}

      {/* Modal CRUD */}
      <ModalBase 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title={
          editingData ? `Editar Registro` : 
          `Novo Registro: ${
            activeTab === 'tacografo' ? 'Tacógrafo' :
            activeTab === 'civ_cipp' ? 'CIV/CIPP' :
            activeTab === 'laudo_eletromecanico' ? 'Laudo Eletromecânico' :
            'Laudo Implemento'
          }`
        }
      >
        {renderFormContent()}
      </ModalBase>
    </div>
  );
}
