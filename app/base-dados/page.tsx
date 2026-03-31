"use client";

import React, { useState, useEffect, useRef } from 'react';
import Script from 'next/script';
import { 
  Download,
  Upload,
  Plus, 
  Trash2,
  Database,
  ShieldAlert
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";

type TabType = 'motivos' | 'sistemas' | 'subSistemas';

interface StoreData {
  motivos: string[];
  sistemas: string[];
  subSistemas: string[];
}

const initialData: StoreData = {
  motivos: ["MOBILIZAÇÃO", "DESMOBILIZAÇÃO", "FALHA DE MANUTENÇÃO"],
  sistemas: ["IMPLEMENTO", "HIDRÁULICO", "TRANSMISSÃO"],
  subSistemas: ["SKID", "DOCUMENTAÇÃO", "MULT", "PIPA"]
};

export default function BaseDadosPage() {
  const { user, profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [activeTab, setActiveTab] = useState<TabType>('motivos');
  const [data, setData] = useState<StoreData>(initialData);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [newItemText, setNewItemText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carregar do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('@eunaman:basedados');
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) {
        console.error("Erro ao carregar dados", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Salvar no localStorage sempre que 'data' for alterado
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('@eunaman:basedados', JSON.stringify(data));
    }
  }, [data, isLoaded]);

  // Handle Tab Switch
  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    setSelectedItems([]); // Limpar seleção ao trocar aba
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedItems(data[activeTab]);
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (item: string) => {
    if (selectedItems.includes(item)) {
      setSelectedItems(selectedItems.filter(i => i !== item));
    } else {
      setSelectedItems([...selectedItems, item]);
    }
  };

  const handleDeleteItem = (item: string) => {
    if (confirm(`Excluir permanentemente o item "${item}"?`)) {
      setData({
        ...data,
        [activeTab]: data[activeTab].filter(i => i !== item)
      });
      setSelectedItems(selectedItems.filter(i => i !== item));
    }
  };

  const handleBatchDelete = () => {
    if (confirm(`Deseja excluir permanentemente os ${selectedItems.length} itens selecionados?`)) {
      setData({
        ...data,
        [activeTab]: data[activeTab].filter(i => !selectedItems.includes(i))
      });
      setSelectedItems([]);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newItemText.trim().toUpperCase();
    if (!text) return;
    
    if (data[activeTab].includes(text)) {
      alert("Este item já existe na lista.");
      return;
    }

    setData({
      ...data,
      [activeTab]: [text, ...data[activeTab]] // Adiciona no topo
    });
    setNewItemText("");
  };

  const exportToJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "base_dados.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportToExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando. Tente novamente em alguns instantes.");
      return;
    }
    
    const workbook = XLSX.utils.book_new();
    
    // Cria uma aba no Excel para cada lista de dados
    Object.keys(data).forEach((key) => {
      const arr = data[key as TabType].map(item => ({ Nome: item }));
      const worksheet = XLSX.utils.json_to_sheet(arr);
      XLSX.utils.book_append_sheet(workbook, worksheet, key);
    });
    
    XLSX.writeFile(workbook, "base_dados.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
      handleImportCSV(file);
      return;
    }

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando. Tente novamente em alguns instantes.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileData = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(fileData, { type: 'array' });
        
        const newData = { ...data };
        let importedTotal = 0;

        workbook.SheetNames.forEach((sheetName: string) => {
          // Identificar se a aba no excel se chama 'motivos', 'sistemas', etc.
          const matchedKey = Object.keys(newData).find(k => k.toLowerCase() === sheetName.toLowerCase().replace('-', ''));
          if (matchedKey) {
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            const items = new Set(newData[matchedKey as TabType]);
            
            // Assume the first column contains the names. If header: 1, row 0 is header.
            for (let i = 1; i < json.length; i++) { 
               if (json[i] && json[i][0]) {
                  items.add(String(json[i][0]).trim().toUpperCase());
                  importedTotal++;
               }
            }
            newData[matchedKey as TabType] = Array.from(items);
          }
        });
        
        if (importedTotal > 0) {
          setData(newData);
          alert(`${importedTotal} itens importados com sucesso a partir do Excel!`);
        } else {
           alert("Nenhum item válido encontrado no Excel. Certifique-se de que a planilha possui abas com os nomes 'motivos', 'sistemas' ou 'subSistemas' e os dados estejam na primeira coluna.");
        }
      } catch (err) {
        console.error("Erro ao importar Excel", err);
        alert("Erro ao processar o arquivo Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target?.result as string;
      const lines = csvData.split('\n');
      
      const items = new Set(data[activeTab]);
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const val = lines[i].trim().toUpperCase();
        if (val) {
           items.add(val);
           imported++;
        }
      }
      
      setData({
        ...data,
        [activeTab]: Array.from(items)
      });
      alert(`${imported} itens importados com sucesso para a aba '${activeTab}' via CSV.`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <Database className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] dark:text-zinc-100">Base de Dados</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Gerenciar tabelas auxiliares do sistema
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          {!isVisitante ? (
            <>
              <input 
                type="file" 
                accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
                ref={fileInputRef} 
                onChange={handleImportExcel} 
                className="hidden" 
              />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm">
                <Upload size={16} /> Importar Excel/CSV
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <ShieldAlert size={16} />
              <span>Somente Leitura</span>
            </div>
          )}
          <button onClick={exportToJSON} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm">
            <Download size={16} /> JSON
          </button>
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
            <Download size={16} /> Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-xl flex items-center mb-2 shadow-sm border border-slate-200 dark:border-slate-700/50">
        {['motivos', 'sistemas', 'subSistemas'].map((tab) => (
          <button
            key={tab}
            onClick={() => switchTab(tab as TabType)}
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden flex-1">
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
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder={`Novo ${activeTab === 'motivos' ? 'motivo' : activeTab === 'sistemas' ? 'sistema' : 'sub-sistema'}...`}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3.5"
              />
              <button type="submit" className="flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors shadow-sm">
                <Plus size={16} /> Adicionar
              </button>
            </form>
          )}

          <div className="flex flex-col">
             {/* Check All header row */}
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
               <label htmlFor="selectAll" className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 flex-1 cursor-pointer">
                  NOME / DESCRIÇÃO
               </label>
               {!isVisitante && <span className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400 w-12 text-center">AÇÕES</span>}
             </div>

             {/* List of items */}
             <div className="flex flex-col gap-1">
               {data[activeTab].map((item, index) => (
                 <div key={index} className="flex items-center gap-4 py-3 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                    <div className="flex items-center justify-center p-1 w-8">
                      <input 
                        type="checkbox" 
                        checked={selectedItems.includes(item)}
                        onChange={() => handleSelectItem(item)}
                        className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 dark:bg-slate-700 dark:border-slate-600 cursor-pointer"
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 uppercase">{item}</span>
                    {!isVisitante && (
                      <div className="w-12 flex justify-center">
                        <button 
                          onClick={() => handleDeleteItem(item)}
                          className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Excluir permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                 </div>
               ))}
             </div>

             {data[activeTab].length === 0 && (
               <div className="py-12 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                 <Database className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                 <p className="text-sm font-medium">Nenhum item cadastrado nesta categoria.</p>
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
