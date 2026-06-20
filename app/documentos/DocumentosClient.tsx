"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Clipboard, ShieldCheck, Truck, Zap, Plus, AlertCircle, Edit2, Trash2, X, ChevronDown, Calendar as CalendarIcon, Search, Eye, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { 
  DocTacografo, DocCivCipp, DocLaudoEletromecanico, DocLaudoImplemento, DocCrlve,
  upsertTacografo, deleteTacografo,
  upsertCivCipp, deleteCivCipp,
  upsertLaudoEletro, deleteLaudoEletro,
  upsertLaudoImplemento, deleteLaudoImplemento,
  upsertCrlvePesados, deleteCrlvePesados,
  upsertCrlveLeve, deleteCrlveLeve
} from "./actions";
import { createClient } from "@/utils/supabase/client";

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
    return <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded font-bold text-[10px] shadow-sm">-</span>;
  }
  if (dias <= 0) {
    return <span className="px-2 py-0.5 bg-red-600 text-white rounded font-bold text-[10px] shadow-sm">{dias}</span>;
  } else if (dias <= 30) {
    return <span className="px-2 py-0.5 bg-yellow-400 text-black rounded font-bold text-[10px] shadow-sm">{dias}</span>;
  } else {
    return <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold text-[10px] shadow-sm">{dias}</span>;
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

type TabType = "tacografo" | "civ_cipp" | "laudo_eletromecanico" | "laudo_implemento" | "crlve_pesados" | "crlve_leve";

export default function DocumentosClient({
  isVisitante,
  initialTacografos,
  initialCivCipps,
  initialLaudosEletro,
  initialLaudosImplemento,
  initialCrlvePesados,
  initialCrlveLeves
}: {
  isVisitante: boolean;
  initialTacografos: DocTacografo[];
  initialCivCipps: DocCivCipp[];
  initialLaudosEletro: DocLaudoEletromecanico[];
  initialLaudosImplemento: DocLaudoImplemento[];
  initialCrlvePesados: DocCrlve[];
  initialCrlveLeves: DocCrlve[];
}) {
  const { isOnline } = useOffline();
  const [activeTab, setActiveTab] = useState<TabType>("tacografo");
  const [searchTerm, setSearchTerm] = useState("");

  // Filtros
  const [filterLocal, setFilterLocal] = useState("");
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterMes, setFilterMes] = useState("");
  const [filterAno, setFilterAno] = useState("");

  // Frota Base para Auto-preenchimento
  const [frotaEquipamentos, setFrotaEquipamentos] = useState<any[]>([]);

  // Refs para auto-preenchimento
  const localRef = useRef<HTMLInputElement>(null);
  const coRef = useRef<HTMLInputElement>(null);

  // Sync effect
  useEffect(() => {
    let active = true;
    const fetchFrota = async () => {
      try {
        const eq = await localDb.getAll("equipamentos");
        if (active) {
          setFrotaEquipamentos(eq);
        }
      } catch (e) {
        console.error("Erro ao carregar equipamentos:", e);
      }
    };
    fetchFrota();

    const handleSync = async () => {
        fetchFrota();
    };

    window.addEventListener("offline-db-updated-equipamentos", handleSync);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-equipamentos", handleSync);
    };
  }, []);

  const [filterStatus, setFilterStatus] = useState("todos"); // "todos", "vencidos", "proximos", "em_dias"
  const [showFilters, setShowFilters] = useState(false);

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
    if (activeTab === "crlve_pesados") { storeName = "docs_crlve_pesados"; entityName = "docs_crlve_pesados"; }
    if (activeTab === "crlve_leve") { storeName = "docs_crlve_leve"; entityName = "docs_crlve_leve"; }

    let anexo_url = editingData?.anexo_url || "";
    
    try {
      const file = formData.get('arquivo_anexo') as File;
      if (file && file.size > 0) {
        if (!isOnline) {
           alert("Não é possível anexar arquivos offline. Conecte-se à internet para fazer upload.");
           setLoading(false);
           return;
        }
        const supabase = createClient();
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documentos').upload(fileName, file);
        if (uploadError) {
          alert("Erro ao enviar anexo: " + uploadError.message);
          setLoading(false);
          return;
        }
        const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(fileName);
        anexo_url = publicUrl;
      }
      
      formValues.anexo_url = anexo_url;
      formData.set('anexo_url', anexo_url);
      if (isOnline) {
        let result: any;
        if (activeTab === "tacografo") result = await upsertTacografo(formData);
        if (activeTab === "civ_cipp") result = await upsertCivCipp(formData);
        if (activeTab === "laudo_eletromecanico") result = await upsertLaudoEletro(formData);
        if (activeTab === "laudo_implemento") result = await upsertLaudoImplemento(formData);
        if (activeTab === "crlve_pesados") result = await upsertCrlvePesados(formData);
        if (activeTab === "crlve_leve") result = await upsertCrlveLeve(formData);

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
    if (activeTab === "crlve_pesados") { storeName = "docs_crlve_pesados"; entityName = "docs_crlve_pesados"; }
    if (activeTab === "crlve_leve") { storeName = "docs_crlve_leve"; entityName = "docs_crlve_leve"; }
    
    try {
      if (isOnline) {
        let result: any;
        if (activeTab === "tacografo") result = await deleteTacografo(id);
        if (activeTab === "civ_cipp") result = await deleteCivCipp(id);
        if (activeTab === "laudo_eletromecanico") result = await deleteLaudoEletro(id);
        if (activeTab === "laudo_implemento") result = await deleteLaudoImplemento(id);
        if (activeTab === "crlve_pesados") result = await deleteCrlvePesados(id);
        if (activeTab === "crlve_leve") result = await deleteCrlveLeve(id);
        
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

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase().replace(/\s/g, '');
    if (val.length >= 3) {
      const eq = frotaEquipamentos.find(item => item.placa && item.placa.toUpperCase().replace(/\s/g, '') === val);
      if (eq) {
        if (localRef.current) localRef.current.value = eq.modulo || "";
        if (coRef.current) coRef.current.value = eq.categoria || "";
      }
    }
  };

  const renderFormContent = () => {
    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
    const isCrlve = activeTab === "crlve_pesados" || activeTab === "crlve_leve";
    const inputCls = "w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-blue-500 uppercase";

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs font-bold uppercase text-zinc-500">Placa</label>
            <input name="placa" onChange={handlePlacaChange} required defaultValue={editingData?.placa} className={inputCls} placeholder="Ex: ABC-1234" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs font-bold uppercase text-zinc-500">Local</label>
            <input ref={localRef} name="local" required defaultValue={editingData?.local} className={inputCls} placeholder="Ex: MÓDULO 07" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="text-xs font-bold uppercase text-zinc-500">C.O</label>
            <input ref={coRef} name="co" required defaultValue={editingData?.co} className={inputCls} placeholder="Ex: MUNCK" />
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
          {isCrlve && (
            <div>
              <label className="text-xs font-bold uppercase text-zinc-500">Ano</label>
              <input name="ano" required defaultValue={editingData?.ano} className={inputCls} placeholder="Ex: 2024" />
            </div>
          )}
        </div>

        {isLaudo && (
          <div>
            <label className="text-xs font-bold uppercase text-zinc-500">Observações</label>
            <input name="observacoes" defaultValue={editingData?.observacoes} className={inputCls} placeholder="Opcional" />
          </div>
        )}

        <div>
          <label className="text-xs font-bold uppercase text-zinc-500">Anexar Documento</label>
          <input type="file" name="arquivo_anexo" accept="image/*,application/pdf" className={inputCls} />
          {editingData?.anexo_url && (
            <p className="text-xs text-blue-600 mt-1">Anexo atual: <a href={editingData.anexo_url} target="_blank" rel="noreferrer" className="underline">Visualizar</a></p>
          )}
        </div>

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
    if (activeTab === "crlve_pesados") data = initialCrlvePesados;
    if (activeTab === "crlve_leve") data = initialCrlveLeves;

    const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
    const isCrlve = activeTab === "crlve_pesados" || activeTab === "crlve_leve";

    // Adiciona "dias" a todos os itens
    const dataWithDias = data.map((item: any) => {
      const isDateNull = !item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "";
      return {
        ...item,
        dias: isDateNull ? null : calcularDias(item.data_vencimento)
      };
    });

    // Ordenação do mais vencido (negativo) para o mais longo (positivo)
    dataWithDias.sort((a, b) => {
      if (a.dias === null && b.dias === null) return 0;
      if (a.dias === null) return 1;
      if (b.dias === null) return -1;
      return a.dias - b.dias;
    });

    const filteredData = dataWithDias.filter((item: any) => {
      // Search Box
      const term = searchTerm.toLowerCase().trim();
      if (term && !(
        item.local?.toLowerCase().includes(term) ||
        item.co?.toLowerCase().includes(term) ||
        item.placa?.toLowerCase().includes(term) ||
        (item.observacoes && item.observacoes.toLowerCase().includes(term))
      )) {
        return false;
      }

      // Dropdown Filters
      if (filterLocal && item.local !== filterLocal) return false;
      if (filterPlaca && item.placa !== filterPlaca) return false;
      
      if (filterAno || filterMes) {
        if (!item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "") return false;
        const [y, m] = item.data_vencimento.split("-");
        if (filterAno && y !== filterAno) return false;
        if (filterMes && m !== filterMes) return false;
      }

      // Status Filter
      if (filterStatus !== "todos") {
        if (item.dias === null) return false;
        if (filterStatus === "vencidos" && item.dias > 0) return false;
        if (filterStatus === "proximos" && (item.dias <= 0 || item.dias > 30)) return false;
        if (filterStatus === "em_dias" && item.dias <= 30) return false;
      }

      return true;
    });

    // Extract unique values for dropdowns
    const locaisUnicos = Array.from(new Set(data.map(d => d.local))).filter(Boolean).sort() as string[];
    const placasUnicas = Array.from(new Set(data.map(d => d.placa))).filter(Boolean).sort() as string[];
    const anosUnicos = Array.from(new Set(data.map(d => {
      if(!d.data_vencimento || d.data_vencimento === "-") return null;
      return d.data_vencimento.split("-")[0];
    }))).filter(Boolean).sort().reverse() as string[];

    return (
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        
        {/* Painel de Filtros */}
        {showFilters && (
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Local</label>
              <select value={filterLocal} onChange={e => setFilterLocal(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none">
                <option value="">Todos</option>
                {locaisUnicos.map(loc => <option key={loc} value={loc}>{loc}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Placa</label>
              <select value={filterPlaca} onChange={e => setFilterPlaca(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none">
                <option value="">Todas</option>
                {placasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none">
                <option value="todos">Todos</option>
                <option value="vencidos">Vencidos (≤ 0)</option>
                <option value="proximos">Próximos (1 a 30 d)</option>
                <option value="em_dias">Em Dias (&gt; 30 d)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Mês</label>
              <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none">
                <option value="">Todos</option>
                {Array.from({length: 12}, (_, i) => String(i+1).padStart(2, '0')).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-500 mb-1 block">Ano</label>
              <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className="w-full px-2 py-1.5 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none">
                <option value="">Todos</option>
                {anosUnicos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-semibold text-[10px] uppercase">
              <tr>
                <th className="px-2 py-1">Local</th>
                <th className="px-2 py-1">C.O</th>
                <th className="px-2 py-1">Placa</th>
                {isCrlve && <th className="px-2 py-1">Ano</th>}
                {isLaudo && <th className="px-2 py-1">Período</th>}
                {isLaudo && <th className="px-2 py-1">Data Expedição</th>}
                <th className="px-2 py-1">
                  {activeTab === 'tacografo' ? 'Tacógrafo (Venc)' : 
                   activeTab === 'civ_cipp' ? 'CIV e CIPP (Venc)' : 'Data Vencimento'}
                </th>
                <th className="px-2 py-1 text-center">Status</th>
                {isLaudo && <th className="px-2 py-1">Observações</th>}
                <th className="px-2 py-1">Anexo</th>
                {!isVisitante && <th className="px-2 py-1 text-right">Ações</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300 text-[11px]">
              {filteredData.map((item: any) => {
                const isDateNull = !item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "";
                const dias = isDateNull ? null : calcularDias(item.data_vencimento);

                return (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                    <td className="px-2 py-0.5 font-medium uppercase">{item.local}</td>
                    <td className="px-2 py-0.5 uppercase">{item.co}</td>
                    <td className="px-2 py-0.5 font-mono font-bold">{item.placa}</td>
                    {isCrlve && <td className="px-2 py-0.5">{item.ano}</td>}
                    {isLaudo && <td className="px-2 py-0.5">{item.periodo}</td>}
                    {isLaudo && <td className="px-2 py-0.5">{formatarData(item.data_expedicao)}</td>}
                    <td className="px-2 py-0.5">{formatarData(item.data_vencimento)}</td>
                    <td className="px-2 py-0.5 text-center">{getStatusBadge(dias)}</td>
                    {isLaudo && <td className="px-2 py-0.5 text-red-600 dark:text-red-400 font-medium uppercase text-[10px]">{item.observacoes}</td>}
                    <td className="px-2 py-0.5">
                      {item.anexo_url ? (
                        <div className="flex gap-2 items-center">
                          <a href={item.anexo_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[10px] font-bold flex items-center gap-1"><Eye size={12}/> Ver</a>
                          <a href={item.anexo_url} download target="_blank" rel="noreferrer" className="text-zinc-600 hover:text-blue-600 text-[10px] font-bold flex items-center gap-1"><Download size={12}/> Baixar</a>
                        </div>
                      ) : (
                        <span className="text-zinc-400 text-[10px]">Sem anexo</span>
                      )}
                    </td>
                    {!isVisitante && (
                      <td className="px-2 py-0.5 text-right whitespace-nowrap">
                        <button onClick={() => openModal(item)} className="p-1 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 mx-0.5"><Edit2 size={13} /></button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 mx-0.5"><Trash2 size={13} /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-zinc-500 dark:text-zinc-400">
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
    <div className="p-3 md:p-6 flex flex-col gap-4 max-w-7xl mx-auto w-full">
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
          <button
            onClick={() => setActiveTab("crlve_pesados")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "crlve_pesados" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <FileText size={16} /> CRLVE Pesados
          </button>
          <button
            onClick={() => setActiveTab("crlve_leve")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              activeTab === "crlve_leve" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <FileText size={16} /> CRLVE Leve
          </button>
        </div>

        {/* Search & Filters Toggle */}
        <div className="flex items-center gap-2 w-full md:w-auto mb-2 md:mb-0">
          <div className="relative flex-1 md:w-80">
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border rounded-lg transition-colors flex items-center gap-2",
              showFilters 
                ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400" 
                : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            )}
          >
            Filtros
            <ChevronDown size={14} className={cn("transition-transform", showFilters && "rotate-180")} />
          </button>
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
            activeTab === 'crlve_pesados' ? 'CRLVE Pesados' :
            activeTab === 'crlve_leve' ? 'CRLVE Leve' :
            'Laudo Implemento'
          }`
        }
      >
        {renderFormContent()}
      </ModalBase>
    </div>
  );
}
