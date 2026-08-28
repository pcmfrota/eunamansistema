"use client";

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { 
  Download,
  Upload,
  Plus, 
  Trash2,
  Database,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import {
  buscarConfiguracoes,
  salvarConfiguracao,
  excluirConfiguracao,
  excluirVariasConfiguracoes,
  importarConfiguracoes,
  ConfigCategory
} from './actions';

type TabType = 'motivos' | 'sistemas' | 'sub-sistemas';

interface StoreData {
  motivos: { id: string, value: string }[];
  sistemas: { id: string, value: string }[];
  'sub-sistemas': { id: string, value: string }[];
}

function groupConfigs(configs: any[]): StoreData {
  const grouped: StoreData = { motivos: [], sistemas: [], 'sub-sistemas': [] };
  configs.forEach((c: any) => {
    const cat = c.category as TabType;
    if (grouped[cat]) {
      grouped[cat].push({ id: c.id, value: c.value });
    }
  });
  return grouped;
}

export default function BaseDadosPage() {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const isVisitante = profile?.role === "visitante";

  const [activeTab, setActiveTab] = useState<TabType>('motivos');
  const [data, setData] = useState<StoreData>({ motivos: [], sistemas: [], 'sub-sistemas': [] });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carrega local (offline-first) e, se online, atualiza em segundo plano
  const loadData = async () => {
    try {
      const local = await localDb.getAll('aux_config');
      setData(groupConfigs(local));
    } catch (err) {
      console.error("Erro ao carregar aux_config local:", err);
    }
    setLoading(false);

    if (isOnline) {
      try {
        const { syncTables } = await import("@/lib/offline-sync");
        await syncTables(["aux_config"]);
        const configs = await buscarConfiguracoes();
        setData(groupConfigs(configs));
      } catch (err) {
        console.error("Erro ao sincronizar aux_config:", err);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [isOnline]);

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedItems([]); 
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(data[activeTab].map(i => i.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id: string) => {
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter(i => i !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const handleDeleteItem = async (id: string, name: string) => {
    if (!confirm(`Excluir permanentemente o item "${name}"?`)) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }

    const res = await excluirConfiguracao(id);
    if ('error' in res) {
      alert("Erro ao excluir: " + res.error);
    } else {
      setSelectedItems(selectedItems.filter(i => i !== id));
      loadData();
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Deseja excluir permanentemente os ${selectedItems.length} itens selecionados?`)) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }

    const res = await excluirVariasConfiguracoes(selectedItems);
    if ('error' in res) {
      alert("Erro ao excluir itens: " + res.error);
    } else {
      setSelectedItems([]);
      loadData();
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemText.trim().toUpperCase();
    if (!text) return;
    
    if (data[activeTab].some(i => i.value === text)) {
      alert("Este item já existe na lista.");
      return;
    }
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }

    setAdding(true);
    const res = await salvarConfiguracao(activeTab, text);
    if ('error' in res) {
      alert("Erro ao adicionar: " + res.error);
    } else {
      setNewItemText("");
      loadData();
    }
    setAdding(false);
  };

  const exportToJSON = () => {
    // Export raw values only for compatibility with old imports
    const exportData = {
      motivos: data.motivos.map(i => i.value),
      sistemas: data.sistemas.map(i => i.value),
      subSistemas: data['sub-sistemas'].map(i => i.value)
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "base_dados.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isOnline) {
      alert("Esta ação exige conexão com a internet. Tente novamente ao reconectar.");
      return;
    }

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("Aguardando carregamento da biblioteca...");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: 'array' });
        
        const toImport: { category: string, value: string }[] = [];

        workbook.SheetNames.forEach((sheetName: string) => {
          let cat = sheetName.toLowerCase().replace(' ', '-').replace('subSistemas', 'sub-sistemas') as ConfigCategory;
          if (!['motivos', 'sistemas', 'sub-sistemas'].includes(cat)) {
              if (sheetName.toLowerCase().includes('motivo')) cat = 'motivos';
              if (sheetName.toLowerCase().includes('sistema')) cat = 'sistemas';
              if (sheetName.toLowerCase().includes('sub')) cat = 'sub-sistemas';
          }

          if (['motivos', 'sistemas', 'sub-sistemas'].includes(cat)) {
            const worksheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            
            rows.forEach((row, idx) => {
              if (idx > 0 && row[0]) { // Pular cabeçalho
                toImport.push({ category: cat, value: String(row[0]) });
              }
            });
          }
        });
        
        if (toImport.length > 0) {
          const res = await importarConfiguracoes(toImport);
          if ('error' in res) alert("Erro ao importar: " + res.error);
          else {
            const count = ('count' in res && typeof res.count === 'number') ? res.count : 0;
            alert(`${count} itens importados com sucesso!`);
            loadData();
          }
        } else {
           alert("Nenhum item válido encontrado no Excel. Use abas com nomes 'Motivos', 'Sistemas' ou 'Sub-Sistemas'.");
        }
      } catch (err) {
        alert("Erro ao processar arquivo: " + err);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <Database className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1e293b] dark:text-zinc-100">Base de Dados</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              Gerenciar tabelas auxiliares sincronizadas no banco
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          {!isVisitante ? (
            <>
              <input 
                type="file" 
                accept=".xlsx, .xls, .csv" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                className="hidden" 
              />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm">
                <Upload size={16} /> Importar Excel
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/10 text-amber-600 dark:text-amber-400 rounded-lg text-sm border border-amber-200 dark:border-amber-900/30 shadow-sm font-semibold">
              <ShieldAlert size={16} />
              <span>Somente Leitura</span>
            </div>
          )}
          <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm">
            <Download size={16} /> Exportar JSON
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl flex items-center mb-2 shadow-sm border border-slate-200 dark:border-slate-700/50">
        {(['motivos', 'sistemas', 'sub-sistemas'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab)}
            className={cn(
              "flex-1 py-2.5 px-4 text-sm font-semibold rounded-lg transition-all",
              activeTab === tab 
                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {tab === 'motivos' ? 'Motivos' : tab === 'sistemas' ? 'Sistemas' : 'Sub-Sistemas'}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1 relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        )}

        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
             <h2 className="text-lg font-bold text-slate-800 dark:text-white">
               {activeTab === 'motivos' ? 'Motivos de Manutenção' : activeTab === 'sistemas' ? 'Sistemas' : 'Sub-Sistemas'}
             </h2>
             
             {selectedItems.length > 0 && !isVisitante && (
               <button onClick={handleBatchDelete} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20 rounded-lg transition-colors">
                 <Trash2 size={14} /> Excluir Selecionados ({selectedItems.length})
               </button>
             )}
          </div>

          {!isVisitante && (
            <form onSubmit={handleAddItem} className="flex flex-col sm:flex-row gap-3 mb-8">
              <input 
                type="text" 
                value={newItemText}
                disabled={adding}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder={`Novo ${activeTab === 'motivos' ? 'motivo' : activeTab === 'sistemas' ? 'sistema' : 'sub-sistema'}...`}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3.5"
              />
              <button 
                type="submit" 
                disabled={adding || !newItemText}
                className="flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                {adding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Adicionar
              </button>
            </form>
          )}

          <div className="flex flex-col">
             <div className="flex items-center gap-4 py-3 px-2 border-b-2 border-slate-100 dark:border-slate-800/80 mb-2">
               <div className="flex items-center justify-center p-1 w-8">
                  <input 
                    type="checkbox" 
                    checked={data[activeTab].length > 0 && selectedItems.length === data[activeTab].length}
                    onChange={handleSelectAll}
                    id="selectAll"
                    className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                  />
               </div>
               <label htmlFor="selectAll" className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 flex-1 cursor-pointer">
                  NOME / DESCRIÇÃO NO BANCO
               </label>
               {!isVisitante && <span className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 w-12 text-center">AÇÕES</span>}
             </div>

             <div className="flex flex-col gap-1">
               {data[activeTab].map((item) => (
                 <div key={item.id} className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <div className="flex items-center justify-center p-1 w-8">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item.id)}
                        onChange={() => handleSelectItem(item.id)}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                      />
                    </div>
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-100 flex-1 uppercase tracking-tight">{item.value}</span>
                    {!isVisitante && (
                      <div className="w-12 flex justify-center">
                        <button 
                          onClick={() => handleDeleteItem(item.id, item.value)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Excluir permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                 </div>
               ))}
             </div>

             {!loading && data[activeTab].length === 0 && (
               <div className="py-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                 <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                 <p className="text-sm font-semibold">Nenhum item cadastrado no banco.</p>
                 <p className="text-xs mt-1">Utilize o campo acima para adicionar novos registros.</p>
               </div>
             )}
          </div>
        </div>
      </div>

      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
    </div>
  );
}
