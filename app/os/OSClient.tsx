"use client";

import { useState, useEffect, useTransition } from "react";
import { Download, Plus, Search, Pencil, Trash2, X, Check, Lock, BarChart2, List, FileText, Printer } from "lucide-react";
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
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { RefreshCw } from "lucide-react";
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
  assinatura_mecanico?: string | null;
  fotos?: string[] | null;
};

type Equipamento = {
  id: string;
  placa: string;
  modulo?: string;
  area?: string;
  ultimoHist?: number;
  categoria?: string;
  status?: string;
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
  
  // Regra D-1: se a OS estiver aberta, conta apenas até ontem
  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);

  const dFim = o.data_fechamento ? new Date(o.data_fechamento) : ontem;
  
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
  // Se aberta, limita a ontem (D-1)
  const fimOS = o.data_fechamento ? new Date(o.data_fechamento) : ontem;
  
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
  initialBacklogs = [],
  initialColaboradores = [],
}: {
  ordens: OS[];
  equipamentos: Equipamento[];
  operacoesTipo?: string[];
  motivos?: string[];
  catalogo?: CatalogoItem[];
  periodos?: any[];
  initialBacklogs?: any[];
  initialColaboradores?: any[];
}) {
  const { isOnline } = useOffline();
  const [ordens, setOrdens] = useState(initialOrdens);
  const [backlogs, setBacklogs] = useState<any[]>(initialBacklogs);
  const [colaboradores, setColaboradores] = useState<any[]>(initialColaboradores);

  // Sync cache with initialOrdens from server when online
  useEffect(() => {
    if (isOnline && initialOrdens && initialOrdens.length > 0) {
      localDb.saveMany("ordens_servico", initialOrdens);
    }
  }, [isOnline, initialOrdens]);

  // Sync backlog cache with initialBacklogs from server when online
  useEffect(() => {
    if (isOnline && initialBacklogs && initialBacklogs.length > 0) {
      localDb.saveMany("backlog", initialBacklogs).catch(err => console.error("Erro ao salvar backlogs:", err));
    }
  }, [isOnline, initialBacklogs]);

  // Sync colaboradores cache with initialColaboradores from server when online
  useEffect(() => {
    if (isOnline && initialColaboradores && initialColaboradores.length > 0) {
      localDb.saveMany("colaboradores", initialColaboradores).catch(err => console.error("Erro ao salvar colaboradores:", err));
    }
  }, [isOnline, initialColaboradores]);

  // Load from local DB dynamically
  useEffect(() => {
    let active = true;
    const loadFromDb = async () => {
      const data = await localDb.getAll("ordens_servico");
      if (active) {
        data.sort((a, b) => new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime());
        setOrdens(data);
      }
    };
    loadFromDb();

    window.addEventListener("offline-db-updated-ordens_servico", loadFromDb);
    window.addEventListener("offline-sync-completed", loadFromDb);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-ordens_servico", loadFromDb);
      window.removeEventListener("offline-sync-completed", loadFromDb);
    };
  }, []);

  // Load backlogs from local DB dynamically
  useEffect(() => {
    let active = true;
    const loadBacklogs = async () => {
      try {
        const data = await localDb.getAll("backlog");
        if (active) {
          setBacklogs(data);
        }
      } catch (err) {
        console.error("Erro ao carregar backlogs locais:", err);
      }
    };
    loadBacklogs();

    window.addEventListener("offline-db-updated-backlog", loadBacklogs);
    window.addEventListener("offline-sync-completed", loadBacklogs);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-backlog", loadBacklogs);
      window.removeEventListener("offline-sync-completed", loadBacklogs);
    };
  }, []);

  // Load colaboradores from local DB dynamically
  useEffect(() => {
    let active = true;
    const loadColaboradores = async () => {
      try {
        const data = await localDb.getAll("colaboradores");
        if (active) {
          data.sort((a, b) => a.nome.localeCompare(b.nome));
          setColaboradores(data);
        }
      } catch (err) {
        console.error("Erro ao carregar colaboradores locais:", err);
      }
    };
    loadColaboradores();

    window.addEventListener("offline-db-updated-colaboradores", loadColaboradores);
    window.addEventListener("offline-sync-completed", loadColaboradores);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-colaboradores", loadColaboradores);
      window.removeEventListener("offline-sync-completed", loadColaboradores);
    };
  }, []);

  const [activeTab, setActiveTab] = useState<"dashboard" | "lista">("lista");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("Todos Status");
  const [filtroModulo, setFiltroModulo] = useState("Todos Módulos");
  const [filtroArea, setFiltroArea] = useState("Todas as Áreas");
  const [filtroPeriodo, setFiltroPeriodo] = useState("Todos Períodos");
  const [filtroOrdem, setFiltroOrdem] = useState("Mais Recente");
  const [showModal, setShowModal] = useState(false);
  const [editingOS, setEditingOS] = useState<OS | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fichaOS, setFichaOS] = useState<OSFichaData | null>(null);
  const [selectedOSActions, setSelectedOSActions] = useState<OS | null>(null);
  const [pdfAction, setPdfAction] = useState<'download' | 'share' | 'print' | null>(null);
  const [exportingOS, setExportingOS] = useState<OS | null>(null);
  const [isPending, startTransition] = useTransition();
  const { profile } = useAuth();

  const isVisitante = profile?.role === "visitante";

  // Abre OS direto via ?abrir=ID (vindo do dashboard) ou aplica filtros/modos vindos do portal
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

    const isNew = params.get("new") === "true";
    if (isNew) {
      setEditingOS(null);
      setShowModal(true);
    }

    const statusParam = params.get("status");
    if (statusParam) {
      if (statusParam.toLowerCase() === "aberta") {
        setFiltroStatus("Aberta");
        setActiveTab("lista");
      } else if (statusParam.toLowerCase() === "andamento") {
        setFiltroStatus("Em Andamento");
        setActiveTab("lista");
      } else if (statusParam.toLowerCase() === "fechada") {
        setFiltroStatus("Fechada");
        setActiveTab("lista");
      }
    }

    const tabParam = params.get("tab");
    if (tabParam === "dashboard") {
      setActiveTab("dashboard");
    } else if (tabParam === "lista") {
      setActiveTab("lista");
    }
  }, [initialOrdens]);

  // Update when server data changes
  useEffect(() => { setOrdens(initialOrdens); }, [initialOrdens]);

  // Derived lists for filter dropdowns
  const modulos = React.useMemo(() => 
    [
      "Todos Módulos",
      "MÓDULO 5",
      "MÓDULO 2",
      "MÓDULO 7",
      "CARREGAMENTO",
      "RESERVA",
      "MALHA VIÁRIA"
    ],
    []
  );

  const areasOptions = React.useMemo(() => {
    const s = new Set<string>();
    equipamentos.forEach(e => { if (e.area) s.add(e.area); });
    return ["Todas as Áreas", ...Array.from(s).sort()];
  }, [equipamentos]);

  // Filter + sort - MEMOIZED for performance
  const filtradas = React.useMemo(() => {
    return ordens
      .filter(o => {
        const q = busca.toLowerCase();
        const matchBusca = !q || o.numero_os.toLowerCase().includes(q) || (o.placa || "").toLowerCase().includes(q);
        const matchStatus = filtroStatus === "Todos Status" || o.status === filtroStatus;
        const matchModulo = filtroModulo === "Todos Módulos" || o.modulo === filtroModulo;
        
        let matchArea = true;
        if (filtroArea !== "Todas as Áreas") {
          const eq = equipamentos.find(e => e.id === o.equipamento_id || e.placa === o.placa);
          matchArea = eq ? eq.area === filtroArea : false;
        }
        
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

        return matchBusca && matchStatus && matchModulo && matchArea && matchPeriodo;
      })
      .sort((a, b) => {
        if (filtroOrdem === "Mais Recente") return new Date(b.data_abertura).getTime() - new Date(a.data_abertura).getTime();
        if (filtroOrdem === "Mais Antiga") return new Date(a.data_abertura).getTime() - new Date(b.data_abertura).getTime();
        return 0;
      });
  }, [ordens, busca, filtroStatus, filtroModulo, filtroArea, filtroPeriodo, filtroOrdem, periodos, equipamentos]);

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
        if (isOnline) {
          const res = await excluirOrdensMassivo(Array.from(selectedIds));
          if (res && 'error' in res) {
            alert(`Erro: ${res.error}`);
          } else {
            await localDb.deleteMany('ordens_servico', Array.from(selectedIds));
            window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
            setSelectedIds(new Set());
          }
        } else {
          // Offline mode
          const idsArray = Array.from(selectedIds);
          await localDb.deleteMany('ordens_servico', idsArray);
          await localDb.addToQueue('os', 'bulk_delete', idsArray);
          window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
          window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
          setSelectedIds(new Set());
        }
      });
    }
  };

  const handleStatusUpdate = (id: string, novoStatus: string) => {
    startTransition(async () => {
      if (isOnline) {
        const res = await atualizarStatusOS(id, novoStatus);
        if (res && 'error' in res) {
          alert(res.error);
        } else {
          const os = ordens.find(o => o.id === id);
          if (os) {
            await localDb.put('ordens_servico', { ...os, status: novoStatus });
            window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
          }
        }
      } else {
        const os = ordens.find(o => o.id === id);
        if (os) {
          const updated = { ...os, status: novoStatus, _isPendingSync: true };
          await localDb.put('ordens_servico', updated);
          await localDb.addToQueue('os', 'update_status', { id, status: novoStatus });
          window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
          window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
        }
      }
    });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!(window as any).XLSX) {
        const script = document.createElement("script");
        script.src = "https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js";
        document.body.appendChild(script);
      }
      if (!(window as any).html2pdf) {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        document.body.appendChild(script);
      }
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
        if (isOnline) {
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
        } else {
          // Processamento offline local
          const importedOS = data.map((row: any) => ({
            ...row,
            id: `temp_import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            numero_os: row["Nº OS"] || row.numero_os || `OS-OFF-${Math.floor(Math.random() * 90000) + 10000}`,
            placa: row.Placa || row.placa || "",
            modulo: row["Módulo"] || row.modulo || "",
            status: row.Status || row.status || "Aberta",
            data_abertura: row.Abertura || row.data_abertura || new Date().toISOString(),
            data_fechamento: row.Fechamento || row.data_fechamento || null,
            _isPendingSync: true
          }));
          await localDb.saveMany('ordens_servico', importedOS);
          await localDb.addToQueue('os', 'import', data);
          window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
          window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
          alert(`✅ Importação offline concluída!\n\n📋 ${data.length} OS salvas localmente para sincronização.`);
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
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Gerenciar ordens de serviço de manutenção</p>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/20">
              Dados até: {new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('pt-BR')} (D+1)
            </span>
          </div>
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
              {(busca || filtroStatus !== "Todos Status" || filtroModulo !== "Todos Módulos" || filtroArea !== "Todas as Áreas" || filtroPeriodo !== "Todos Períodos") && (
                <button
                  onClick={() => { 
                    setBusca(""); 
                    setFiltroStatus("Todos Status"); 
                    setFiltroModulo("Todos Módulos"); 
                    setFiltroArea("Todas as Áreas");
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
              <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)} className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 outline-none focus:ring-2 focus:ring-blue-500/30">
                {areasOptions.map(a => <option key={a}>{a}</option>)}
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
                  <tr
                    key={os.id}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (
                        target.closest('button') || 
                        target.closest('input') || 
                        target.closest('a') || 
                        target.closest('select') ||
                        target.closest('.no-row-click')
                      ) {
                        return;
                      }
                      setSelectedOSActions(os);
                    }}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-3 no-row-click">
                      <input type="checkbox" checked={selectedIds.has(os.id)} onChange={() => toggleSelect(os.id)} className="rounded border-zinc-300" />
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {os.numero_os}
                      {(os as any)._isPendingSync && (
                        <span className="ml-2 inline-flex items-center text-[10px] text-amber-500 font-bold" title="Salvo offline, aguardando conexão para subir">
                          <RefreshCw size={10} className="animate-spin mr-1 text-amber-500" />
                          (Offline)
                        </span>
                      )}
                    </td>
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
                              <button title="Iniciar OS" onClick={() => handleStatusUpdate(os.id, "Em Andamento")} className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                <Check size={14} />
                              </button>
                            )}
                            {os.status === "Em Andamento" && (
                              <button title="Fechar OS" onClick={() => handleStatusUpdate(os.id, "Fechada")} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
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
                      if (isOnline) {
                        const res = await excluirOrdemServico(deletingId);
                        if (res && 'error' in res) {
                          alert(res.error);
                        } else {
                          await localDb.delete('ordens_servico', deletingId);
                          window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
                        }
                      } else {
                        await localDb.delete('ordens_servico', deletingId);
                        await localDb.addToQueue('os', 'delete', deletingId);
                        window.dispatchEvent(new CustomEvent('offline-db-updated-sync_queue'));
                        window.dispatchEvent(new CustomEvent('offline-db-updated-ordens_servico'));
                      }
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
          backlogs={backlogs}
          colaboradores={colaboradores}
        />
      )}

      {/* ── Ficha Impressão Modal ── */}
      {fichaOS && (
        <OSFichaModal
          os={fichaOS}
          onClose={() => {
            setFichaOS(null);
            setPdfAction(null);
          }}
          pdfAction={pdfAction}
        />
      )}

      {/* ── Modal de Escolha de Exportação de PDF ── */}
      {exportingOS && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm transition-opacity">
          {/* Backdrop close */}
          <div className="absolute inset-0" onClick={() => setExportingOS(null)} />

          {/* Card */}
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-950 rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-3 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                  Exportar PDF
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  OS Nº {exportingOS.numero_os}
                </p>
              </div>
              <button
                onClick={() => setExportingOS(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/50">
              {/* Option 1: Baixar no dispositivo */}
              <button
                onClick={() => {
                  setPdfAction('download');
                  setFichaOS(exportingOS as unknown as OSFichaData);
                  setExportingOS(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left"
              >
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                  <Download size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Baixar no Dispositivo</p>
                  <p className="text-[11px] text-zinc-400 font-medium">Salvar o arquivo PDF localmente</p>
                </div>
              </button>

              {/* Option 2: Compartilhar para outros aplicativos */}
              <button
                onClick={() => {
                  setPdfAction('share');
                  setFichaOS(exportingOS as unknown as OSFichaData);
                  setExportingOS(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left"
              >
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                  <Printer size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Baixar e Compartilhar</p>
                  <p className="text-[11px] text-zinc-400 font-medium">Salvar e abrir menu de envio (WhatsApp, etc.)</p>
                </div>
              </button>

              {/* Option 3: Imprimir via Navegador */}
              <button
                onClick={() => {
                  setPdfAction('print');
                  setFichaOS(exportingOS as unknown as OSFichaData);
                  setExportingOS(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left"
              >
                <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  <Printer size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Imprimir via Navegador</p>
                  <p className="text-[11px] text-zinc-400 font-medium">Abrir visualização de impressão padrão</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Ações da OS para Celular/Telas menores ── */}
      {selectedOSActions && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm transition-opacity">
          {/* Backdrop close */}
          <div className="absolute inset-0" onClick={() => setSelectedOSActions(null)} />

          {/* Card */}
          <div className="relative z-10 w-full max-w-sm bg-white dark:bg-zinc-950 rounded-t-2xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
            {/* Drag handle decoration for mobile view */}
            <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-3 sm:hidden" />

            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                  Ações da OS
                </h3>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">
                  Nº {selectedOSActions.numero_os} • {selectedOSActions.placa || "Sem Placa"}
                </p>
              </div>
              <button
                onClick={() => setSelectedOSActions(null)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-500 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* List of actions */}
            <div className="p-4 flex flex-col gap-2 bg-zinc-50/50 dark:bg-zinc-950/50">
              {/* Option 1: Ver Ficha */}
              <button
                onClick={() => {
                  setFichaOS(selectedOSActions as unknown as OSFichaData);
                  setSelectedOSActions(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left"
              >
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400">
                  <FileText size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Ver Ficha</p>
                  <p className="text-[11px] text-zinc-400 font-medium">Visualizar detalhes completos</p>
                </div>
              </button>

              {/* Option 2: Editar */}
              <button
                onClick={() => {
                  if (isVisitante) return;
                  setEditingOS(selectedOSActions);
                  setShowModal(true);
                  setSelectedOSActions(null);
                }}
                disabled={isVisitante}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left",
                  isVisitante && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                  <Pencil size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold flex items-center gap-1.5">
                    Editar OS
                    {isVisitante && <Lock size={12} className="text-zinc-400" />}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-medium">
                    {isVisitante ? "Apenas leitura para visitante" : "Modificar dados cadastrados"}
                  </p>
                </div>
              </button>

              {/* Option 3: Exportar PDF */}
              <button
                onClick={() => {
                  setExportingOS(selectedOSActions);
                  setSelectedOSActions(null);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left"
              >
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400">
                  <Printer size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold">Exportar PDF</p>
                  <p className="text-[11px] text-zinc-400 font-medium">Gerar documento de impressão</p>
                </div>
              </button>

              {/* Option 4: Apagar */}
              <button
                onClick={() => {
                  if (isVisitante) return;
                  setDeletingId(selectedOSActions.id);
                  setSelectedOSActions(null);
                }}
                disabled={isVisitante}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-200 font-semibold text-sm transition-all shadow-sm text-left",
                  isVisitante && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400">
                  <Trash2 size={16} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                    Apagar OS
                    {isVisitante && <Lock size={12} className="text-zinc-400" />}
                  </p>
                  <p className="text-[11px] text-zinc-400 font-medium">Excluir permanentemente da base</p>
                </div>
              </button>
            </div>
          </div>
        </div>
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
