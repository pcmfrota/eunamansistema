"use client";

import React, { useState } from "react";
import { Download, Upload, Plus, X, AlertTriangle, CheckCircle, Circle, Edit2, Trash2, CheckSquare, ShieldAlert } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { registrarInspecaoCompleta, importarInspecoesPneus, excluirInspecao, excluirInspecoesMassivo, atualizarInspecao } from "./actions";
import { useAuth } from "@/components/auth-context";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
const POSICOES = ["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as const;
type Pos = typeof POSICOES[number];

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
  const cleanStr = dateStr.slice(0, 16);
  if (!cleanStr.includes('T')) {
    const parts = cleanStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
  const [datePart] = cleanStr.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────
type Tab = "dashboard" | "lista" | "historico";

export default function PneusClient({
  equipamentos,
  inspecoes,
}: {
  equipamentos: Equipamento[];
  inspecoes: Inspecao[];
}) {
  const { user, profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [showModal, setShowModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingItem, setEditingItem] = useState<Inspecao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Checkbox toggle
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === inspecoes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(inspecoes.map(i => i.id)));
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Tem certeza que deseja apagar permanentemente ${selectedIds.size} inspeção(ões)?`)) return;
    const res = await excluirInspecoesMassivo(Array.from(selectedIds));
    if (res?.error) alert("Erro ao excluir: " + res.error);
    else setSelectedIds(new Set());
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja apagar permanentemente esta inspeção?")) return;
    const res = await excluirInspecao(id);
    if (res?.error) alert("Erro ao excluir: " + res.error);
    else {
      const next = new Set(selectedIds);
      next.delete(id);
      setSelectedIds(next);
    }
  };

  // ── KPIs por condição ──
  const counts = { BOM: 0, REGULAR: 0, CRITICO: 0, TROCAR: 0 };
  for (const ins of inspecoes) {
    const k = ins.condicao as keyof typeof counts;
    if (k in counts) counts[k]++;
  }
  const total = inspecoes.length || 1;
  const criticos = inspecoes.filter(i => i.condicao === "CRITICO" || i.condicao === "TROCAR");

  // ── Pie data ──
  const pieData = [
    { name: "Bom", value: counts.BOM },
    { name: "Regular", value: counts.REGULAR },
    { name: "Crítico", value: counts.CRITICO },
    { name: "Trocar", value: counts.TROCAR },
  ].filter(d => d.value > 0);

  // ── Bar chart: média sulco por posição ──
  const posMedia: Record<string, { sum: number; n: number }> = {};
  for (const pos of POSICOES) posMedia[pos] = { sum: 0, n: 0 };
  for (const ins of inspecoes) {
    for (const pos of POSICOES) {
      const v = ins[pos as Pos];
      if (v != null) { posMedia[pos].sum += v; posMedia[pos].n++; }
    }
  }
  const barData = POSICOES.map(pos => ({
    pos: pos.toUpperCase(),
    media: posMedia[pos].n > 0 ? Math.round((posMedia[pos].sum / posMedia[pos].n) * 10) / 10 : 0,
  })).filter(d => d.media > 0);

  // ── Latest inspection per vehicle ──
  const latestByEq: Record<string, Inspecao> = {};
  for (const ins of [...inspecoes].sort((a, b) => b.data_inspecao.localeCompare(a.data_inspecao))) {
    if (!latestByEq[ins.equipamento_id]) latestByEq[ins.equipamento_id] = ins;
  }
  const latestList = Object.values(latestByEq);

  async function exportExcel() {
    const lib = await loadXLSX();
    const cols = ["Placa","Tipo","Data","Km","Condição","DE","DD","TEI","TEE","TDI","TDE","TEI1","TEE1","TDI1","TDE1","ESTEPE","Observações"];
    const rows = inspecoes.map(i => [
      i.equipamentos?.placa || "", i.equipamentos?.tipo || "",
      fmtDate(i.data_inspecao), i.km_atual ?? "", i.condicao,
      i.de ?? "", i.dd ?? "", i.tei ?? "", i.tee ?? "", i.tdi ?? "", i.tde ?? "",
      i.tei1 ?? "", i.tee1 ?? "", i.tdi1 ?? "", i.tde1 ?? "",
      i.estepe ?? "", (i as any).observacoes || ""
    ]);
    const ws = lib.utils.aoa_to_sheet([cols, ...rows]);
    const wb = lib.utils.book_new();
    lib.utils.book_append_sheet(wb, ws, "Inspeções de Pneus");
    lib.writeFile(wb, "Boletim_Pneus.xlsx");
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-5 max-w-[98rem] mx-auto w-full">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
            <Circle className="w-6 h-6 text-orange-500" fill="none" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Boletim de Pneus</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Controle e inspeção de pneus da frota</p>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
            <Download size={15} /> Exportar Excel
          </button>
          {!isVisitante ? (
            <>
              <button onClick={() => setShowImport(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
                <Upload size={15} /> Importar Arquivos
              </button>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors shadow-sm">
                <Plus size={15} /> Nova Inspeção
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <ShieldAlert size={15} />
              <span>Somente Leitura</span>
            </div>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {criticos.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-red-700 dark:text-red-400">
            <strong>Atenção!</strong> Existem pneus que precisam de atenção imediata:{" "}
            <strong>{criticos.length} em estado crítico</strong>.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {(["lista","historico","dashboard"] as Tab[]).map(t => {
          const label = t === "lista" ? "Lista de Inspeções" : t === "historico" ? "Histórico por Placa" : "Dashboard";
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-zinc-900 dark:border-zinc-100 text-zinc-900 dark:text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── DASHBOARD TAB ─── */}
      {tab === "dashboard" && (
        <div className="flex flex-col gap-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Bom", key: "BOM", icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, bg: "bg-emerald-50 dark:bg-emerald-900/20" },
              { label: "Regular", key: "REGULAR", icon: <Circle className="w-5 h-5 text-yellow-500" />, bg: "bg-yellow-50 dark:bg-yellow-900/20" },
              { label: "Crítico", key: "CRITICO", icon: <AlertTriangle className="w-5 h-5 text-orange-500" />, bg: "bg-orange-50 dark:bg-orange-900/20" },
              { label: "Trocar", key: "TROCAR", icon: <X className="w-5 h-5 text-red-500" />, bg: "bg-red-50 dark:bg-red-900/20" },
            ].map(({ label, key, icon, bg }) => (
              <div key={key} className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
                  <span className="text-sm text-zinc-500 font-medium">{label}</span>
                </div>
                <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{counts[key as keyof typeof counts]}</div>
                <div className="text-xs text-zinc-400 mt-1">{Math.round(counts[key as keyof typeof counts] / total * 100)}% do total</div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Distribuição de Condições</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine>
                      {pieData.map((entry) => <Cell key={entry.name} fill={COND_COLOR[entry.name === "Bom" ? "BOM" : entry.name === "Regular" ? "REGULAR" : entry.name === "Crítico" ? "CRITICO" : "TROCAR"]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [v, name]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-60 flex items-center justify-center text-zinc-400 text-sm">Sem dados de inspeção</div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Média de Sulco por Posição</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                    <XAxis dataKey="pos" tick={{ fontSize: 10, fill: "#71717a" }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(v: number) => [`${v}mm`, "Média"]} />
                    <Bar dataKey="media" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-60 flex items-center justify-center text-zinc-400 text-sm">Sem dados de posição</div>
              )}
            </div>
          </div>

          {/* Condição por Veículo table */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200">Condição por Veículo — Todas as Posições</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                    <th className="px-4 py-2 text-left font-semibold text-zinc-500 whitespace-nowrap">Placa</th>
                    <th className="px-4 py-2 text-left font-semibold text-zinc-500 whitespace-nowrap">Tipo</th>
                    <th className="px-4 py-2 text-left font-semibold text-zinc-500 whitespace-nowrap">Atual</th>
                    <th className="px-4 py-2 text-left font-semibold text-blue-500 whitespace-nowrap">Última Atualização</th>
                    <th className="px-1 py-2 text-center font-semibold text-zinc-400 whitespace-nowrap" colSpan={2}>DIANTEIRO</th>
                    <th className="px-1 py-2 text-center font-semibold text-zinc-400 whitespace-nowrap" colSpan={4}>1º EIXO</th>
                    <th className="px-1 py-2 text-center font-semibold text-zinc-400 whitespace-nowrap" colSpan={4}>2º EIXO</th>
                    <th className="px-2 py-2 text-center font-semibold text-zinc-400 whitespace-nowrap">ESTEPE</th>
                  </tr>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <th colSpan={4} />
                    {["DE","DD","TEI","TEE","TDI","TDE","TEI","TEE","TDI","TDE","ESTE"].map((l, i) => (
                      <th key={i} className="px-1 py-1.5 text-center text-[10px] font-semibold text-orange-500">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                  {latestList.length === 0 && (
                    <tr><td colSpan={15} className="px-4 py-12 text-center text-zinc-400">Nenhuma inspeção registrada</td></tr>
                  )}
                  {latestList.map(ins => {
                    const eq = equipamentos.find(e => e.id === ins.equipamento_id);
                    return (
                      <tr key={ins.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{ins.equipamentos?.placa || eq?.placa || "-"}</td>
                        <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap text-[11px]">{ins.equipamentos?.tipo || eq?.tipo || "-"}</td>
                        <td className="px-4 py-2.5 text-zinc-500 whitespace-nowrap">{ins.km_atual ? `${ins.km_atual}km` : "-"}</td>
                        <td className="px-4 py-2.5 text-blue-500 whitespace-nowrap">
                          {fmtDate(ins.data_inspecao)}
                        </td>
                        {(["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as Pos[]).map(pos => {
                          const v = ins[pos];
                          return (
                            <td key={pos} className="px-1 py-1.5 text-center">
                              {v != null ? (
                                <span className={`inline-flex items-center justify-center w-8 h-7 rounded text-[11px] font-semibold ${sulcoColor(v)}`}>{v}</span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-8 h-7 rounded text-[11px] text-zinc-300 dark:text-zinc-700 bg-zinc-50 dark:bg-zinc-900">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-[11px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" /> ≥ 10mm (Bom)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> 6-9mm (Atenção)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" /> 3-5mm (Crítico)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> &lt; 3mm (Trocar)</span>
            </div>
          </div>

          {criticos.length > 0 && (
            <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
              <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Veículos que Precisam de Atenção</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {criticos.map(ins => {
                  const eq = equipamentos.find(e => e.id === ins.equipamento_id);
                  const placa = ins.equipamentos?.placa || eq?.placa || "?";
                  return (
                    <div key={ins.id} className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl">
                      <div>
                        <div className="font-semibold text-zinc-800 dark:text-zinc-200">{placa}</div>
                        <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                          {ins.condicao === "TROCAR" ? "Pneu para trocar" : "Pneu(s) crítico(s)"}
                        </div>
                      </div>
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── LISTA TAB ─── */}
      {tab === "lista" && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
          {/* Top Actions */}
          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedIds.size > 0 && !isVisitante && (
                <button onClick={handleBatchDelete} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-md bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50 transition-colors">
                  <Trash2 size={14} /> Excluir {selectedIds.size} Selecionados
                </button>
              )}
            </div>
            <div className="text-xs text-zinc-400 font-medium">
              {inspecoes.length} Registro(s) Total
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" onChange={toggleSelectAll} checked={inspecoes.length > 0 && selectedIds.size === inspecoes.length} className="rounded border-zinc-300 dark:border-zinc-700" />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase">Placa</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase">Km</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase">Condição</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase">Obs</th>
                  {!isVisitante && <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-500 uppercase">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {inspecoes.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-zinc-400">Nenhuma inspeção registrada</td></tr>
                )}
                {inspecoes.map(ins => {
                  const eq = equipamentos.find(e => e.id === ins.equipamento_id);
                  return (
                    <tr key={ins.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(ins.id)} onChange={() => toggleSelect(ins.id)} className="rounded border-zinc-300 dark:border-zinc-700" />
                      </td>
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">{ins.equipamentos?.placa || eq?.placa || "-"}</td>
                      <td className="px-4 py-3 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                      <td className="px-4 py-3 text-zinc-500">{ins.km_atual ? `${ins.km_atual}km` : "-"}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 max-w-xs truncate">{(ins as any).observacoes || "-"}</td>
                      {!isVisitante && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setEditingItem(ins)} className="p-1.5 text-zinc-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded truncate transition-colors" title="Editar Inspeção">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(ins.id)} className="p-1.5 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded truncate transition-colors" title="Apagar Permanentemente">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── HISTÓRICO TAB ─── */}
      {tab === "historico" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {equipamentos.map(eq => {
            const ins = inspecoes.filter(i => i.equipamento_id === eq.id);
            if (!ins.length) return null;
            return (
              <div key={eq.id} className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
                <div className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{eq.placa}</div>
                <div className="text-xs text-zinc-400 mb-3">{ins.length} inspeção(ões)</div>
                <div className="flex flex-col gap-1.5">
                  {ins.slice(0, 5).map(i => (
                    <div key={i.id} className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">{fmtDate(i.data_inspecao)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${condBadge(i.condicao)}`}>{i.condicao}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && <NovaInspecaoModal equipamentos={equipamentos} onClose={() => setShowModal(false)} />}
      {editingItem && <NovaInspecaoModal equipamentos={equipamentos} item={editingItem} onClose={() => setEditingItem(null)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}

// ─── Input class ──────────────────────────────────────────────────────────────
const iCls = "w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-zinc-900 dark:text-zinc-100";

// ─── Nova Inspeção Modal ──────────────────────────────────────────────────────
const POSI_LABELS: [string, Pos][] = [
  ["DE", "de"], ["DD", "dd"],
  ["TEI", "tei"], ["TEE", "tee"],
  ["TDI", "tdi"], ["TDE", "tde"],
  ["TEI1", "tei1"], ["TEE1", "tee1"],
  ["TDI1", "tdi1"], ["TDE1", "tde1"],
  ["ESTEPE", "estepe"],
];

function NovaInspecaoModal({ equipamentos, item, onClose }: { equipamentos: Equipamento[]; item?: Inspecao; onClose: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = item ? await atualizarInspecao(item.id, fd) : await registrarInspecaoCompleta(fd);
    if (res?.error) alert("Erro: " + res.error);
    else onClose();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item ? "Editar Inspeção" : "Nova Inspeção de Pneu"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Placa *</label>
              <select name="equipamento_id" required defaultValue={item?.equipamento_id || ""} className={iCls}>
                <option value="">Selecione</option>
                {equipamentos.map(eq => <option key={eq.id} value={eq.id}>{eq.placa}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Data *</label>
              <input name="data_inspecao" type="date" required defaultValue={item?.data_inspecao || new Date(Date.now() - 3 * 3600 * 1000).toISOString().split("T")[0]} className={iCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Km</label>
              <input name="km_atual" type="number" step="1" defaultValue={item?.km_atual ?? 0} className={iCls} />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3 block">Posição do Pneu * (Deixe em branco se não aplicável)</label>
            <div className="grid grid-cols-2 gap-3">
              {POSI_LABELS.map(([label, key]) => (
                <div key={key} className={`flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 ${key === "estepe" ? "col-span-2" : ""}`}>
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 w-12 shrink-0">{label}</span>
                  <input name={key} type="number" step="0.1" min="0" defaultValue={item ? (item[key] ?? "") : ""} placeholder="Sulco (mm)" className="flex-1 bg-transparent text-sm outline-none text-zinc-800 dark:text-zinc-200 placeholder-zinc-400" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Condição</label>
            <select name="condicao" defaultValue={item?.condicao || "BOM"} className={iCls}>
              <option value="BOM">BOM</option>
              <option value="REGULAR">REGULAR</option>
              <option value="CRITICO">CRÍTICO</option>
              <option value="TROCAR">TROCAR</option>
            </select>
            <span className="text-[10px] text-zinc-400 italic">Será gerado auto caso dependa da posição editada.</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Observações</label>
            <textarea name="observacoes" rows={3} defaultValue={(item as any)?.observacoes || ""} placeholder="Observações sobre o pneu..." className={`${iCls} resize-none`} />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50 transition-colors shadow-sm">
              {loading ? "Salvando..." : (item ? "Salvar Alterações" : "Cadastrar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Import Modal — Multi-format ──────────────────────────────────────────────
// Supports: .xlsx, .xls, .ods (via SheetJS CDN) + .csv, .txt, .tsv (native)

type PreviewRow = {
  placa: string; data_inspecao: string; km_atual: number | null;
  de: number | null; dd: number | null;
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null;
  estepe: number | null; condicao: string; observacoes: string;
  _ok: boolean; _err?: string;
};

const COL_ALIASES: Record<string, string> = {
  placa: "placa", "placa/frota": "placa", fleet: "placa", plate: "placa",
  data: "data_inspecao", "data inspecao": "data_inspecao", "data inspeção": "data_inspecao",
  "data da inspeção": "data_inspecao", date: "data_inspecao",
  km: "km_atual", "km atual": "km_atual", quilometragem: "km_atual", odometer: "km_atual",
  de: "de", dd: "dd",
  tei: "tei", tee: "tee", tdi: "tdi", tde: "tde",
  tei1: "tei1", tee1: "tee1", tdi1: "tdi1", tde1: "tde1",
  estepe: "estepe", step: "estepe", spare: "estepe",
  condicao: "condicao", "condição": "condicao", condition: "condicao", cond: "condicao",
  observacoes: "observacoes", "observações": "observacoes", obs: "observacoes",
  observations: "observacoes", notes: "observacoes",
};

function normalizeKey(k: string) {
  return k.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}

function parseNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function excelDateToISO(serial: number): string {
  const date = new Date(Math.round((serial - 25569) * 864e5));
  return date.toISOString().split("T")[0];
}

function normalizeDate(v: unknown): string {
  if (v == null || v === "") return "";
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) return excelDateToISO(parseInt(s));
  const dmY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2,"0")}-${dmY[1].padStart(2,"0")}`;
  const mdY = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (mdY) return `${mdY[3]}-${mdY[1].padStart(2,"0")}-${mdY[2].padStart(2,"0")}`;
  const dMY = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dMY) return `${dMY[3]}-${dMY[2].padStart(2,"0")}-${dMY[1].padStart(2,"0")}`;
  return s;
}

function rowsFromMatrix(matrix: string[][]): PreviewRow[] {
  if (!matrix.length) return [];
  const firstCell = normalizeKey(matrix[0][0] || "");
  const hasHeader = isNaN(parseFloat(firstCell)) && firstCell.length > 0;
  let headers: string[];
  let dataRows: string[][];
  if (hasHeader) {
    headers = matrix[0].map(h => { const n = normalizeKey(h); return COL_ALIASES[n] || n; });
    dataRows = matrix.slice(1);
  } else {
    headers = ["placa","data_inspecao","km_atual","de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe","condicao","observacoes"];
    dataRows = matrix;
  }
  return dataRows.filter(r => r.some(c => String(c ?? "").trim())).map(row => {
    const get = (key: string) => { const idx = headers.indexOf(key); return idx >= 0 ? (row[idx] ?? "") : ""; };
    const placa = String(get("placa")).trim().toUpperCase();
    const data_inspecao = normalizeDate(get("data_inspecao"));
    const ok = !!placa && !!data_inspecao;
    return {
      placa, data_inspecao, km_atual: parseNum(get("km_atual")),
      de: parseNum(get("de")), dd: parseNum(get("dd")),
      tei: parseNum(get("tei")), tee: parseNum(get("tee")),
      tdi: parseNum(get("tdi")), tde: parseNum(get("tde")),
      tei1: parseNum(get("tei1")), tee1: parseNum(get("tee1")),
      tdi1: parseNum(get("tdi1")), tde1: parseNum(get("tde1")),
      estepe: parseNum(get("estepe")),
      condicao: String(get("condicao")).trim().toUpperCase() || "",
      observacoes: String(get("observacoes")).trim(),
      _ok: ok,
      _err: !ok ? (!placa ? "Placa ausente" : "Data ausente") : undefined,
    };
  });
}

function parseCSVText(text: string): PreviewRow[] {
  const sample = text.split("\n")[0] || "";
  const delim = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const matrix = lines.map(l => l.split(delim).map(c => c.trim().replace(/^"|"$/g, "")));
  return rowsFromMatrix(matrix);
}

// SheetJS loaded from CDN once
let XLSXLib: any = null;
async function loadXLSX() {
  if (XLSXLib) return XLSXLib;
  return new Promise<any>((resolve, reject) => {
    if ((window as any).XLSX) { XLSXLib = (window as any).XLSX; resolve(XLSXLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    s.onload = () => { XLSXLib = (window as any).XLSX; resolve(XLSXLib); };
    s.onerror = () => reject(new Error("Falha ao carregar biblioteca Excel. Verifique sua conexão."));
    document.head.appendChild(s);
  });
}

async function parseExcel(buffer: ArrayBuffer): Promise<PreviewRow[]> {
  const lib = await loadXLSX();
  const wb = lib.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa: string[][] = lib.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
  return rowsFromMatrix(aoa);
}

function fileIcon(ext: string) {
  if (ext === "xlsx" || ext === "xls") return "📊";
  if (ext === "csv") return "📋";
  return "📄";
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [fileName, setFileName] = useState("");
  const [fileExt, setFileExt] = useState("");
  const [result, setResult] = useState<{ importados?: number; erros?: string[]; error?: string; success?: boolean } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Pré-carrega SheetJS assim que o modal abre
  React.useEffect(() => { loadXLSX().catch(() => {}); }, []);

  async function processFile(file: File) {
    setParsing(true);
    setResult(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    setFileName(file.name);
    setFileExt(ext);
    try {
      let parsed: PreviewRow[];
      if (ext === "xlsx" || ext === "xls" || ext === "ods") {
        const buf = await file.arrayBuffer();
        parsed = await parseExcel(buf);
      } else {
        const text = await file.text();
        parsed = parseCSVText(text);
      }
      setRows(parsed);
    } catch (err) {
      setResult({ error: `Erro ao ler o arquivo: ${(err as Error).message}` });
    }
    setParsing(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function handleImport() {
    const valid = rows.filter(r => r._ok);
    if (!valid.length) return;
    setLoading(true);
    setProgress(10);

    // Simula progresso enquanto aguarda o servidor
    const progressTimer = setInterval(() => {
      setProgress(p => (p < 85 ? p + 5 : p));
    }, 400);

    const res = await importarInspecoesPneus(valid);

    clearInterval(progressTimer);
    setProgress(100);
    setResult(res as any);
    setLoading(false);
    if (res.success) setTimeout(onClose, 2000);
  }

  function downloadTemplate() {
    const header = "Placa;Data;Km;DE;DD;TEI;TEE;TDI;TDE;TEI1;TEE1;TDI1;TDE1;ESTEPE;Condicao;Observacoes";
    const ex1 = "ABC1234;2026-02-01;15000;11;12;10;11;12;11;10;11;10;11;12;BOM;Tudo ok";
    const ex2 = "XYZ9876;2026-02-15;67000;8;9;7;8;6;7;8;9;7;8;11;REGULAR;Verificar TDI";
    const csv = [header, ex1, ex2].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "modelo_importacao_pneus.csv";
    a.click();
  }

  const validRows = rows.filter(r => r._ok);
  const invalidRows = rows.filter(r => !r._ok);
  const POSITIONS = ["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-5xl shadow-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex justify-between items-start mb-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Importar Inspeções de Pneus</h2>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {["xlsx","xls","csv","txt","tsv"].map(f => (
                <span key={f} className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${fileExt === f ? "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400" : "bg-zinc-100 border-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:border-zinc-700"}`}>
                  .{f}
                </span>
              ))}
              <span className="text-[10px] text-zinc-400 self-center ml-1">suportados</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Drop zone */}
        <div className="shrink-0 mb-3">
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? "border-orange-400 bg-orange-50 dark:bg-orange-950/20"
              : rows.length > 0 ? "border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10"
              : "border-zinc-300 dark:border-zinc-700 hover:border-orange-400 hover:bg-orange-50/50 dark:hover:bg-orange-950/10"
            }`}
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-zinc-500">Lendo arquivo...</p>
              </div>
            ) : rows.length > 0 ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{fileIcon(fileExt)}</span>
                <div className="text-left">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{fileName}</p>
                  <p className="text-xs text-zinc-400">{rows.length} linhas detectadas — clique para trocar</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-7 h-7 text-zinc-400" />
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Clique ou arraste seu arquivo aqui</p>
                <p className="text-xs text-zinc-400">Excel (.xlsx, .xls) · CSV · TXT · TSV</p>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv,.ods" className="sr-only" onChange={handleFile} />
          </div>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-zinc-400">
              Colunas: <code className="bg-zinc-100 dark:bg-zinc-900 px-1 rounded">Placa · Data · Km · DE · DD · TEI · TEE · TDI · TDE · TEI1 · TEE1 · TDI1 · TDE1 · ESTEPE · Condição · Obs</code>
            </p>
            <button onClick={downloadTemplate} className="text-xs text-blue-500 hover:text-blue-700 underline shrink-0 ml-3">
              ⬇ Baixar modelo CSV
            </button>
          </div>
        </div>

        {/* Badges */}
        {rows.length > 0 && (
          <div className="flex items-center gap-3 mb-3 shrink-0">
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
              ✓ {validRows.length} prontas
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-full text-xs font-semibold border border-red-200 dark:border-red-800">
                ✗ {invalidRows.length} com erro
              </span>
            )}
            <span className="text-xs text-zinc-400">Arquivo: <strong>{fileExt.toUpperCase()}</strong></span>
          </div>
        )}

        {/* Preview table */}
        {rows.length > 0 && (
          <div className="flex-1 overflow-auto mb-3 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                  {["#","Placa","Data","Km","DE","DD","TEI","TEE","TDI","TDE","TEI1","TEE1","TDI1","TDE1","ESTE","Cond.","Status"].map(h => (
                    <th key={h} className="px-2 py-2 text-center font-semibold text-zinc-500 whitespace-nowrap first:text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {rows.map((row, i) => (
                  <tr key={i} className={`transition-colors ${row._ok ? "hover:bg-zinc-50 dark:hover:bg-zinc-900/40" : "bg-red-50 dark:bg-red-950/10"}`}>
                    <td className="px-2 py-1.5 text-zinc-400 text-left">{i + 1}</td>
                    <td className="px-2 py-1.5 font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{row.placa || "—"}</td>
                    <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{row.data_inspecao || "—"}</td>
                    <td className="px-2 py-1.5 text-zinc-500 text-center">{row.km_atual ?? "—"}</td>
                    {POSITIONS.map(p => (
                      <td key={p} className="px-1 py-1.5 text-center">
                        {row[p] != null ? (
                          <span className={`inline-flex items-center justify-center w-7 h-6 rounded text-[10px] font-semibold ${sulcoColor(row[p])}`}>{row[p]}</span>
                        ) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-zinc-500 text-center whitespace-nowrap">{row.condicao || "AUTO"}</td>
                    <td className="px-2 py-1.5 text-center">
                      {row._ok
                        ? <span className="text-emerald-500 font-bold text-sm">✓</span>
                        : <span className="text-red-500 text-[10px] font-medium">{row._err}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="shrink-0 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-zinc-500">Importando {rows.filter(r => r._ok).length} inspeções...</span>
              <span className="text-xs font-semibold text-orange-500">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <div className={`shrink-0 mb-3 px-4 py-3 rounded-lg text-sm font-medium border ${
            result.error
              ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
              : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
          }`}>
            {result.error
              ? `❌ ${result.error}`
              : `✅ ${result.importados} inspeção(ões) importada(s) com sucesso!${result.erros?.length ? ` (${result.erros.length} linha(s) ignorada(s))` : ""}`
            }
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 flex justify-between items-center pt-3 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-400">
            {rows.length > 0 ? `${validRows.length} de ${rows.length} linhas prontas para importar` : "Selecione um arquivo para começar"}
          </p>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleImport}
              disabled={loading || parsing || validRows.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 transition-colors shadow-sm"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importando...</>
              ) : (
                <><Upload size={14} /> Importar {validRows.length} linha(s)</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
