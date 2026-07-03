"use client";

import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Download, 
  Plus, 
  Search, 
  Filter, 
  RefreshCcw,
  Layers,
  ShieldAlert,
  ArrowRight,
  Database,
  BarChart3
} from 'lucide-react';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { useAuth } from '@/components/auth-context';
import { getBacklog, deleteBacklogItems } from './actions';
import BacklogModal from './BacklogModal';
import BacklogTable from './BacklogTable';
import BacklogImportModal from './BacklogImportModal';
import BacklogDashboard from './BacklogDashboard';
import { PremiumLoader } from '@/components/premium-loader';
import { useOffline } from '@/components/offline-provider';
import { localDb } from '@/lib/offline-db';

type Placa = { id: string; placa: string; modulo: string | null; area: string | null };
type Colaborador = { id: string; nome: string };

export default function BacklogClient({ placas, colaboradores, calendario = [] }: { placas: Placa[], colaboradores: Colaborador[], calendario?: any[] }) {
  const { profile } = useAuth();
  const isVisitante = profile?.role === 'visitante';
  const { isOnline } = useOffline();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'Geral' | 'Dashboard' | 'Detalhamento'>('Dashboard');
  
  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  
  // Search State
  const [search, setSearch] = useState("");

  const [localPlacas, setLocalPlacas] = useState<Placa[]>(placas || []);
  const [localColaboradores, setLocalColaboradores] = useState<Colaborador[]>(colaboradores || []);

  useEffect(() => {
    if (placas && placas.length > 0) {
      setLocalPlacas(placas);
      if (isOnline) {
        localDb.saveMany("equipamentos", placas).catch(err => console.error("Erro ao salvar frotas localmente:", err));
      }
    } else {
      const loadPlacas = async () => {
        try {
          const dbPlacas = await localDb.getAll<Placa>("equipamentos");
          if (dbPlacas && dbPlacas.length > 0) {
            setLocalPlacas(dbPlacas);
          }
        } catch (err) {
          console.error("Erro ao carregar frotas locais:", err);
        }
      };
      loadPlacas();
    }
  }, [placas, isOnline]);

  useEffect(() => {
    if (colaboradores && colaboradores.length > 0) {
      setLocalColaboradores(colaboradores);
      if (isOnline) {
        localDb.saveMany("colaboradores", colaboradores).catch(err => console.error("Erro ao salvar colaboradores localmente:", err));
      }
    } else {
      const loadColaboradores = async () => {
        try {
          const dbColaboradores = await localDb.getAll<Colaborador>("colaboradores");
          if (dbColaboradores && dbColaboradores.length > 0) {
            setLocalColaboradores(dbColaboradores);
          }
        } catch (err) {
          console.error("Erro ao carregar colaboradores locais:", err);
        }
      };
      loadColaboradores();
    }
  }, [colaboradores, isOnline]);

  const refreshData = async () => {
    // 1. Carrega dados locais do IndexedDB imediatamente
    let dbData: any[] = [];
    try {
      dbData = await localDb.getAll("backlog");
    } catch (err) {
      console.error("Erro ao ler backlog local do IndexedDB:", err);
    }
    const hasCache = dbData && dbData.length > 0;

    if (!hasCache) {
      // Sem cache: mostra o loader de tela cheia
      setLoading(true);
    } else {
      // Com cache: exibe o cache instantaneamente e desativa o loader de tela cheia
      dbData.sort((a, b) => new Date(b.data_evidencia || 0).getTime() - new Date(a.data_evidencia || 0).getTime());
      setItems(dbData);
      setLoading(false);
    }
    
    setIsRefreshing(true);

    try {
      if (isOnline) {
        const res = await getBacklog(5000);
        if (!res.error) {
          const freshData = res.data || [];
          setItems(freshData);
          try {
            await localDb.saveMany("backlog", freshData);
          } catch (dbErr) {
            console.error("Erro ao salvar backlog no IndexedDB:", dbErr);
          }
        } else {
          console.error("Erro ao sincronizar backlog do Supabase:", res.error);
        }
      } else {
        let data: any[] = [];
        try {
          data = await localDb.getAll("backlog");
        } catch (dbErr) {
          console.error("Erro ao ler backlog local offline:", dbErr);
        }
        data.sort((a, b) => new Date(b.data_evidencia || 0).getTime() - new Date(a.data_evidencia || 0).getTime());
        setItems(data);
      }
    } catch (err) {
      console.error("Falha ao atualizar dados do backlog:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [isOnline]);

  useEffect(() => {
    let active = true;
    const loadFromDb = async () => {
      try {
        const data = await localDb.getAll("backlog");
        if (active) {
          data.sort((a, b) => new Date(b.data_evidencia || 0).getTime() - new Date(a.data_evidencia || 0).getTime());
          setItems(data);
          // Se temos dados locais carregados, garantimos que o loader de tela cheia suma
          if (data.length > 0) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Erro ao carregar dados do IndexedDB no boot:", err);
      }
    };
    loadFromDb();

    window.addEventListener("offline-db-updated-backlog", loadFromDb);
    window.addEventListener("offline-sync-completed", loadFromDb);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-backlog", loadFromDb);
      window.removeEventListener("offline-sync-completed", loadFromDb);
    };
  }, []);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Confirmar exclusão definitiva deste item?")) return;
    if (isOnline) {
      const res = await deleteBacklogItems([id]);
      if (res.success) {
        await localDb.delete("backlog", id);
        window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
      } else {
        alert(res.error);
      }
    } else {
      await localDb.delete("backlog", id);
      await localDb.addToQueue('backlog', 'delete', [id]);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Confirmar exclusão de ${selectedIds.size} itens?`)) return;
    const idsArray = Array.from(selectedIds);
    if (isOnline) {
      const res = await deleteBacklogItems(idsArray);
      if (res.success) {
        await localDb.deleteMany("backlog", idsArray);
        window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
        setSelectedIds(new Set());
      } else {
        alert(res.error);
      }
    } else {
      await localDb.deleteMany("backlog", idsArray);
      await localDb.addToQueue('backlog', 'delete', idsArray);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
      setSelectedIds(new Set());
    }
  };

  const currentPeriod = React.useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) return period;
    
    const now = new Date();
    return {
      ano: now.getFullYear(),
      mes: now.getMonth() + 1
    };
  }, [calendario]);

  const defaultMonthName = React.useMemo(() => {
    const months = [
      'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
      'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ];
    return months[Number(currentPeriod.mes) - 1] || 'janeiro';
  }, [currentPeriod]);

  const defaultYearString = React.useMemo(() => {
    return String(currentPeriod.ano);
  }, [currentPeriod]);

  // Filter States
  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterModulo, setFilterModulo] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCriticidade, setFilterCriticidade] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterMes, setFilterMes] = useState(defaultMonthName);
  const [filterAno, setFilterAno] = useState(defaultYearString);

  const hasActiveFilters = search || filterPlaca || filterModulo || filterArea || filterStatus || filterCriticidade || filterDataInicio || filterDataFim || filterMes !== defaultMonthName || filterAno !== defaultYearString;

  const clearFilters = () => {
    setSearch("");
    setFilterPlaca("");
    setFilterModulo("");
    setFilterArea("");
    setFilterStatus("");
    setFilterCriticidade("");
    setFilterDataInicio("");
    setFilterDataFim("");
    setFilterMes("");
    setFilterAno("");
  };

  // Dynamic options from data - MEMOIZED
  const placaOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.frota).filter(Boolean))).sort(), [items]);
  const areaOptions = React.useMemo(() => Array.from(new Set(localPlacas.map(p => p.area).filter(Boolean))).sort(), [localPlacas]);
  const moduloOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.modulo).filter(Boolean))).sort(), [items]);
  const statusOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.status).filter(Boolean))).sort(), [items]);
  const criticidadeOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.criticidade).filter(Boolean))).sort(), [items]);

  const anoOptions = React.useMemo(() => {
    const years = new Set<string>();
    items.forEach(i => {
      if (i.data_evidencia) {
        const d = new Date(i.data_evidencia);
        if (!isNaN(d.getTime())) years.add(String(d.getFullYear()));
      } else if (i.ano) {
        years.add(String(i.ano));
      }
    });
    return Array.from(years).sort();
  }, [items]);

  const filteredItems = React.useMemo(() => {
    const placasMap = new Map(localPlacas.map(p => [p.placa, p]));
    return items.filter(i => {
      const q = search.toLowerCase();
      const matchSearch = !q || 
        i.frota?.toLowerCase().includes(q) ||
        i.descricao?.toLowerCase().includes(q);
      const matchPlaca = !filterPlaca || i.frota === filterPlaca;
      const matchModulo = !filterModulo || i.modulo === filterModulo;
      
      let matchArea = true;
      if (filterArea) {
        const pInfo = placasMap.get(i.frota);
        matchArea = pInfo?.area === filterArea;
      }

      const matchStatus = !filterStatus || i.status === filterStatus;
      const matchCriticidade = !filterCriticidade || i.criticidade === filterCriticidade;

      let matchData = true;
      if (filterDataInicio || filterDataFim) {
        if (!i.data_evidencia) {
          matchData = false;
        } else {
          const itemDate = i.data_evidencia.split('T')[0];
          if (filterDataInicio && itemDate < filterDataInicio) matchData = false;
          if (filterDataFim && itemDate > filterDataFim) matchData = false;
        }
      }

      let matchMonth = true;
      let matchYear = true;
      
      let itemMonth = '';
      let itemYear = '';
      if (i.data_evidencia) {
        const d = new Date(i.data_evidencia);
        if (!isNaN(d.getTime())) {
          const months = [
            'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
            'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
          ];
          itemMonth = months[d.getMonth()];
          itemYear = String(d.getFullYear());
        }
      } else if (i.mes) {
        const months = [
          'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
          'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
        ];
        const mIdx = parseInt(i.mes) - 1;
        if (mIdx >= 0 && mIdx < 12) itemMonth = months[mIdx];
        if (i.ano) itemYear = String(i.ano);
      }

      if (filterMes && itemMonth !== filterMes) matchMonth = false;
      if (filterAno && itemYear !== filterAno) matchYear = false;

      return matchSearch && matchPlaca && matchModulo && matchArea && matchStatus && matchCriticidade && matchData && matchMonth && matchYear;
    });
  }, [items, search, filterPlaca, filterModulo, filterArea, filterStatus, filterCriticidade, filterDataInicio, filterDataFim, filterMes, filterAno, localPlacas]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backlog");
    XLSX.writeFile(wb, "EUNAMAN_Backlog.xlsx");
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[120rem] mx-auto w-full h-full animate-in fade-in duration-700">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-950 p-6 md:p-10 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -mr-32 -mt-32 group-hover:bg-indigo-500/10 transition-all duration-700" />
         
         <div className="flex items-center gap-6 relative z-10">
            <div className="p-5 bg-indigo-600 text-white rounded-[2rem] shadow-2xl shadow-indigo-500/40 scale-100 group-hover:scale-105 transition-all">
              <Layers size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">Backlog Geral</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-black flex items-center gap-2 tracking-widest mt-1">
                 <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                 PCM • PLANEJAMENTO E CONTROLE
                 <span className="ml-2 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    Dados até: {new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('pt-BR')} (D+1)
                 </span>
              </p>
            </div>
         </div>

         <div className="flex items-center gap-3 relative z-10 flex-wrap">
            <button 
              onClick={exportToExcel} 
              className="flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm"
            >
               <Download size={18} /> Exportar
            </button>
            {!isVisitante ? (
              <>
                <button 
                  onClick={() => setIsImportOpen(true)} 
                  className="flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm"
                >
                   <Upload size={18} /> Importar
                </button>
                <button 
                  onClick={() => { setEditingItem(null); setIsModalOpen(true); }} 
                  className="flex items-center gap-2.5 px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 transition-all active:scale-95 group"
                >
                   <Plus size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                   Adicionar Item
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 px-6 py-3.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 text-[10px] font-black border border-zinc-200 dark:border-zinc-800 shadow-inner uppercase tracking-widest">
                 <ShieldAlert size={18} className="text-indigo-500" />
                 Modo de Leitura
              </div>
            )}
         </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        {/* Row 1: View tabs + refresh */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2 p-1.5 bg-zinc-100/50 dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm">
            {(['Geral', 'Dashboard', 'Detalhamento'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all",
                  view === v ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-lg" : "text-zinc-400 hover:text-zinc-600",
                  v === 'Dashboard' && "flex items-center gap-1.5"
                )}
              >
                {v === 'Dashboard' && <BarChart3 size={12} />}
                {v}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">
                  {filteredItems.length} resultado{filteredItems.length !== 1 ? 's' : ''}
                </span>
                <button
                  onClick={clearFilters}
                  className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors ml-1"
                >
                  ✕ Limpar
                </button>
              </div>
            )}
            <button
              onClick={refreshData}
              className="p-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400 hover:text-indigo-600 hover:border-indigo-500/30 transition-all shadow-sm active:rotate-180 duration-500"
              disabled={loading || isRefreshing}
            >
              <RefreshCcw size={20} className={loading || isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Row 2: Search + Filters */}
        {view !== 'Dashboard' && (
          <div className="flex flex-wrap gap-3 items-center">
          {/* Text search */}
          <div className="relative flex-1 group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
            <input
              type="text"
              placeholder="BUSCAR POR FROTA OU DESCRIÇÃO..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
          </div>

          {/* Placa filter */}
          <select
            value={filterPlaca}
            onChange={e => setFilterPlaca(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[160px]",
              filterPlaca
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">🚛 TODAS AS PLACAS</option>
            {placaOptions.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Módulo filter */}
          <select
            value={filterModulo}
            onChange={e => setFilterModulo(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[170px]",
              filterModulo
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">📍 TODOS OS MÓDULOS</option>
            {moduloOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Área filter */}
          <select
            value={filterArea}
            onChange={e => setFilterArea(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[170px]",
              filterArea
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">🏢 TODAS AS ÁREAS</option>
            {areaOptions.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[160px]",
              filterStatus
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">📋 TODOS OS STATUS</option>
            {statusOptions.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Criticidade filter */}
          <select
            value={filterCriticidade}
            onChange={e => setFilterCriticidade(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[180px]",
              filterCriticidade
                ? "bg-orange-600 text-white border-orange-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">⚠️ TODA CRITICIDADE</option>
            {criticidadeOptions.map(c => (
              <option key={c} value={c}>{c === 'A' ? 'A - CRÍTICO' : 'B - NORMAL'}</option>
            ))}
          </select>

          {/* Mês filter */}
          <select
            value={filterMes}
            onChange={e => setFilterMes(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[150px]",
              filterMes
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">📅 TODOS OS MESES</option>
            {['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].map(m => (
              <option key={m} value={m}>{m.toUpperCase()}</option>
            ))}
          </select>

          {/* Ano filter */}
          <select
            value={filterAno}
            onChange={e => setFilterAno(e.target.value)}
            className={cn(
              "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none min-w-[120px]",
              filterAno
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
            )}
          >
            <option value="">📅 TODOS OS ANOS</option>
            {anoOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Data Início */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">De:</span>
            <input 
              type="date" 
              value={filterDataInicio} 
              onChange={e => setFilterDataInicio(e.target.value)}
              className="bg-transparent text-xs font-black text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer"
            />
          </div>

          {/* Data Fim */}
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm">
            <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Até:</span>
            <input 
              type="date" 
              value={filterDataFim} 
              onChange={e => setFilterDataFim(e.target.value)}
              className="bg-transparent text-xs font-black text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer"
            />
          </div>
        </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] py-20 bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800">
          <PremiumLoader type="squares-sequential" text="Carregando Backlog" subtext="Calculando aging e criticidades..." />
        </div>
      ) : view === 'Dashboard' ? (
        /* Dashboard View */
        <BacklogDashboard items={items} placas={localPlacas} calendario={calendario} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <>
          {/* Multi-Select Floating Bar */}
          {selectedIds.size > 0 && !isVisitante && (
            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 duration-500">
               <div className="flex items-center gap-6 px-10 py-5 bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-xl">
                  <div className="flex items-center gap-3 pr-6 border-r border-white/10">
                     <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/20">
                        {selectedIds.size}
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Selecionados</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">Ações em massa habilitadas</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-6">
                     <button onClick={handleBatchDelete} className="flex items-center gap-2 text-xs font-black text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest">
                       <Plus size={18} className="rotate-45" /> EXCLUIR SELEÇÃO
                     </button>
                     <button onClick={() => setSelectedIds(new Set())} className="text-xs font-black text-zinc-400 hover:text-white transition-colors uppercase tracking-widest">
                       LIMPAR
                     </button>
                  </div>
               </div>
            </div>
          )}

          {/* Main Table Content */}
          <div className="flex-1 min-h-[400px]">
            <BacklogTable 
              items={filteredItems}
              selectedIds={selectedIds}
              onToggleSelect={(id) => {
                const next = new Set(selectedIds);
                if (next.has(id)) next.delete(id); else next.add(id);
                setSelectedIds(next);
              }}
              onToggleSelectAll={() => {
                if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(filteredItems.map(i => i.id)));
              }}
              onEdit={handleEdit}
              onDelete={handleDelete}
              view={view as 'Geral' | 'Detalhamento'}
            />
          </div>
        </>
      )}

      {/* Global Persistence Notice */}
      <div className="flex items-center justify-center p-6 bg-zinc-50/50 dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800 border-dashed">
         <div className="flex items-center gap-3 text-zinc-400">
            <Database size={16} />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Dados Sincronizados com Supabase Cloud EUNAMAN</span>
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
         </div>
      </div>

      {/* Modals */}
      <BacklogModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); refreshData(); }}
        placas={localPlacas}
        colaboradores={localColaboradores}
        editData={editingItem}
      />

      <BacklogImportModal 
        isOpen={isImportOpen}
        onClose={() => { setIsImportOpen(false); refreshData(); }}
      />
    </div>
  );
}
