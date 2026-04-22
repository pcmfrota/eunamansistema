"use client";

import { useState, useEffect, useTransition } from "react";
import { Download, Plus, Search, Pencil, Trash2, X, Check, Lock, BarChart2, List, FileText } from "lucide-react";
import {
  criarOrdemServico,
  atualizarStatusOS,
  atualizarOrdemServico,
  excluirOrdemServico,
  excluirOrdensMassivo,
  importarOrdensServico
} from "./actions";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";
import OSFormModal from "./NovoModal";
import OSDashboard from "./OSDashboard";
import OSFichaModal, { type OSFichaData } from "./OSFicha";
import { PremiumLoader } from "@/components/premium-loader";
import React from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type OS = {
  id: string;
  numero_os: string;
  placa: string | null;
  modulo: string | null;
  status: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  horas_manutencao: number | null;
  descricao: string | null;
  horimetro: number | null;
  operacao_tipo: string | null;
  local: string | null;
  classe: string | null;
  foi_enviado_reserva: boolean | null;
  motivo: string | null;
  sistema: string | null;
  sub_sistema: string | null;
  componente: string | null;
  observacoes: string | null;
  horario_parada: string | null;
  equipamento_id: string;
};

type Equipamento = {
  id: string;
  placa: string;
  modulo?: string;
  ultimoHist?: number;
};

type CatalogoItem = {
  id: number;
  sistema: string;
  sistema_codigo: number;
  subsistema: string;
  subsistema_codigo: number;
  componente: string;
  componente_codigo: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmt(dateStr: string | null) {
  if (!dateStr) return "-";
  const cleanStr = dateStr.slice(0, 16);
  if (!cleanStr.includes('T')) return dateStr;
  const [datePart, timePart] = cleanStr.split('T');
  if (!datePart || !timePart) return dateStr;
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y} ${timePart}`;
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status || "Aberta";
  if (s === "Fechada" || s === "Concluída")
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">Fechada</span>;
  if (s === "Em Andamento")
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">Em Andamento</span>;
  return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">Aberta</span>;
}

function calcularHorasOS(o: OS) {
  if (o.horas_manutencao != null && o.horas_manutencao > 0) return o.horas_manutencao;
  const startStr = o.horario_parada || o.data_abertura;
  if (!startStr) return 0;
  
  const dInicio = new Date(startStr);
  const dFim = o.data_fechamento ? new Date(o.data_fechamento) : new Date();
  
  if (isNaN(dInicio.getTime()) || isNaN(dFim.getTime())) return 0;

  const diff = Math.max(0, (dFim.getTime() - dInicio.getTime()) / 3600000);
  return Math.round(diff * 10) / 10;
}

function calcularHorasNoPeriodo(o: OS, inicioPeriodo: Date, fimPeriodo: Date) {
  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);

  const inicioOS = new Date(o.horario_parada || o.data_abertura);
  const fimOS = o.data_fechamento ? new Date(o.data_fechamento) : agora;
  
  // Limita o fim do período ao D-1 se for o período atual
  const fimP = fimPeriodo > ontem ? ontem : fimPeriodo;

  const interInicio = inicioOS > inicioPeriodo ? inicioOS : inicioPeriodo;
  const interFim = fimOS < fimP ? fimOS : fimP;
  
  const ms = interFim.getTime() - interInicio.getTime();
  return ms > 0 ? Math.round((ms / 3600000) * 10) / 10 : 0;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ControleOSClient({
  ordens: initialOrdens,
  equipamentos,
  operacoesTipo = [],
  motivos = [],
  catalogo = [],
  periodos = [],
}: {
  ordens: OS[];
  equipamentos: Equipamento[];
  operacoesTipo?: string[];
  motivos?: string[];
  catalogo?: CatalogoItem[];
  periodos?: any[];
}) {
  const [ordens, setOrdens] = useState(initialOrdens);
  const [activeTab, setActiveTab] = useState<"dashboard" | "lista">("lista");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos Status");
  const [filtroModulo, setFiltroModulo] = useState("Todos Módulos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("Todos Períodos");
  const [filtroOrdem, setFiltroOrdem] = useState("Mais Recente");
  const [showModal, setShowModal] = useState(false);
  const [editingOS, setEditingOS] = useState<OS | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fichaOS, setFichaOS] = useState<OSFichaData | null>(null);
  const [isPending, startTransition] = useTransition();
  const { profile } = useAuth();

  const isVisitante = profile?.role === "visitante";

  // Abre OS direto via ?abrir=ID (vindo do dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const abrirId = params.get("abrir");
    if (abrirId) {
      const os = initialOrdens.find(o => o.id === abrirId);
      if (os) {
        setEditingOS(os);
        setShowModal(true);
      }
    }
  }, [initialOrdens]);

  // Update when server data changes
  useEffect(() => { setOrdens(initialOrdens); }, [initialOrdens]);

  // Derived lists for filter dropdowns
  const modulos = React.useMemo(() => 
    ["Todos Módulos", ...Array.from(new Set(ordens.map(o => o.modulo).filter(Boolean)))],
    [ordens]
  );

  // Filter + sort - MEMOIZED for performance
  const filtradas = React.useMemo(() => {
    return ordens
      .filter(o => {
        const q = busca.toLowerCase();
        const matchBusca = !q || o.numero_os.toLowerCase().includes(q) || (o.placa || "").toLowerCase().includes(q);
        const matchStatus = filtroStatus === "Todos Status" || o.status === filtroStatus;
        const matchModulo = filtroModulo === "Todos Módulos" || o.modulo === filtroModulo;
        
        let matchPeriodo = true;
        if (filtroPeriodo !== "Todos Períodos" && periodos.length > 0) {
          const p = periodos.find(per => `${per.mes}-${per.ano}` === filtroPeriodo);
          if (p) {
            const inicio = new Date(p.data_inicio + "T00:00:00");
            const fim = new Date(p.data_fim + "T23:59:59");
            
            const dAb = new Date(o.horario_parada || o.data_abertura);
            const dFech = o.data_fechamento ? new Date(o.data_fechamento) : null;
            
            matchPeriodo = dAb <= fim && (dFech == null || dFech >= inicio);
          }
        }

        return matchBusca && matchStatus && matchModulo && matchPeriodo;
      })
      .sort((a, b) => {
        if (filtroOrdem === "Mais Recente") return new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime();
        if (filtroOrdem === "Mais Antiga") return new Date(a.data_abertura).getTime() - new Date(b.data_abertura).getTime();
        return 0;
      });
  }, [ordens, busca, filtroStatus, filtroModulo, filtroPeriodo, filtroOrdem, periodos]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtradas.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtradas.map(o => o.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleExcluirSelecionados = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Tem certeza que deseja apagar ${selectedIds.size} chamados?`)) {
      startTransition(async () => {
        const res = await excluirOrdensMassivo(Array.from(selectedIds));
        if (res && 'error' in res) {
          alert(`Erro: ${res.error}`);
        } else {
          setSelectedIds(new Set());
        }
      });
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
      document.body.appendChild(script);
    }
  }, []);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      alert("Carregando motor Excel, tente novamente em alguns segundos...");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      startTransition(async () => {
        const res = await importarOrdensServico(data);
        if (res && 'error' in res) {
          alert("Erro ao importar: " + res.error);
        } else if (res && 'count' in res) {
          const r = res as any;
          let msg = `✅ Importação concluída!\n\n📋 ${r.count} OS importadas com sucesso.`;
          if (r.semCadastro > 0) {
            msg += `\n\n⚠️ ${r.semCadastro} OS com placas não cadastradas na Base de Frotas.\n`;
            msg += `Essas OS ficam ocultas na lista, mas são contabilizadas no Dashboard.\n\n`;
            msg += `Placas: ${r.placasNaoCadastradas.slice(0, 10).join(', ')}${r.placasNaoCadastradas.length > 10 ? '...' : ''}`;
          }
          alert(msg);
        }
      });
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  function exportarExcel() {
    const XLSX = (window as any).XLSX;
    if (!XLSX) { alert("Motor Excel carregando..."); return; }
    const pFiltro = periodos.find(per => `${per.mes}-${per.ano}` === filtroPeriodo);
    const iniP = pFiltro ? new Date(pFiltro.data_inicio + "T00:00:00") : null;
    const fimP = pFiltro ? new Date(pFiltro.data_fim + "T23:59:59") : null;

    const rows = filtradas.map(o => {
      const hCalc = calcularHorasOS(o);
      const hNoPeriodo = (iniP && fimP) ? calcularHorasNoPeriodo(o, iniP, fimP) : hCalc;
      
      return {
        "Nº OS": o.numero_os, "Placa": o.placa || "", "Módulo": o.modulo || "",
        "Status": o.status || "", "Abertura": fmt(o.data_abertura), "Fechamento": fmt(o.data_fechamento),
        "Horas Totais": hCalc > 0 ? hCalc : "", 
        "Horas no Período": hNoPeriodo > 0 ? hNoPeriodo : "",
        "Descrição": o.descricao || "", "Motivo": o.motivo || "",
        "Sistema": o.sistema || "", "Sub-Sistema": o.sub_sistema || "", "Operação (Tipo)": o.operacao_tipo || "",
        "Local": o.local || "", "Classe": o.classe || "", "Reserva": o.foi_enviado_reserva ? "SIM" : "NÃO",
        "Horímetro": o.horimetro ?? "", "Observações": o.observacoes || ""
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OrdensServico");
    XLSX.writeFile(workbook, "ordens_servico.xlsx");
  }

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full bg-zinc-50 dark:bg-zinc-950 min-h-screen">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Controle de OS</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Gerenciar ordens de serviço de manutenção</p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* ── Tab Switcher ── */}
          <div className="flex rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "dashboard"
                  ? "bg-green-600 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <BarChart2 size={15} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab("lista")}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === "lista"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <List size={15} /> Lista de OS
            </button>
          </div>

          {/* ── Action buttons — só na aba Lista ── */}
          {activeTab === "lista" && (
            <>
              {selectedIds.size > 0 && !isVisitante && (
                <button onClick={handleExcluirSelecionados} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm">
                  <Trash2 size={16} /> Apagar Selecionados ({selectedIds.size})
                </button>
              )}
              {!isVisitante && (
                <label className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm",
                  isPending ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                )}>
                  <input 
                    type="file" 
                    accept=".xlsx,.csv" 
                    className="hidden" 
                    onChange={handleImportExcel} 
                    disabled={isPending}
                  />
                  {isPending ? (
                    <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download size={15} className="rotate-180" />
                  )}
                  {isPending ? "Importando..." : "Importar"}
                </label>
              )}
              <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">
                <Download size={15} /> Exportar Excel
              </button>
              {!isVisitante ? (
                <button onClick={() => { setEditingOS(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
                  <Plus size={15} /> Nova OS
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-700">
                  <Lock size={14} /> Somente Leitura
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ══ DASHBOARD TAB ══ */}
      {activeTab === "dashboard" && (
        <OSDashboard ordens={ordens} />
      )}

      {/* ══ LISTA TAB ══ */}
      {activeTab === "lista" && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {/* Filtros da tabela */}
          <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Ordens de Serviço</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={15} />
                <input
                  type="text"
                  placeholder="Buscar por OS ou placa..."
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all font-bold"
                />
              </div>
              {(busca || filtroStatus !== "Todos Status" || filtroModulo !== "Todos Módulos" || filtroPeriodo !== "Todos Períodos") && (
                <button
                  onClick={() => { 
                    setBusca(""); 
                    setFiltroStatus("Todos Status"); 
                    setFiltroModulo("Todos Módulos"); 
                    setFiltroPeriodo("Todos Períodos");
                  }}
                  className="px-3 py-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-all"
                >
                  Limpar Filtros
                </button>
              )}
              <select 
                value={filtroPeriodo} 
                onChange={e => setFiltroPeriodo(e.target.value)} 
                className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option>Todos Períodos</option>
                {periodos.map(p => {
                  const label = `${["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][(p.mes-1)%12]}/${p.ano}`;
                  return (
                    <option key={`${p.mes}-${p.ano}`} value={`${p.mes}-${p.ano}`}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30">
                <option>Todos Status</option>
                <option>Aberta</option>
                <option>Em Andamento</option>
                <option>Fechada</option>
              </select>
              <select value={filtroModulo} onChange={e => setFiltroModulo(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30">
                {modulos.map(m => <option key={m}>{m}</option>)}
              </select>
              <select value={filtroOrdem} onChange={e => setFiltroOrdem(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30">
                <option>Mais Recente</option>
                <option>Mais Antiga</option>
              </select>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="w-10 px-4 py-3 text-left">
                    <input type="checkbox" checked={filtradas.length > 0 && selectedIds.size === filtradas.length} onChange={toggleSelectAll} className="rounded border-zinc-300" />
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Nº OS</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Placa</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Módulo</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Abertura</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Fechamento</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Horas</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {isPending ? (
                  <tr>
                    <td colSpan={10} className="py-20 text-center">
                      <PremiumLoader type="squares-sequential" text="Processando Dados" subtext="Sincronizando com servidor..." />
                    </td>
                  </tr>
                ) : filtradas.map(os => (
                  <tr key={os.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selectedIds.has(os.id)} onChange={() => toggleSelect(os.id)} className="rounded border-zinc-300" />
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{os.numero_os}</td>
                    <td className="px-4 py-3 font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">{os.placa || "-"}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 whitespace-nowrap">{os.modulo || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={os.status} /></td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap text-[12px]">{fmt(os.data_abertura)}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-nowrap text-[12px]">{fmt(os.data_fechamento)}</td>
                    <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300 font-medium whitespace-nowrap">
                      {(() => {
                        const pF = periodos.find(per => `${per.mes}-${per.ano}` === filtroPeriodo);
                        if (pF) {
                          const h = calcularHorasNoPeriodo(os, new Date(pF.data_inicio + "T00:00:00"), new Date(pF.data_fim + "T23:59:59"));
                          return h > 0 ? `${h}h` : "-";
                        }
                        const h = calcularHorasOS(os);
                        return h > 0 ? `${h}h` : "-";
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        {/* Botão Ver Ficha — aparece para OS fechadas, disponível para todos */}
                        {(os.status === "Fechada" || os.status === "Concluída") && (
                          <button
                            title="Ver Ficha da O.S"
                            onClick={() => setFichaOS(os as unknown as OSFichaData)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 transition-all shadow-sm"
                          >
                            <FileText size={13} />
                            Ficha
                          </button>
                        )}
                        {!isVisitante && (
                          <>
                            {os.status === "Aberta" && (
                              <button title="Iniciar OS" onClick={() => startTransition(async () => { const res = await atualizarStatusOS(os.id, "Em Andamento"); if (res && 'error' in res) alert(res.error); })} className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                <Check size={14} />
                              </button>
                            )}
                            {os.status === "Em Andamento" && (
                              <button title="Fechar OS" onClick={() => startTransition(async () => { const res = await atualizarStatusOS(os.id, "Fechada"); if (res && 'error' in res) alert(res.error); })} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                                <Check size={14} />
                              </button>
                            )}
                            <button title="Editar" onClick={() => { setEditingOS(os); setShowModal(true); }} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                              <Pencil size={14} />
                            </button>
                            <button title="Excluir" onClick={() => setDeletingId(os.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                        {isVisitante && !(os.status === "Fechada" || os.status === "Concluída") && (
                          <span className="text-[10px] text-zinc-400 italic">Visualização</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!isPending && filtradas.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhuma OS encontrada</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            {filtradas.length} ordem(s) de serviço
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deletingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Excluir OS?</h3>
            <p className="text-sm text-zinc-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => {
                  startTransition(async () => {
                    if (deletingId) {
                      const res = await excluirOrdemServico(deletingId);
                      if (res && 'error' in res) alert(res.error);
                    }
                    setDeletingId(null);
                  });
                }}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New/Edit OS Modal ── */}
      {showModal && (
        <OSFormModal
          equipamentos={equipamentos}
          initialData={editingOS}
          onClose={() => { setShowModal(false); setEditingOS(null); }}
          operacoesTipo={operacoesTipo}
          motivos={motivos}
          catalogo={catalogo}
        />
      )}

      {/* ── Ficha Impressão Modal ── */}
      {fichaOS && (
        <OSFichaModal
          os={fichaOS}
          onClose={() => setFichaOS(null)}
        />
      )}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 text-zinc-900 dark:text-zinc-100";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
