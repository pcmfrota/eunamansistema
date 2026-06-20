"use client";

import { useState } from "react";
import { Clipboard, ShieldCheck, Truck, Zap, Plus, AlertCircle, Edit2, Trash2, X, ChevronDown, Calendar as CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";
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

function formatarData(dataStr: string | null | undefined) {
  if (!dataStr) return "-";
  if (dataStr.includes("-")) {
    return dataStr.split('-').reverse().join('/');
  }
  return dataStr;
}

function getStatusBadge(dias: number | null) {
  if (dias === null) {
    return <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded-md font-bold text-xs shadow-sm">-</span>;
  }
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
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
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
  const { isOnline } = useOffline();
  const [activeTab, setActiveTab] = useState<TabType>("tacografo");
  const [searchTerm, setSearchTerm] = useState("");

  // Estados dos modais
  const [modalOpen, setModalOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

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

    // Capture standard form fields for local state update
    const formValues: any = {
      local: formData.get('local') as string,
      co: formData.get('co') as string,
      placa: formData.get('placa') as string,
    };
    
    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
    if (isLaudo) {
      formValues.periodo = formData.get('periodo') as string;
      formValues.data_expedicao = formData.get('data_expedicao') as string;
      formValues.observacoes = formData.get('observacoes') as string;
    }
    
    // date
    const rawDate = formData.get('data_vencimento') as string | null;
    formValues.data_vencimento = rawDate && rawDate.trim() !== "" ? rawDate : null;

    // determine entity name in IndexedDB
    let storeName = "";
    let entityName: any = "";
    if (activeTab === "tacografo") { storeName = "docs_tacografo"; entityName = "docs_tacografo"; }
    if (activeTab === "civ_cipp") { storeName = "docs_civ_cipp"; entityName = "docs_civ_cipp"; }
    if (activeTab === "laudo_eletromecanico") { storeName = "docs_laudo_eletromecanico"; entityName = "docs_laudo_eletromecanico"; }
    if (activeTab === "laudo_implemento") { storeName = "docs_laudo_implemento"; entityName = "docs_laudo_implemento"; }

    try {
      if (isOnline) {
        let result: any;
        if (activeTab === "tacografo") result = await upsertTacografo(formData);
        if (activeTab === "civ_cipp") result = await upsertCivCipp(formData);
        if (activeTab === "laudo_eletromecanico") result = await upsertLaudoEletro(formData);
        if (activeTab === "laudo_implemento") result = await upsertLaudoImplemento(formData);

        if (result && result.error) {
          throw new Error(result.error);
        }

        // Save to local cache
        const savedItem = {
          id: editingData?.id || `doc_${Date.now()}`,
          ...formValues,
          filial_id: editingData?.filial_id || "MATRIZ",
        };
        await localDb.put(storeName, savedItem);
      } else {
        // Offline Flow
        const serialized = serializeFormData(formData);
        if (editingData?.id) {
          const updated = {
            ...editingData,
            ...formValues,
            _isPendingSync: true
          };
          await localDb.put(storeName, updated);
          await localDb.addToQueue(entityName, "update", { id: editingData.id, ...serialized });
        } else {
          const tempId = `temp_doc_${Date.now()}`;
          const newDoc = {
            id: tempId,
            ...formValues,
            filial_id: "MATRIZ",
            _isPendingSync: true
          };
          await localDb.put(storeName, newDoc);
          await localDb.addToQueue(entityName, "create", serialized);
        }
        
        alert("✅ Registro salvo localmente! Sincronizará automaticamente quando restabelecer conexão.");
      }
      
      // Dispatch update event to force re-fetch in Page component
      window.dispatchEvent(new CustomEvent(`offline-db-updated-${storeName}`));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      setModalOpen(false);
      setEditingData(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isVisitante) return;
    if (!confirm("Tem certeza que deseja excluir este registro?")) return;

    let storeName = "";
    let entityName: any = "";
    if (activeTab === "tacografo") { storeName = "docs_tacografo"; entityName = "docs_tacografo"; }
    if (activeTab === "civ_cipp") { storeName = "docs_civ_cipp"; entityName = "docs_civ_cipp"; }
    if (activeTab === "laudo_eletromecanico") { storeName = "docs_laudo_eletromecanico"; entityName = "docs_laudo_eletromecanico"; }
    if (activeTab === "laudo_implemento") { storeName = "docs_laudo_implemento"; entityName = "docs_laudo_implemento"; }
    
    try {
      if (isOnline) {
        let result: any;
        if (activeTab === "tacografo") result = await deleteTacografo(id);
        if (activeTab === "civ_cipp") result = await deleteCivCipp(id);
        if (activeTab === "laudo_eletromecanico") result = await deleteLaudoEletro(id);
        if (activeTab === "laudo_implemento") result = await deleteLaudoImplemento(id);
        
        if (result && result.error) {
          throw new Error(result.error);
        }
      } else {
        await localDb.addToQueue(entityName, "delete", { id });
      }

      await localDb.delete(storeName, id);

      window.dispatchEvent(new CustomEvent(`offline-db-updated-${storeName}`));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      console.error(err);
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  };

  const renderFormContent = () => {
    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
    const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-955 dark:text-zinc-50 outline-none focus:border-blue-500";

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
            <input 
              type="date" 
              name="data_vencimento" 
              required={activeTab !== "civ_cipp"} 
              defaultValue={editingData?.data_vencimento || ""} 
              className={inputCls} 
            />
          </div>
        </div>

        {isLaudo && (
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Observações</label>
            <input name="observacoes" defaultValue={editingData?.observacoes} className={inputCls} placeholder="Opcional" />
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3">
          <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-zinc-600 border dark:border-zinc-800 rounded-lg">Cancelar</button>
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

    const filteredData = data.filter((item: any) => {
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        item.local?.toLowerCase().includes(term) ||
        item.co?.toLowerCase().includes(term) ||
        item.placa?.toLowerCase().includes(term) ||
        (item.observacoes && item.observacoes.toLowerCase().includes(term))
      );
    });

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
              {filteredData.map((item) => {
                const isDateNull = !item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "";
                const dias = isDateNull ? null : calcularDias(item.data_vencimento);

                return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-4 py-3 font-medium uppercase">{item.local}</td>
                    <td className="px-4 py-3 uppercase">{item.co}</td>
                    <td className="px-4 py-3 font-mono font-bold">{item.placa}</td>
                    {isLaudo && <td className="px-4 py-3">{item.periodo}</td>}
                    {isLaudo && <td className="px-4 py-3">{formatarData(item.data_expedicao)}</td>}
                    <td className="px-4 py-3">{formatarData(item.data_vencimento)}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(dias)}</td>
                    {isLaudo && <td className="px-4 py-3 text-red-600 dark:text-red-400 font-medium uppercase text-xs">{item.observacoes}</td>}
                    {!isVisitante && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openModal(item)} className="p-1 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 mx-1"><Edit2 size={16} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 mx-1"><Trash2 size={16} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
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

      {/* Control Area: Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-px">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab("tacografo")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "tacografo" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <CalendarIcon size={16} /> Tacógrafo
          </button>
          <button
            onClick={() => setActiveTab("civ_cipp")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "civ_cipp" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <ShieldCheck size={16} /> CIV/CIPP
          </button>
          <button
            onClick={() => setActiveTab("laudo_eletromecanico")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "laudo_eletromecanico" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <Zap size={16} /> Laudo Eletromecânico
          </button>
          <button
            onClick={() => setActiveTab("laudo_implemento")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "laudo_implemento" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <Truck size={16} /> Laudo Implemento
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80 mb-2 md:mb-0">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="w-4 h-4 text-zinc-400" />
          </span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar local, C.O, placa..."
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-zinc-900 dark:text-zinc-100"
          />
        </div>
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
