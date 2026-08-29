"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Plus, Circle, ShieldAlert, AlertTriangle, Search, Printer, ArrowLeft, Filter, ChevronDown, ClipboardList, History, LayoutGrid } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { registrarInspecaoCompleta, atualizarInspecao, excluirInspecao, excluirInspecoesMassivo } from "./actions";
import { useAuth } from "@/components/auth-context";
import PneusModal from "./PneusModal";
import PneusImportModal from "./PneusImportModal";
import PneusAIReport from "./PneusAIReport";
import PneuEsquemaModal from "./PneuEsquemaModal";
import { Sparkles, CalendarCheck, Archive, RefreshCw } from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { cn } from "@/lib/utils";
import { gerarFichaPneusPDF } from "./pdfBoletim";

// ─── Types ────────────────────────────────────────────────────────────────────
type Equipamento = { id: string; placa: string; tipo?: string | null; modulo?: string | null; categoria?: string | null; status?: string | null; deleted_at?: string | null };
type Inspecao = {
  id: string;
  equipamento_id: string;
  data_inspecao: string;
  created_at?: string | null;
  km_atual: number | null;
  // Sulco 2 (meio) de cada posição — é o que alimenta o Dashboard/gráficos principais.
  de: number | null; dd: number | null;
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null;
  estepe: number | null;
  // Sulco 1 (lado direito) e Sulco 3 (lado esquerdo) de cada posição.
  de_s1?: number | null; de_s3?: number | null;
  dd_s1?: number | null; dd_s3?: number | null;
  tei_s1?: number | null; tei_s3?: number | null;
  tee_s1?: number | null; tee_s3?: number | null;
  tdi_s1?: number | null; tdi_s3?: number | null;
  tde_s1?: number | null; tde_s3?: number | null;
  tei1_s1?: number | null; tei1_s3?: number | null;
  tee1_s1?: number | null; tee1_s3?: number | null;
  tdi1_s1?: number | null; tdi1_s3?: number | null;
  tde1_s1?: number | null; tde1_s3?: number | null;
  estepe_s1?: number | null; estepe_s3?: number | null;
  condicao: string;
  equipamentos?: { placa: string; tipo?: string | null; modulo?: string | null; categoria?: string | null };
  _isPendingSync?: boolean;
  registrado_por?: string | null;
  registrado_por_nome?: string | null;
};

const POSICOES = ["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as const;
type Pos = typeof POSICOES[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sulcoColor(v: number | null): string {
  if (v == null) return "bg-zinc-100 dark:bg-zinc-800 text-zinc-400";
  if (v < 3) return "bg-red-500 text-white"; // < 3mm (Trocar)
  if (v <= 5) return "bg-orange-400 text-white"; // 3-5mm (Crítico)
  if (v <= 9) return "bg-yellow-400 text-zinc-900"; // 6-9mm (Atenção)
  return "bg-emerald-500 text-white"; // >= 10mm (Bom)
}

function condBadge(c: string) {
  const map: Record<string, string> = {
    BOM: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    REGULAR: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    ATENCAO: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    CRITICO: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    TROCAR: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return map[c] || map.BOM;
}

const COND_COLOR: Record<string, string> = {
  BOM: "#22c55e", REGULAR: "#facc15", ATENCAO: "#facc15", CRITICO: "#f97316", TROCAR: "#ef4444",
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const [datePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

// Célula com os 3 pontos de medição de uma posição empilhados (Direito / Meio / Esquerdo) —
// usada na aba "Sulcos Detalhados" pra deixar visível qual lado do pneu está mais desgastado.
function renderSulcoTriple(s1: number | null | undefined, s2: number | null | undefined, s3: number | null | undefined) {
  const cell = (v: number | null | undefined) => (
    <span className={`block w-9 py-0.5 rounded text-[9px] text-center ${sulcoColor(v ?? null)}`}>{v ?? '—'}</span>
  );
  return (
    <div className="flex flex-col gap-0.5 items-center">
      {cell(s1)}
      {cell(s2)}
      {cell(s3)}
    </div>
  );
}

type Tab = "menu" | "dashboard" | "leves" | "lista" | "sulcos" | "historico";

export default function PneusClient({
  equipamentos,
  inspecoes: initialInspecoes,
}: {
  equipamentos: Equipamento[];
  inspecoes: Inspecao[];
}) {
  const { isOnline } = useOffline();
  const [inspecoes, setInspecoes] = useState(initialInspecoes);

  // Sync cache with initialInspecoes from server when online
  useEffect(() => {
    if (isOnline && initialInspecoes && initialInspecoes.length > 0) {
      localDb.saveMany("pneus_inspecao", initialInspecoes);
    }
  }, [isOnline, initialInspecoes]);

  // Load from local DB dynamically
  useEffect(() => {
    let active = true;
    const loadFromDb = async () => {
      const data = await localDb.getAll("pneus_inspecao");
      if (active) {
        data.sort((a, b) => new Date(b.data_inspecao).getTime() - new Date(a.data_inspecao).getTime());
        setInspecoes(data);
      }
    };
    loadFromDb();

    window.addEventListener("offline-db-updated-pneus_inspecao", loadFromDb);
    window.addEventListener("offline-sync-completed", loadFromDb);
    return () => {
      active = false;
      window.removeEventListener("offline-db-updated-pneus_inspecao", loadFromDb);
      window.removeEventListener("offline-sync-completed", loadFromDb);
    };
  }, []);
  const router = useRouter();
  const { profile, user } = useAuth();
  const isVisitante = profile?.role === "visitante";
  const isAdmin = profile?.role === "admin";

  // Tela inicial é o menu de cards — mais limpa, principalmente pra uso no app.
  const [tab, setTab] = useState<Tab>("menu");
  const handleSetTab = (t: Tab) => { setTab(t); setModuloFiltro("TODOS"); setCondicaoFiltro("TODOS"); };
  // Filtros (placa/data/status) ficam ocultos por padrão dentro de cada seção.
  const [showFiltros, setShowFiltros] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAIReportOpen, setIsAIReportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inspecao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moduloFiltro, setModuloFiltro] = useState<string>("TODOS");
  // "TODOS" ou um dos rótulos dos cartões de KPI (BOM/REGULAR/ATENCAO/CRITICO/TROCAR/PENDENTE) —
  // clicar num cartão filtra a tabela de veículos abaixo por aquele status; clicar de novo limpa.
  const [condicaoFiltro, setCondicaoFiltro] = useState<string>("TODOS");
  const handleClickCondicao = (label: string) => {
    setCondicaoFiltro(prev => (prev === label ? "TODOS" : label));
  };
  const [selectedSchematic, setSelectedSchematic] = useState<Inspecao | null>(null);

  // Pré-carrega SheetJS via CDN para Export e Import
  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
      document.head.appendChild(script);
    }
    if (!(window as any).html2pdf) {
      const script2 = document.createElement("script");
      script2.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(script2);
    }
  }, []);

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

    if (isOnline) {
      const res = await excluirInspecoesMassivo(Array.from(selectedIds));
      if (res && "error" in res) {
        alert(res.error);
      } else {
        await localDb.deleteMany("pneus_inspecao", Array.from(selectedIds));
        window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
        setSelectedIds(new Set());
      }
    } else {
      const idsArray = Array.from(selectedIds);
      await localDb.deleteMany("pneus_inspecao", idsArray);
      await localDb.addToQueue("pneu", "bulk_delete", idsArray);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
      setSelectedIds(new Set());
      alert("✅ Exclusão em lote registrada localmente!");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Confirmar exclusão definitiva?")) return;

    if (isOnline) {
      const res = await excluirInspecao(id);
      if (res && "error" in res) {
        alert(res.error);
      } else {
        await localDb.delete("pneus_inspecao", id);
        window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
      }
    } else {
      await localDb.delete("pneus_inspecao", id);
      await localDb.addToQueue("pneu", "delete", id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
      alert("✅ Exclusão registrada localmente!");
    }
  };

  // ── Search & Filter ── (Default: Current Month)
  const [search, setSearch] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [dateInicio, setDateInicio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateFim, setDateFim] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  // ── Helpers para verificação de status e categoria ──
  const isEquipamentoAtivo = (eq: any) => {
    if (!eq) return false;
    if (eq.deleted_at) return false;
    const st = String(eq.status || 'Ativo').toUpperCase().trim();
    return st !== 'INATIVO' && st !== 'BAIXADO' && st !== 'DESATIVADO';
  };

  const isEquipamentoPesado = (eq: any) => {
    if (!eq) return false;
    const cat = String(eq.categoria || 'PESADA').toUpperCase().trim();
    return cat === 'PESADA' || cat === 'FROTA PESADA' || cat.includes('PESADA');
  };

  const isEquipamentoLeve = (eq: any) => {
    if (!eq) return false;
    const cat = String(eq.categoria || '').toUpperCase().trim();
    return cat === 'LEVE' || cat === 'FROTA LEVE' || cat.includes('LEVE');
  };

  // Dias corridos desde o último boletim de cada equipamento, considerando TODO o
  // histórico (não só o período selecionado nos filtros de data acima) — o lançamento
  // é a cada 15 dias, então isso precisa refletir a última vez real que a placa subiu
  // um boletim, independente de qual intervalo de datas está sendo visualizado no momento.
  // null = equipamento nunca teve nenhum boletim registrado.
  const diasSemBoletimPorEquipamento = React.useMemo(() => {
    const ultimaDataPorEq: Record<string, string> = {};
    inspecoes.forEach(ins => {
      if (!ins.equipamento_id) return;
      const data = ins.data_inspecao.split('T')[0];
      if (!ultimaDataPorEq[ins.equipamento_id] || data > ultimaDataPorEq[ins.equipamento_id]) {
        ultimaDataPorEq[ins.equipamento_id] = data;
      }
    });

    const hojeMs = new Date().setHours(0, 0, 0, 0);
    const map: Record<string, number | null> = {};
    equipamentos.forEach(eq => {
      const ultima = ultimaDataPorEq[eq.id];
      if (!ultima) { map[eq.id] = null; return; }
      const [y, m, d] = ultima.split('-').map(Number);
      const dataMs = new Date(y, m - 1, d).setHours(0, 0, 0, 0);
      map[eq.id] = Math.floor((hojeMs - dataMs) / 86400000);
    });
    return map;
  }, [inspecoes, equipamentos]);

  const LIMITE_DIAS_BOLETIM = 15;

  const filteredInspecoesRows = inspecoes.filter(i => {
    const eq = i.equipamento_id ? equipamentos.find(e => e.id === i.equipamento_id) : null;
    if (eq && !isEquipamentoAtivo(eq)) return false;
    const matchesSearch = !search || i.equipamentos?.placa?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !searchStatus || i.condicao === searchStatus;
    const iDate = i.data_inspecao.split('T')[0];
    const matchesDate = (!dateInicio || iDate >= dateInicio) && (!dateFim || iDate <= dateFim);
    return matchesSearch && matchesStatus && matchesDate;
  });

  // Histórico é auditoria por usuário: mecânico/motorista só vê o que ele mesmo registrou
  // (mais os boletins antigos sem essa marca, já que não dá pra saber de quem eram); admin
  // continua vendo tudo. Não mexe no Dashboard (Veículos) nem na Lista — essas são a visão
  // operacional da frota inteira, não um log de quem lançou, e precisam continuar globais.
  const historicoVisivel = isAdmin
    ? filteredInspecoesRows
    : filteredInspecoesRows.filter(i => !i.registrado_por || i.registrado_por === user?.id);

  const handleClearFilters = () => {
    setSearch("");
    setSearchStatus("");
    const d = new Date();
    setDateInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    setDateFim(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  // ── Unified row type ──
  type DashRow = 
    | { kind: 'inspecao'; ins: Inspecao }
    | { kind: 'pendente'; eq: Equipamento };

  // ── Per-module KPI helper ──
  const getModuloCounts = (items: DashRow[]) => {
    const c = { BOM: 0, REGULAR: 0, ATENCAO: 0, CRITICO: 0, TROCAR: 0, PENDENTE: 0 };
    items.forEach(row => {
      if (row.kind === 'pendente') { c.PENDENTE++; return; }
      const cond = row.ins.condicao;
      if (cond in c) (c as any)[cond]++;
    });
    return c;
  };

  // ── Build dashboard data for a given category filter ──
  const buildDashData = (catFilter: 'PESADA' | 'LEVE') => {
    // Equipamentos ativos da categoria solicitada (Somente Pesados na aba pesados, e somente ATIVO)
    const eqs = equipamentos.filter(e => {
      if (!isEquipamentoAtivo(e)) return false;
      return catFilter === 'PESADA' ? isEquipamentoPesado(e) : isEquipamentoLeve(e);
    });

    // Latest inspection per equipamento, scoped to filtered inspections of active vehicles
    const latest = Object.values(filteredInspecoesRows.reduce((acc, ins) => {
      const eq = equipamentos.find(e => e.id === ins.equipamento_id);
      if (eq && !isEquipamentoAtivo(eq)) return acc;

      const cat = (ins.equipamentos as any)?.categoria || eq?.categoria || (catFilter === 'PESADA' ? 'PESADA' : 'LEVE');
      const matchesCat = catFilter === 'PESADA' ? isEquipamentoPesado({ categoria: cat }) : isEquipamentoLeve({ categoria: cat });

      if (!matchesCat) return acc;
      if (!acc[ins.equipamento_id]) acc[ins.equipamento_id] = ins;
      return acc;
    }, {} as Record<string, Inspecao>));

    const insByEqId: Record<string, Inspecao> = {};
    latest.forEach(ins => { insByEqId[ins.equipamento_id] = ins; });

    // Grupos por módulo
    const grupos: Record<string, DashRow[]> = {};
    eqs.forEach(eq => {
      const mod = eq.modulo || 'SEM MÓDULO';
      if (!grupos[mod]) grupos[mod] = [];
      const ins = insByEqId[eq.id];
      if (ins) {
        grupos[mod].push({ kind: 'inspecao', ins });
      } else {
        grupos[mod].push({ kind: 'pendente', eq });
      }
    });
    Object.keys(grupos).forEach(k => {
      grupos[k].sort((a, b) => {
        const pa = a.kind === 'inspecao' ? a.ins.equipamentos?.placa || '' : a.eq.placa;
        const pb = b.kind === 'inspecao' ? b.ins.equipamentos?.placa || '' : b.eq.placa;
        if (a.kind === 'pendente' && b.kind === 'inspecao') return 1;
        if (a.kind === 'inspecao' && b.kind === 'pendente') return -1;
        return pa.localeCompare(pb);
      });
    });

    const modulos = ['TODOS', ...Object.keys(grupos).sort((a, b) =>
      a === 'SEM MÓDULO' ? 1 : b === 'SEM MÓDULO' ? -1 : a.localeCompare(b)
    )];

    const counts = { BOM: 0, REGULAR: 0, ATENCAO: 0, CRITICO: 0, TROCAR: 0 };
    latest.forEach(ins => {
      if (ins.condicao in counts) (counts as any)[ins.condicao]++;
    });
    const pendentesCount = eqs.length - latest.length;
    const critList = latest.filter(i => i.condicao === 'CRITICO' || i.condicao === 'TROCAR');
    const pieData = Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    const latestDate = latest.length > 0
      ? latest.reduce((l, c) => (!l || c.data_inspecao > l ? c.data_inspecao : l), '')
      : null;
    const pMedia = POSICOES.map(pos => {
      const vals = latest.map(i => i[pos]).filter(v => v != null) as number[];
      return { pos: pos.toUpperCase(), media: vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : 0 };
    }).filter(d => d.media > 0);

    // Placas há mais de LIMITE_DIAS_BOLETIM dias sem nenhum boletim (ou que nunca tiveram
    // um) — independe do período selecionado nos filtros de data, usa o histórico real.
    const atrasados15d = eqs
      .map(eq => ({ eq, dias: diasSemBoletimPorEquipamento[eq.id] ?? null }))
      .filter(({ dias }) => dias === null || dias > LIMITE_DIAS_BOLETIM)
      .sort((a, b) => {
        if (a.dias == null) return -1;
        if (b.dias == null) return 1;
        return b.dias - a.dias;
      });

    return { eqs, latest, grupos, modulos, counts, pendentesCount, critList, pieData, latestDate, pMedia, atrasados15d };
  };

  const pesadosData = React.useMemo(() => buildDashData('PESADA'), [equipamentos, filteredInspecoesRows, diasSemBoletimPorEquipamento]);
  const levesData   = React.useMemo(() => buildDashData('LEVE'),   [equipamentos, filteredInspecoesRows, diasSemBoletimPorEquipamento]);

  // Último boletim de cada equipamento (pesado ou leve), pra aba "Sulcos Detalhados" —
  // que não separa por categoria, só mostra o detalhamento dos 3 pontos de medição.
  const todosLatestSulcos = React.useMemo(() => {
    return [...pesadosData.latest, ...levesData.latest].sort((a, b) =>
      (a.equipamentos?.placa || '').localeCompare(b.equipamentos?.placa || '')
    );
  }, [pesadosData.latest, levesData.latest]);

  // ── Active category data (feeds shared dashboard JSX) ──
  const isLevesTab = tab === 'leves';
  const activeData = isLevesTab ? levesData : pesadosData;

  // Keep old variables pointing to active data (used by existing JSX)
  const latestByEq     = activeData.latest;
  const gruposPorModulo= activeData.grupos;
  const counts         = activeData.counts;
  const pendentesTotal = activeData.pendentesCount;
  const criticos       = activeData.critList;
  const pieData        = activeData.pieData;
  const globalLatestDate = activeData.latestDate;
  const posMedia       = activeData.pMedia;
  const total          = activeData.latest.length || 1;
  const atrasados15d   = activeData.atrasados15d;

  const modulosDisponiveis = React.useMemo(
    () => (isLevesTab ? levesData : pesadosData).modulos,
    [isLevesTab, levesData, pesadosData]
  );

  const gruposFiltrados = React.useMemo(() => {
    if (moduloFiltro === 'TODOS') return gruposPorModulo;
    return { [moduloFiltro]: gruposPorModulo[moduloFiltro] || [] };
  }, [gruposPorModulo, moduloFiltro]);

  // Lista única com todos os veículos (de todos os módulos exibidos pelo filtro
  // acima), uma placa embaixo da outra, em vez de um card separado por módulo.
  const todosItensFiltrados = React.useMemo(() => {
    const out: { modulo: string; row: DashRow }[] = [];
    Object.entries(gruposFiltrados).forEach(([modulo, items]) => {
      items.forEach(row => {
        if (condicaoFiltro !== 'TODOS') {
          if (condicaoFiltro === 'ATRASADO_15D') {
            const eqId = row.kind === 'inspecao' ? row.ins.equipamento_id : row.eq.id;
            const dias = diasSemBoletimPorEquipamento[eqId] ?? null;
            if (!(dias === null || dias > LIMITE_DIAS_BOLETIM)) return;
          } else {
            const matches = condicaoFiltro === 'PENDENTE'
              ? row.kind === 'pendente'
              : row.kind === 'inspecao' && row.ins.condicao === condicaoFiltro;
            if (!matches) return;
          }
        }
        out.push({ modulo, row });
      });
    });
    out.sort((a, b) => {
      if (a.modulo !== b.modulo) return a.modulo.localeCompare(b.modulo);
      const pa = a.row.kind === 'inspecao' ? a.row.ins.equipamentos?.placa || '' : a.row.eq.placa;
      const pb = b.row.kind === 'inspecao' ? b.row.ins.equipamentos?.placa || '' : b.row.eq.placa;
      if (a.row.kind === 'pendente' && b.row.kind === 'inspecao') return 1;
      if (a.row.kind === 'inspecao' && b.row.kind === 'pendente') return -1;
      return pa.localeCompare(pb);
    });
    return out;
  }, [gruposFiltrados, condicaoFiltro, diasSemBoletimPorEquipamento]);


  const exportExcel = () => {
    const XLSXLib = (window as any).XLSX;
    if (!XLSXLib) {
      alert('Aguarde o carregamento da biblioteca Excel e tente novamente.');
      return;
    }
    const rows = inspecoes.map(i => ({
      Placa: i.equipamentos?.placa, Data: fmtDate(i.data_inspecao), Km: i.km_atual, Condicao: i.condicao,
      DE: i.de, DD: i.dd, TEI: i.tei, TEE: i.tee, TDI: i.tdi, TDE: i.tde, ESTEPE: i.estepe
    }));
    const ws = XLSXLib.utils.json_to_sheet(rows);
    const wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, ws, "Pneus");

    const isAndroidApp = typeof window !== "undefined" && (window as any).EunamanApp && typeof (window as any).EunamanApp.saveBase64File === "function";
    const filename = "Relatorio_Pneus.xlsx";

    if (isAndroidApp) {
      try {
        const excelBase64 = XLSXLib.write(wb, { bookType: 'xlsx', type: 'base64' });
        (window as any).EunamanApp.saveBase64File(excelBase64, filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      } catch (err: any) {
        console.error("Erro ao gerar Excel para App:", err);
        alert("Erro ao salvar Excel: " + err.message);
      }
    } else {
      XLSXLib.writeFile(wb, filename);
      alert("Planilha Excel gerada e baixada com sucesso!");
    }
  };

   // Geração de PDF extraída pra app/pneus/pdfBoletim.ts — compartilhada com o PneusModal,
   // que oferece a ficha logo após o registro.
   const downloadBoletimPDF = (ins: Inspecao) => gerarFichaPneusPDF(ins);

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[100rem] mx-auto w-full h-full animate-in fade-in duration-500">
      
      {/* Header Section — sempre visível; ações e filtros só aparecem fora do menu inicial */}
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

          {tab !== "menu" && (
          <div className="flex flex-wrap items-center gap-3 relative z-10">
            {/* Voltar ao menu de cards */}
            <button
              onClick={() => handleSetTab("menu")}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-black text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft size={15} /> Voltar
            </button>

            {/* Botão Filtros — retrátil, fechado por padrão pra manter a tela limpa */}
            <button
              onClick={() => setShowFiltros(v => !v)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest transition-colors",
                showFiltros
                  ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400"
                  : "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              )}
            >
              <Filter size={15} /> Filtros
              {(search || searchStatus) && (
                <span className="px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] leading-none">•</span>
              )}
              <ChevronDown size={14} className={cn("transition-transform", showFiltros && "rotate-180")} />
            </button>

            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
               <Download size={16} /> Exportar
            </button>

            {!isVisitante && (
              <button
                  onClick={() => alert("Histórico da quinzena arquivado com sucesso. Iniciando novo ciclo...")}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-orange-600 border border-orange-200 dark:border-orange-900/50 rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all"
              >
                 <Archive size={16} /> Fechar Ciclo
              </button>
            )}

            {!isVisitante ? (
              <>
                <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
                   <Upload size={16} /> Importar
                </button>
                <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-500/30 transition-all active:scale-95 group">
                   <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
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
          )}
      </div>

      {/* ─── MENU DE CARDS (TELA INICIAL) ─── */}
      {tab === "menu" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!isVisitante && (
            <button
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
              className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
            >
              <div className="p-3 bg-orange-500 text-white rounded-xl shadow-md">
                <Plus size={22} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Registrar</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Lançar um novo boletim de inspeção</p>
              </div>
            </button>
          )}

          <button
            onClick={() => handleSetTab("dashboard")}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
          >
            <div className="p-3 bg-orange-500 text-white rounded-xl shadow-md text-lg leading-none">🚛</div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Boletim Pesados</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Painel e inspeções da frota pesada</p>
            </div>
          </button>

          <button
            onClick={() => handleSetTab("leves")}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-800 transition-all text-left"
          >
            <div className="p-3 bg-blue-500 text-white rounded-xl shadow-md text-lg leading-none">🚗</div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Boletim Leves</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Painel e inspeções da frota leve</p>
            </div>
          </button>

          <button
            onClick={() => handleSetTab("lista")}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
          >
            <div className="p-3 bg-zinc-700 text-white rounded-xl shadow-md">
              <ClipboardList size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Lista</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Todas as inspeções em formato de lista</p>
            </div>
          </button>

          <button
            onClick={() => handleSetTab("sulcos")}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
          >
            <div className="p-3 bg-zinc-700 text-white rounded-xl shadow-md">
              <LayoutGrid size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Sulcos Detalhados</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Medição por lado direito, meio e esquerdo</p>
            </div>
          </button>

          <button
            onClick={() => handleSetTab("historico")}
            className="flex flex-col items-start gap-3 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-800 transition-all text-left"
          >
            <div className="p-3 bg-zinc-700 text-white rounded-xl shadow-md">
              <History size={22} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-zinc-800 dark:text-zinc-100">Histórico</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Ciclos e alterações já encerrados</p>
            </div>
          </button>
        </div>
      )}

      {tab !== "menu" && (
      <>
      {criticos.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold tracking-tight">
            ALERTA: {criticos.length} pneus em estado crítico ou troca imediata detectados na frota.
          </span>
        </div>
      )}

      {showFiltros && (
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {/* Filtro por Placa */}
            <div className="relative group">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
               <input
                 type="text"
                 placeholder="PLACA..."
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all w-44"
               />
            </div>

            {/* Filtro por Data */}
            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 py-1.5 gap-2">
              <input
                type="date"
                value={dateInicio}
                onChange={e => setDateInicio(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-600 dark:text-zinc-400"
              />
              <span className="text-zinc-300 font-bold">/</span>
              <input
                type="date"
                value={dateFim}
                onChange={e => setDateFim(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-600 dark:text-zinc-400"
              />
            </div>

            {/* Filtro por Status */}
            <select
              value={searchStatus}
              onChange={e => setSearchStatus(e.target.value)}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none transition-all cursor-pointer"
            >
              <option value="">TODOS STATUS</option>
              {Object.keys(counts).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {(search || searchStatus) && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all"
              >
                Limpar
              </button>
            )}
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex flex-col gap-6">

        {(tab === "dashboard" || tab === "leves") && (
          <div className="space-y-6">

            {/* Dashboard Header: AI Report + Module Filter + Legend */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <button 
                  onClick={() => setIsAIReportOpen(true)}
                  className="flex items-center gap-3 px-6 py-4 bg-zinc-900 dark:bg-orange-500/10 text-white dark:text-orange-400 border border-zinc-800 dark:border-orange-500/30 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                  <Sparkles size={20} className="text-orange-500 animate-pulse" />
                  RELATÓRIO IA
                </button>
                <div>
                  <h3 className="font-black text-zinc-800 dark:text-zinc-200 tracking-tight text-lg">
                    {tab === 'leves' ? '🚗 Painel — Carros Leves' : '🚛 Painel — Veículos Pesados'}
                  </h3>
                  <p className="text-[11px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                    <CalendarCheck size={14} className="text-emerald-500" />
                    Última Atualização: <span className="text-zinc-900 dark:text-zinc-50">{fmtDate(globalLatestDate)}</span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Module Filter Tabs */}
                <div className="flex flex-wrap gap-2">
                  {modulosDisponiveis.map(mod => (
                    <button
                      key={mod}
                      onClick={() => setModuloFiltro(mod)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                        moduloFiltro === mod
                          ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/20"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-orange-300"
                      }`}
                    >
                      {mod}
                    </button>
                  ))}
                  {/* Atalho rápido pro filtro de status PENDENTE (mesmo filtro do card de KPI
                      abaixo), direto ao lado dos módulos pra não precisar rolar a tela. */}
                  <button
                    type="button"
                    onClick={() => handleClickCondicao('PENDENTE')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-dashed ${
                      condicaoFiltro === 'PENDENTE'
                        ? "bg-zinc-700 text-white border-zinc-700 shadow-lg shadow-zinc-700/20 dark:bg-zinc-300 dark:text-zinc-900 dark:border-zinc-300"
                        : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-300 dark:border-zinc-700 hover:border-zinc-400"
                    }`}
                  >
                    Pendentes
                  </button>
                </div>
                <div className="flex gap-3 text-[10px] font-black uppercase tracking-tighter text-zinc-400 ml-2">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Bom</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Atenção</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Crítico</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Trocar</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-300" /> Pendente</span>
                </div>
              </div>
            </div>

            {/* Aviso: placas há mais de LIMITE_DIAS_BOLETIM dias sem nenhum boletim (independe
                do período selecionado nos filtros de data acima — usa o histórico real). */}
            {atrasados15d.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border-2 border-red-300 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wide text-red-700 dark:text-red-400">
                    {atrasados15d.length} placa{atrasados15d.length !== 1 ? "s" : ""} há mais de {LIMITE_DIAS_BOLETIM} dias sem boletim de pneus
                  </p>
                  <p className="text-[11px] font-semibold text-red-600/90 dark:text-red-400/80 mt-1 break-words">
                    {atrasados15d.map(({ eq, dias }) => `${eq.placa} (${dias == null ? "nunca teve boletim" : `${dias}d`})`).join(" · ")}
                  </p>
                </div>
              </div>
            )}

            {/* Global KPI Cards — clique num cartão pra filtrar a tabela abaixo por aquele status; clique de novo pra limpar */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {Object.entries(counts).map(([label, val]) => {
                const isActive = condicaoFiltro === label;
                return (
                  <button
                    type="button"
                    key={label}
                    onClick={() => handleClickCondicao(label)}
                    className={`text-left bg-white dark:bg-zinc-950 p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all group ${
                      isActive
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-zinc-200 dark:border-zinc-800"
                    }`}
                  >
                     <div className="flex items-center justify-between mb-3">
                        <span className={`p-2 rounded-xl ${
                          label === 'BOM' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10' :
                          label === 'REGULAR' || label === 'ATENCAO' ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-500/10' :
                          label === 'CRITICO' ? 'bg-orange-50 text-orange-500 dark:bg-orange-500/10' :
                          'bg-red-50 text-red-500 dark:bg-red-500/10'
                        }`}>
                           <Circle size={18} fill="currentColor" fillOpacity={0.2} />
                        </span>
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tight">{isActive ? "Filtrando" : "Global"}</span>
                     </div>
                     <div className="text-2xl font-black text-zinc-900 dark:text-zinc-50">{val}</div>
                     <p className="text-[10px] font-bold text-zinc-500 mt-0.5">{label} · {Math.round((val/total)*100)}%</p>
                  </button>
                );
              })}
              {/* Pendente Card */}
              <button
                type="button"
                onClick={() => handleClickCondicao('PENDENTE')}
                className={`text-left bg-white dark:bg-zinc-950 p-5 rounded-2xl border-2 border-dashed shadow-sm hover:shadow-md transition-all group ${
                  condicaoFiltro === 'PENDENTE'
                    ? "border-orange-500 ring-2 ring-orange-500/30"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                 <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                       <Circle size={18} className="opacity-40" />
                    </span>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tight">{condicaoFiltro === 'PENDENTE' ? "Filtrando" : "Global"}</span>
                 </div>
                 <div className="text-2xl font-black text-zinc-400">{pendentesTotal}</div>
                 <p className="text-[10px] font-bold text-zinc-400 mt-0.5">PENDENTE · sem boletim</p>
              </button>
              {/* Atrasados > 15 dias Card */}
              <button
                type="button"
                onClick={() => handleClickCondicao('ATRASADO_15D')}
                className={`text-left bg-white dark:bg-zinc-950 p-5 rounded-2xl border-2 shadow-sm hover:shadow-md transition-all group ${
                  condicaoFiltro === 'ATRASADO_15D'
                    ? "border-red-500 ring-2 ring-red-500/30"
                    : "border-red-200 dark:border-red-900/50"
                }`}
              >
                 <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-xl bg-red-50 text-red-500 dark:bg-red-500/10">
                       <AlertTriangle size={18} />
                    </span>
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-tight">{condicaoFiltro === 'ATRASADO_15D' ? "Filtrando" : "Global"}</span>
                 </div>
                 <div className="text-2xl font-black text-red-600 dark:text-red-400">{atrasados15d.length}</div>
                 <p className="text-[10px] font-bold text-red-500/80 mt-0.5">ATRASADAS · +{LIMITE_DIAS_BOLETIM} dias</p>
              </button>
            </div>

            {/* Unified Monitoring Table — todos os veículos (respeitando o filtro de módulo acima),
                uma placa embaixo da outra, em vez de um card separado por módulo. */}
            {(() => {
              const items = todosItensFiltrados.map(x => x.row);
              const modCounts = getModuloCounts(items);
              const modTotal = items.length || 1;
              const totalCriticos = items.filter(row => row.kind === 'inspecao' && (row.ins.condicao === "CRITICO" || row.ins.condicao === "TROCAR")).length;
              const totalPendentes = items.filter(row => row.kind === 'pendente').length;

              return (
                <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
                  {/* Header */}
                  <div className="w-full p-5 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-orange-500/10 rounded-xl">
                          <Circle size={16} className="text-orange-500" fill="currentColor" fillOpacity={0.3} />
                        </div>
                        <div className="text-left">
                          <h4 className="font-black text-zinc-800 dark:text-zinc-200 text-base uppercase tracking-wider flex items-center gap-2 flex-wrap">
                            <span>🚛 Veículos{moduloFiltro !== 'TODOS' ? ` — Módulo: ${moduloFiltro}` : ''}</span>
                            {condicaoFiltro !== 'TODOS' && (
                              <button
                                type="button"
                                onClick={() => setCondicaoFiltro('TODOS')}
                                className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-orange-200 dark:hover:bg-orange-500/30 transition-colors"
                                title="Limpar filtro de status"
                              >
                                Status: {condicaoFiltro} ✕
                              </button>
                            )}
                          </h4>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                            {items.length} veículo{items.length !== 1 ? "s" : ""}
                            {totalCriticos > 0 && (
                              <span className="ml-2 text-red-500 animate-pulse">⚠ {totalCriticos} crítico{totalCriticos !== 1 ? "s" : ""}</span>
                            )}
                            {totalPendentes > 0 && (
                              <span className="ml-2 text-zinc-400">— {totalPendentes} sem boletim</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Mini KPI pills */}
                    <div className="hidden md:flex gap-2">
                      {Object.entries(modCounts).filter(([,v]) => v > 0).map(([lbl, v]) => (
                        <span key={lbl} className={`px-2.5 py-1 text-[9px] font-black rounded-full uppercase tracking-widest ${
                          lbl === 'BOM' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                          lbl === 'ATENCAO' || lbl === 'REGULAR' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400' :
                          lbl === 'CRITICO' ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' :
                          lbl === 'TROCAR' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                          'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}>
                          {v} {lbl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Unified Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                          <th className="px-6 py-3 font-black uppercase tracking-widest text-zinc-400 text-left">Veículo</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-left">Módulo</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-center">Data</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={2}>Frontal</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 1</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 2</th>
                          <th className="px-6 py-3 font-black uppercase tracking-widest text-zinc-400 text-center">Step</th>
                          <th className="px-4 py-3 font-black uppercase tracking-widest text-zinc-400 text-center">Status</th>
                        </tr>
                        <tr className="bg-zinc-50/30 dark:bg-zinc-900/30">
                          <th className="px-6 py-1.5" />
                          <th className="px-4 py-1.5" />
                          <th className="px-4 py-1.5" />
                          {["DE","DD","TEI","TEE","TDI","TDE","TEI1","TEE1","TDI1","TDE1","EST"].map(l => (
                            <th key={l} className="px-1 py-1.5 text-center text-orange-500/70 font-black">{l}</th>
                          ))}
                          <th className="px-4 py-1.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                        {todosItensFiltrados.map(({ modulo, row }) => {
                          if (row.kind === 'inspecao') {
                            const ins = row.ins;
                            return (
                              <tr key={ins.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors group">
                                <td className="px-6 py-3">
                                  <span
                                    onClick={() => setSelectedSchematic(ins)}
                                    className="block text-sm text-zinc-900 dark:text-zinc-50 font-black hover:text-orange-500 dark:hover:text-orange-400 hover:underline cursor-pointer transition-colors"
                                  >
                                    {ins.equipamentos?.placa}
                                    {(ins as any)._isPendingSync && (
                                      <span className="ml-2 inline-flex items-center text-[9px] text-amber-500 font-bold" title="Salvo offline">
                                        <RefreshCw size={9} className="animate-spin mr-1" />
                                        (Offline)
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[9px] text-zinc-400 block tracking-widest">{ins.km_atual || (ins as any).horimetro_registro || 0} {ins.km_atual ? 'KM' : 'H'}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase">{modulo}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-[10px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                                    {ins.data_inspecao.split('T')[0].split('-').slice(1, 3).reverse().join('/')}
                                  </span>
                                </td>
                                {POSICOES.map(pos => (
                                  <td key={pos} className="px-1 py-3 text-center">
                                    {ins[pos] != null
                                      ? <span className={`inline-block w-8 py-1.5 rounded-lg border-b-2 text-center shadow-sm ${sulcoColor(ins[pos])}`}>{ins[pos]}</span>
                                      : <span className="text-zinc-200 dark:text-zinc-800 opacity-20">••</span>
                                    }
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest border ${
                                    ins.condicao === 'BOM' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                                    ins.condicao === 'ATENCAO' || ins.condicao === 'REGULAR' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-400 dark:border-yellow-900/30' :
                                    ins.condicao === 'CRITICO' ? 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-400 dark:border-orange-900/30' :
                                    'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-400 dark:border-red-900/30'
                                  }`}>
                                    {ins.condicao}
                                  </span>
                                </td>
                              </tr>
                            );
                          } else {
                            // PENDENTE row - vehicle with no inspection in this period
                            return (
                              <tr key={`pendente-${row.eq.id}`} className="bg-zinc-50/30 dark:bg-zinc-900/20 border-l-2 border-dashed border-zinc-300 dark:border-zinc-700 opacity-70">
                                <td className="px-6 py-3">
                                  <span
                                    onClick={() => setSelectedSchematic({
                                      id: `pendente-${row.eq.id}`,
                                      equipamento_id: row.eq.id,
                                      data_inspecao: new Date().toISOString(),
                                      km_atual: null,
                                      de: null, dd: null, tei: null, tee: null, tdi: null, tde: null, tei1: null, tee1: null, tdi1: null, tde1: null, estepe: null,
                                      condicao: "PENDENTE",
                                      equipamentos: {
                                        placa: row.eq.placa,
                                        tipo: row.eq.tipo,
                                        modulo: row.eq.modulo,
                                        categoria: row.eq.categoria
                                      }
                                    })}
                                    className="block text-sm text-zinc-500 dark:text-zinc-400 font-black hover:text-orange-500 dark:hover:text-orange-400 hover:underline cursor-pointer transition-colors"
                                  >
                                    {row.eq.placa}
                                  </span>
                                  {(() => {
                                    const dias = diasSemBoletimPorEquipamento[row.eq.id] ?? null;
                                    const atrasada = dias === null || dias > LIMITE_DIAS_BOLETIM;
                                    const texto = dias == null ? "nunca teve boletim" : `${dias} dia${dias !== 1 ? "s" : ""} sem boletim`;
                                    return (
                                      <span className={`text-[9px] block tracking-widest italic ${atrasada ? "text-red-500 dark:text-red-400 not-italic font-black" : "text-zinc-300 dark:text-zinc-600"}`}>
                                        {texto}
                                      </span>
                                    );
                                  })()}
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-600 uppercase">{modulo}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="text-[10px] font-black text-zinc-300 dark:text-zinc-700">—</span>
                                </td>
                                {POSICOES.map(pos => (
                                  <td key={pos} className="px-1 py-3 text-center">
                                    <span className="inline-block w-8 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700 text-zinc-200 dark:text-zinc-700 text-center">—</span>
                                  </td>
                                ))}
                                <td className="px-4 py-3 text-center">
                                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500">
                                    PENDENTE
                                  </span>
                                </td>
                              </tr>
                            );
                          }
                        })}
                        {todosItensFiltrados.length === 0 && (
                          <tr>
                            <td colSpan={15} className="px-6 py-10 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                              Nenhum veículo encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      {/* Footer Summary */}
                      <tfoot>
                        <tr className="bg-zinc-50/80 dark:bg-zinc-900/60 border-t-2 border-zinc-100 dark:border-zinc-800">
                          <td className="px-6 py-2 text-[9px] font-black text-zinc-400 uppercase tracking-widest" colSpan={3}>
                            Resumo ({items.length} veículos)
                          </td>
                          <td colSpan={12} className="px-4 py-2">
                            <div className="flex gap-2 flex-wrap">
                              {Object.entries(modCounts).filter(([,v]) => v > 0).map(([lbl, v]) => (
                                <span key={lbl} className={`px-2 py-0.5 text-[8px] font-black rounded-full uppercase ${
                                  lbl === 'BOM' ? 'bg-emerald-100 text-emerald-700' :
                                  lbl === 'ATENCAO' || lbl === 'REGULAR' ? 'bg-yellow-100 text-yellow-700' :
                                  lbl === 'CRITICO' ? 'bg-orange-100 text-orange-700' :
                                  lbl === 'TROCAR' ? 'bg-red-100 text-red-700' :
                                  'bg-zinc-100 text-zinc-500'
                                }`}>
                                  {v} {lbl} ({Math.round((v/modTotal)*100)}%)
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Charts Row */}
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

          </div>
        )}

        {tab === "lista" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  {selectedIds.size > 0 && !isVisitante && (
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
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Registrado por</th>
                      <th colSpan={3} className="px-4 py-4 font-black uppercase text-zinc-400 text-right">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {latestByEq.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors group">
                        <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.has(ins.id)} onChange={() => toggleSelect(ins.id)} /></td>
                        <td className="px-4 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black">
                          <span
                            onClick={() => setSelectedSchematic(ins)}
                            className="hover:text-orange-500 dark:hover:text-orange-400 hover:underline cursor-pointer transition-colors"
                          >
                            {ins.equipamentos?.placa}
                          </span>
                          {ins._isPendingSync && (
                            <span className="ml-2 inline-flex items-center text-[9px] text-amber-500 font-bold" title="Salvo offline, aguardando conexão">
                              <RefreshCw size={9} className="animate-spin mr-1" />
                              (Offline)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{ins.km_atual || '??'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                        <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400">
                          {ins.registrado_por_nome || <span className="italic text-zinc-300 dark:text-zinc-700">—</span>}
                        </td>
                        <td className="px-4 py-4 text-right" colSpan={3}>
                           {!isVisitante && (
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => downloadBoletimPDF(ins)} className="p-2 text-zinc-400 hover:text-orange-500" title="Imprimir PDF"><Printer size={16} /></button>
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

        {tab === "sulcos" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between flex-wrap gap-2">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">Sulcos Detalhados por Posição — Último boletim de cada veículo</h4>
               <div className="flex gap-3 text-[9px] font-black uppercase tracking-widest text-zinc-400 px-2">
                 <span>D = Lado Direito</span>
                 <span>M = Meio</span>
                 <span>E = Lado Esquerdo</span>
               </div>
             </div>
             <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-zinc-400">Placa</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Data</th>
                      {POSICOES.map(p => (
                        <th key={p} className="px-2 py-4 font-black uppercase text-zinc-400 text-center">
                          {p}
                          <span className="block text-[8px] text-zinc-300 dark:text-zinc-700 normal-case font-bold">D/M/E</span>
                        </th>
                      ))}
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">Status</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Registrado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {todosLatestSulcos.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black align-top">
                          <span
                            onClick={() => setSelectedSchematic(ins)}
                            className="hover:text-orange-500 dark:hover:text-orange-400 hover:underline cursor-pointer transition-colors"
                          >
                            {ins.equipamentos?.placa}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-zinc-500 align-top">{fmtDate(ins.data_inspecao)}</td>
                        {POSICOES.map(p => (
                          <td key={p} className="px-2 py-3 text-center">
                            {renderSulcoTriple((ins as any)[`${p}_s1`], ins[p], (ins as any)[`${p}_s3`])}
                          </td>
                        ))}
                        <td className="px-4 py-4 text-center align-top">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                        <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400 align-top">
                          {ins.registrado_por_nome || <span className="italic text-zinc-300 dark:text-zinc-700">—</span>}
                        </td>
                      </tr>
                    ))}
                    {todosLatestSulcos.length === 0 && (
                      <tr>
                        <td colSpan={POSICOES.length + 4} className="px-6 py-10 text-center text-zinc-400 text-xs font-bold uppercase tracking-widest">
                          Nenhum boletim encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
             </div>
           </div>
        )}

        {tab === "historico" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">Histórico Completo de Inspeções</h4>
               {!isAdmin && (
                 <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 px-2">
                   Mostrando só os boletins que você registrou
                 </span>
               )}
             </div>
             <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-zinc-400">Placa</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Data</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">KM</th>
                      {POSICOES.map(p => <th key={p} className="px-2 py-4 font-black uppercase text-zinc-400 text-center">{p}</th>)}
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">Status</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Registrado por</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {historicoVisivel.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black">
                          <span
                            onClick={() => setSelectedSchematic(ins)}
                            className="hover:text-orange-500 dark:hover:text-orange-400 hover:underline cursor-pointer transition-colors"
                          >
                            {ins.equipamentos?.placa}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{ins.km_atual || '??'}</td>
                        {POSICOES.map(p => (
                           <td key={p} className="px-2 py-4 text-center">
                             <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${sulcoColor(ins[p])}`}>
                               {ins[p] || '-'}
                             </span>
                           </td>
                        ))}
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                        <td className="px-4 py-4 text-zinc-500 dark:text-zinc-400">
                          {ins.registrado_por_nome || <span className="italic text-zinc-300 dark:text-zinc-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}
      </div>
      </>
      )}

      {/* Modals */}
      <PneusModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipamentos={equipamentos.filter(e => isEquipamentoAtivo(e) && (tab === 'leves' ? isEquipamentoLeve(e) : isEquipamentoPesado(e)))}
        editData={editingItem}
        onSuccess={() => router.refresh()}
      />
      
      <PneusImportModal 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => router.refresh()}
      />

      {isAIReportOpen && (
        <PneusAIReport 
          inspecoes={inspecoes} 
          onClose={() => setIsAIReportOpen(false)} 
        />
      )}

      {selectedSchematic && (
        <PneuEsquemaModal
          inspecao={selectedSchematic}
          onClose={() => setSelectedSchematic(null)}
        />
      )}
    </div>
  );
}
