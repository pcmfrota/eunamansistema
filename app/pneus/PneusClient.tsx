"use client";

import React, { useState } from "react";
import { Download, Upload, Plus, Circle, ShieldAlert, AlertTriangle, Search } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { excluirInspecao, excluirInspecoesMassivo } from "./actions";
import { useAuth } from "@/components/auth-context";
import PneusModal from "./PneusModal";
import PneusImportModal from "./PneusImportModal";
import * as XLSX from "xlsx";

// ─── Types ────────────────────────────────────────────────────────────────────
type Equipamento = { id: string; placa: string; tipo?: string | null; modulo?: string | null };
type Inspecao = {
  id: string;
  equipamento_id: string;
  data_inspecao: string;
  km_atual: number | null;
  de: number | null; dd: number | null;
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null;
  estepe: number | null;
  condicao: string;
  equipamentos?: { placa: string; tipo?: string | null };
};

const POSICOES = ["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as const;
type Pos = typeof POSICOES[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sulcoColor(v: number | null): string {
  if (v == null) return "bg-zinc-100 dark:bg-zinc-800 text-zinc-400";
  if (v < 3) return "bg-red-500 text-white";
  if (v < 5) return "bg-orange-400 text-white";
  if (v < 9) return "bg-yellow-400 text-zinc-900";
  return "bg-emerald-500 text-white";
}

function condBadge(c: string) {
  const map: Record<string, string> = {
    BOM: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    REGULAR: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    CRITICO: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    TROCAR: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return map[c] || map.BOM;
}

const COND_COLOR: Record<string, string> = {
  BOM: "#22c55e", REGULAR: "#facc15", CRITICO: "#f97316", TROCAR: "#ef4444",
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const [datePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

type Tab = "dashboard" | "lista" | "historico";

export default function PneusClient({
  equipamentos,
  inspecoes,
}: {
  equipamentos: Equipamento[];
  inspecoes: Inspecao[];
}) {
  const { profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inspecao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Batch Actions ──
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === inspecoes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(inspecoes.map(i => i.id)));
  };
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Confirmar exclusão de ${selectedIds.size} registros?`)) return;
    const res = await excluirInspecoesMassivo(Array.from(selectedIds));
    if (res?.error) alert(res.error); else setSelectedIds(new Set());
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Confirmar exclusão definitiva?")) return;
    const res = await excluirInspecao(id);
    if (res?.error) alert(res.error);
  };

  // ── Search & Filter ──
  const [search, setSearch] = useState("");

  const filteredInspecoes = inspecoes.filter(i => 
    i.equipamentos?.placa?.toLowerCase().includes(search.toLowerCase()) ||
    i.condicao?.toLowerCase().includes(search.toLowerCase())
  );

  const handleClearFilters = () => {
    setSearch("");
  };

  // ── Dashboard Metrics (Always use full data for stats, or filtered?)
  // User usually wants to see stats of the filtered set or global? 
  // For Pneus, global stats are better for the dashboard tab, 
  // but the 'lista' and 'dashboard table' should reflect filters.
  const counts = { BOM: 0, REGULAR: 0, CRITICO: 0, TROCAR: 0 };
  inspecoes.forEach(ins => { if (ins.condicao in counts) counts[ins.condicao as keyof typeof counts]++; });
  const total = inspecoes.length || 1;
  const criticos = inspecoes.filter(i => i.condicao === "CRITICO" || i.condicao === "TROCAR");
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);

  const posMedia = POSICOES.map(pos => {
    const vals = inspecoes.map(i => i[pos]).filter(v => v != null) as number[];
    return { pos: pos.toUpperCase(), media: vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : 0 };
  }).filter(d => d.media > 0);

  const latestByEq = Object.values(filteredInspecoes.reduce((acc, current) => {
    if (!acc[current.equipamento_id] || current.data_inspecao > acc[current.equipamento_id].data_inspecao) {
      acc[current.equipamento_id] = current;
    }
    return acc;
  }, {} as Record<string, Inspecao>));

  const exportExcel = () => {
    const rows = inspecoes.map(i => ({
      Placa: i.equipamentos?.placa, Data: fmtDate(i.data_inspecao), Km: i.km_atual, Condicao: i.condicao,
      DE: i.de, DD: i.dd, TEI: i.tei, TEE: i.tee, TDI: i.tdi, TDE: i.tde, ESTEPE: i.estepe
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pneus");
    XLSX.writeFile(wb, "Relatorio_Pneus.xlsx");
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[100rem] mx-auto w-full h-full animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-950 p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-orange-500/10 transition-colors" />
         
         <div className="flex items-center gap-5 relative z-10">
            <div className="p-4 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-500/20">
              <Circle size={28} fill="currentColor" fillOpacity={0.2} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Boletim de Pneus</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                 Monitoramento e Inspeção de Frotas
              </p>
            </div>
         </div>

          <div className="flex items-center gap-3 relative z-10 flex-wrap">
            <div className="relative group">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="BUSCAR PLACA..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all w-60"
               />
            </div>
            {search && (
              <button 
                onClick={handleClearFilters}
                className="px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all"
              >
                Limpar Filtros
              </button>
            )}
            <button onClick={exportExcel} className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
               <Download size={18} /> Exportar
            </button>
            {!isVisitante ? (
              <>
                <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-2 px-5 py-3 text-sm font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
                   <Upload size={18} /> Importar
                </button>
                <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-7 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-orange-500/30 transition-all active:scale-95 group">
                   <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                   Registrar
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-5 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 text-xs font-bold border border-zinc-200 dark:border-zinc-800 shadow-inner">
                 <ShieldAlert size={16} className="text-orange-500" />
                 VISUALIZAÇÃO
              </div>
            )}
         </div>
      </div>

      {criticos.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold tracking-tight">
            ALERTA: {criticos.length} pneus em estado crítico ou troca imediata detectados na frota.
          </span>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit border border-zinc-200 dark:border-zinc-800">
           {(["dashboard", "lista", "historico"] as Tab[]).map((t) => (
             <button 
               key={t} onClick={() => setTab(t)}
               className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${tab === t ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-md" : "text-zinc-500 hover:text-zinc-700 hover:bg-white/50"}`}
             >
               {t}
             </button>
           ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {Object.entries(counts).map(([label, val]) => (
                <div key={label} className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group">
                   <div className="flex items-center justify-between mb-4">
                      <span className={`p-2.5 rounded-xl ${label === 'BOM' ? 'bg-emerald-50 text-emerald-500' : label === 'REGULAR' ? 'bg-yellow-50 text-yellow-500' : 'bg-red-50 text-red-500'}`}>
                         <Circle size={20} fill="currentColor" fillOpacity={0.2} />
                      </span>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Consolidado</span>
                   </div>
                   <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{val}</div>
                   <p className="text-xs font-bold text-zinc-500 mt-1">{label} - {Math.round((val/total)*100)}%</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[400px]">
                 <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-8 flex items-center gap-2">📊 Distribuição das Condições</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" paddingAngle={5}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={COND_COLOR[entry.name]} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                    </PieChart>
                 </ResponsiveContainer>
               </div>

               <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[400px]">
                 <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-8 flex items-center gap-2">📈 Média de Desgaste (Sulcos)</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={posMedia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                      <XAxis dataKey="pos" tick={{ fontSize: 9, fontWeight: 800, fill: '#71717a' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f4f4f5', radius: 10 }} contentStyle={{ borderRadius: '12px' }} />
                      <Bar dataKey="media" fill="#f97316" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>

            {/* Matrix Table */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
               <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-black text-zinc-800 dark:text-zinc-200 tracking-tight">Painel de Monitoramento Detalhado</h3>
                  <div className="flex gap-4 text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Bom</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Crítico</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Trocar</span>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-[10px]">
                   <thead>
                     <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                       <th className="px-6 py-4 font-black uppercase tracking-widest text-zinc-400 text-left">Veículo</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={2}>Frontal</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 1</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 2</th>
                       <th className="px-6 py-4 font-black uppercase tracking-widest text-zinc-400 text-center">Step</th>
                     </tr>
                     <tr className="bg-zinc-50/30 dark:bg-zinc-900/30">
                       <th className="px-6 py-2" />
                       {["DE","DD","TEI","TEE","TDI","TDE","TEI1","TEE1","TDI1","TDE1","EST"].map(l => (
                         <th key={l} className="px-1 py-2 text-center text-orange-500/70 font-black">{l}</th>
                       ))}
                     </tr>
                   </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                      {latestByEq.map((ins: any) => (
                       <tr key={ins.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors group">
                         <td className="px-6 py-4">
                            <span className="block text-sm text-zinc-900 dark:text-zinc-50 font-black">{ins.equipamentos?.placa}</span>
                            <span className="text-[9px] text-zinc-400 block tracking-widest">{ins.km_atual} KM</span>
                         </td>
                         {POSICOES.map(pos => (
                           <td key={pos} className="px-1 py-4 text-center">
                              {ins[pos] != null ? <span className={`inline-block w-8 py-1.5 rounded-lg border-b-2 text-center shadow-sm ${sulcoColor(ins[pos])}`}>{ins[pos]}</span> : <span className="text-zinc-200 dark:text-zinc-800 opacity-20">••</span>}
                           </td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {tab === "lista" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  {selectedIds.size > 0 && (
                    <button onClick={handleBatchDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all">Excluir {selectedIds.size}</button>
                  )}
               </div>
             </div>
             <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={inspecoes.length > 0 && selectedIds.size === inspecoes.length} /></th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Placa</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Data</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">KM</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">Status</th>
                      <th colSpan={3} className="px-4 py-4 font-black uppercase text-zinc-400 text-right">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {filteredInspecoes.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors group">
                        <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.has(ins.id)} onChange={() => toggleSelect(ins.id)} /></td>
                        <td className="px-4 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black">{ins.equipamentos?.placa}</td>
                        <td className="px-4 py-4 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{ins.km_atual || '??'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                        <td className="px-4 py-4 text-right" colSpan={3}>
                           {!isVisitante && (
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => { setEditingItem(ins); setIsModalOpen(true); }} className="p-2 text-zinc-400 hover:text-blue-500"><Plus size={16} /></button>
                                <button onClick={() => handleDelete(ins.id)} className="p-2 text-zinc-400 hover:text-red-500"><Plus size={16} className="rotate-45" /></button>
                              </div>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}
      </div>

      {/* Modals */}
      <PneusModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipamentos={equipamentos}
        editData={editingItem}
        onSuccess={() => {}}
      />
      
      <PneusImportModal 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
}
