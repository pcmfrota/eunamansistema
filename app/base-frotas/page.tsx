"use client";

import React, { useState, useRef, useEffect } from 'react';
import Script from 'next/script';
import { 
  Download,
  Upload,
  Plus, 
  Search, 
  Pencil,
  Trash2,
  Truck,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import EquipamentoModal from './EquipamentoModal';
import { 
  buscarEquipamentosComEscala, 
  excluirEquipamento, 
  excluirEquipamentosMassivo, 
  importarEquipamentos 
} from './actions';

const colorMap: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  pink: "bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300",
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300",
};

export default function BaseFrotasPage() {
  const { profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await buscarEquipamentosComEscala();
      setVehicles(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedVehicles(vehicles.map(v => v.id));
    } else {
      setSelectedVehicles([]);
    }
  };

  const handleSelectVehicle = (id: string) => {
    if (selectedVehicles.includes(id)) {
      setSelectedVehicles(selectedVehicles.filter(p => p !== id));
    } else {
      setSelectedVehicles([...selectedVehicles, id]);
    }
  };

  const handleDelete = async (vehicle: any) => {
    if (confirm(`Tem certeza que deseja excluir o veículo ${vehicle.placa}?`)) {
      const res = await excluirEquipamento(vehicle.id);
      if ('error' in res) alert(res.error);
      else loadData();
    }
  };

  const handleBatchDelete = async () => {
    if (confirm(`Tem certeza que deseja excluir os ${selectedVehicles.length} veículos selecionados?`)) {
      const res = await excluirEquipamentosMassivo(selectedVehicles);
      if ('error' in res) alert(res.error);
      else {
        setSelectedVehicles([]);
        loadData();
      }
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("A biblioteca do Excel ainda está carregando.");
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        const res = await importarEquipamentos(json);
        if ('error' in res) {
          alert(`Erro na importação: ${res.error}`);
        } else {
          alert(`${res.count} veículos processados com sucesso!`);
          loadData();
        }
      } catch (err) {
        console.error(err);
        alert("Erro ao processar arquivo Excel.");
      } finally {
        setIsImporting(false);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const exportToExcel = () => {
    const XLSX = (window as any).XLSX;
    if (!XLSX) return;
    const worksheet = XLSX.utils.json_to_sheet(vehicles);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Frotas");
    XLSX.writeFile(workbook, "base_frotas.xlsx");
  };

  const filteredVehicles = vehicles.filter(v => 
    v.placa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.tipo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.modulo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTipoColor = (tipo: string) => {
    if (!tipo) return 'slate';
    const t = tipo.toUpperCase();
    if (t.includes('COMBOIO')) return 'blue';
    if (t.includes('MUNCK')) return 'amber';
    if (t.includes('MULTIFUNCIONAL')) return 'pink';
    if (t.includes('PIPA')) return 'purple';
    if (t.includes('ESCAVADEIRA')) return 'orange';
    if (t.includes('CARRETAGEM')) return 'emerald';
    return 'slate';
  };

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-500/20 rounded-xl">
            <Truck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] dark:text-zinc-100">Base de Frotas</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Cadastro completo dos veículos e equipamentos (Sincronizado com Supabase)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
          {!isVisitante ? (
            <>
              <input type="file" accept=".xlsx,.xls,.csv" ref={fileInputRef} onChange={handleImportExcel} className="hidden" />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                disabled={isImporting}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors shadow-sm",
                  isImporting ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                )}
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload size={16} />}
                {isImporting ? "Importando..." : "Importar Excel"}
              </button>
              <button 
                onClick={() => { setEditingVehicle(null); setIsModalOpen(true); }}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus size={16} /> Novo Veículo
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <ShieldAlert size={16} />
              <span>Somente Leitura</span>
            </div>
          )}
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors shadow-sm">
            <Download size={16} /> Exportar Excel
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col w-full">
        <div className="p-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Veículos ({vehicles.length})</h2>
            {selectedVehicles.length > 0 && !isVisitante && (
              <button onClick={handleBatchDelete} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                <Trash2 size={14} /> Excluir Selecionados ({selectedVehicles.length})
              </button>
            )}
          </div>
          
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Buscar por placa, tipo ou módulo..."
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[13px] text-slate-500 dark:text-slate-400 font-semibold bg-slate-50 border-b border-slate-100 dark:bg-slate-900/50 dark:border-slate-700/50">
              <tr>
                <th className="py-4 px-6 w-12">
                  <input type="checkbox" onChange={handleSelectAll} checked={vehicles.length > 0 && selectedVehicles.length === vehicles.length} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />
                </th>
                <th className="py-4 px-6 font-semibold">Placa</th>
                <th className="py-4 px-6 font-semibold">Tipo</th>
                <th className="py-4 px-6 font-semibold">Categoria</th>
                <th className="py-4 px-6 font-semibold">Módulo</th>
                <th className="py-4 px-6 font-semibold">Horímetro Atual</th>
                <th className="py-4 px-6 font-semibold">Carga Horária</th>
                <th className="py-4 px-6 font-semibold">Período</th>
                <th className="py-4 px-6 font-semibold">Status</th>
                <th className="py-4 px-6 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">Carregando frota...</td></tr>
              ) : filteredVehicles.length === 0 ? (
                <tr><td colSpan={9} className="py-12 text-center text-slate-400">Nenhum veículo encontrado.</td></tr>
              ) : filteredVehicles.map((vehicle) => (
                <tr key={vehicle.id} className={cn("transition-colors", selectedVehicles.includes(vehicle.id) ? "bg-blue-50/50 dark:bg-blue-500/5" : "hover:bg-slate-50/50 dark:hover:bg-slate-800/50")}>
                  <td className="py-3.5 px-6">
                    <input type="checkbox" onChange={() => handleSelectVehicle(vehicle.id)} checked={selectedVehicles.includes(vehicle.id)} className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500" />
                  </td>
                  <td className="py-3.5 px-6 font-bold text-blue-600 dark:text-blue-400 uppercase">
                    <button 
                      onClick={() => { setEditingVehicle(vehicle); setIsModalOpen(true); }}
                      className="hover:underline focus:outline-none"
                    >
                      {vehicle.placa}
                    </button>
                  </td>
                  <td className="py-3.5 px-6">
                    <span className={cn("px-2.5 py-1 text-xs font-semibold rounded-md uppercase tracking-wide", colorMap[getTipoColor(vehicle.tipo)] || colorMap.slate)}>
                      {vehicle.tipo}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 uppercase tracking-wide">
                      {vehicle.categoria}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300 uppercase">{vehicle.modulo}</td>
                  <td className="py-3.5 px-6 text-slate-600 dark:text-slate-300 font-mono">{vehicle.ultimo_hist || vehicle.ultimoHist || 0}h</td>
                  <td className="py-3.5 px-6">
                    {vehicle.escala ? (
                      <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 uppercase">
                        {vehicle.escala.carga_horaria}h/dia
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    {vehicle.escala ? (
                      <span className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 font-mono">
                        {vehicle.escala.periodo_inicio?.slice(0,5)} → {vehicle.escala.periodo_fim?.slice(0,5)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">24h (padrão)</span>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className={cn(
                      "px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border",
                      vehicle.status === 'Inativo' 
                        ? "bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-900/30" 
                        : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30"
                    )}>
                      {vehicle.status || 'Ativo'}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center justify-end gap-2">
                      {!isVisitante && (
                        <>
                          <button onClick={() => { setEditingVehicle(vehicle); setIsModalOpen(true); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded transition-colors" title="Editar">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => handleDelete(vehicle)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-colors" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EquipamentoModal 
        isOpen={isModalOpen} 
        onClose={() => { setIsModalOpen(false); loadData(); }} 
        editingVehicle={editingVehicle} 
      />
      
      <Script src="https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js" strategy="lazyOnload" />
    </div>
  );
}
