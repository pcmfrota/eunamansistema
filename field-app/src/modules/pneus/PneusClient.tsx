"use client";

import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { Download, Upload, Plus, Circle, ShieldAlert, AlertTriangle, Search, Printer, Eye, ChevronLeft, Filter, ChevronDown, ClipboardList, History, LayoutGrid, MoreVertical, Pencil, Trash2, BarChart2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
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
import { gerarFichaPneusPDF, gerarHtmlFichaPneus } from "./pdfBoletim";
import FichaPreviewModal from "@/components/FichaPreviewModal";
import {
  normalizarCondicaoPneu, sulcoTailwind, calcCondicaoPneu,
  CONDICAO_BADGE_CLASSES, CONDICAO_HEX, CONDICAO_LABEL,
} from "@/src/models/pneus";
import { ListRow, Card } from "../../ui/primitives/ListRow";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { StatTile } from "../../ui/primitives/StatTile";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";

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
// Faixa de sulco (mm) e cor/rótulo por condição — fonte única em src/models/pneus.ts:
// até 4mm crítico, 5-6mm recapagem, acima de 6mm bom.
function sulcoColor(v: number | null): string {
  return sulcoTailwind(v);
}

function condBadge(c: string) {
  return CONDICAO_BADGE_CLASSES[normalizarCondicaoPneu(c, "BOM")];
}

const COND_COLOR: Record<string, string> = CONDICAO_HEX;

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
  // Sem Next.js aqui: "router.refresh()" virou disparar o mesmo evento que o próprio
  // loadFromDb() já escuta (useEffect acima) — recarrega do IndexedDB local, que é o
  // que a navegação real faria de qualquer forma neste app offline-first.
  const router = { refresh: () => window.dispatchEvent(new CustomEvent("offline-sync-completed")) };
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
  // "TODOS" ou um dos rótulos dos cartões de KPI (BOM/RECAPAGEM/CRITICO/PENDENTE) —
  // clicar num cartão filtra a tabela de veículos abaixo por aquele status; clicar de novo limpa.
  const [condicaoFiltro, setCondicaoFiltro] = useState<string>("TODOS");
  const handleClickCondicao = (label: string) => {
    setCondicaoFiltro(prev => (prev === label ? "TODOS" : label));
  };
  const [selectedSchematic, setSelectedSchematic] = useState<Inspecao | null>(null);
  // Boletim aberto na pré-visualização da ficha (ver antes de baixar o PDF).
  const [previewInspecao, setPreviewInspecao] = useState<Inspecao | null>(null);
  const toast = useToast();
  // Item cujo menu de ações (ActionSheet) está aberto — substitui o antigo hover-reveal
  // de botões por linha (sem equivalente em toque).
  const [actionSheetItem, setActionSheetItem] = useState<Inspecao | null>(null);
  // Confirmação pendente (exclusão única ou em massa) — substitui window.confirm(), que
  // não tem equivalente nativo decente em mobile/WebView.
  const [pendingConfirm, setPendingConfirm] = useState<{ kind: "excluir" | "excluir-lote" } | null>(null);

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

    if (isOnline) {
      const res = await excluirInspecoesMassivo(Array.from(selectedIds));
      if (res && "error" in res) {
        toast.show(res.error, "error");
      } else {
        await localDb.deleteMany("pneus_inspecao", Array.from(selectedIds));
        window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
        setSelectedIds(new Set());
        toast.show("Registros excluídos.", "success");
      }
    } else {
      const idsArray = Array.from(selectedIds);
      await localDb.deleteMany("pneus_inspecao", idsArray);
      await localDb.addToQueue("pneu", "bulk_delete", idsArray);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
      setSelectedIds(new Set());
      toast.show("Exclusão em lote registrada localmente!", "success");
    }
  };

  const handleDelete = async (id: string) => {
    if (isOnline) {
      const res = await excluirInspecao(id);
      if (res && "error" in res) {
        toast.show(res.error, "error");
      } else {
        await localDb.delete("pneus_inspecao", id);
        window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
        toast.show("Registro excluído.", "success");
      }
    } else {
      await localDb.delete("pneus_inspecao", id);
      await localDb.addToQueue("pneu", "delete", id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-pneus_inspecao"));
      toast.show("Exclusão registrada localmente!", "success");
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
    const matchesStatus = !searchStatus || calcCondicaoPneu(i) === searchStatus;
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
    const c = { BOM: 0, RECAPAGEM: 0, CRITICO: 0, PENDENTE: 0 };
    items.forEach(row => {
      if (row.kind === 'pendente') { c.PENDENTE++; return; }
      c[calcCondicaoPneu(row.ins)]++;
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

    const counts = { BOM: 0, RECAPAGEM: 0, CRITICO: 0 };
    latest.forEach(ins => {
      counts[calcCondicaoPneu(ins)]++;
    });
    const pendentesCount = eqs.length - latest.length;
    const critList = latest.filter(i => calcCondicaoPneu(i) === 'CRITICO');
    const pieData = Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
    const latestDate = latest.length > 0
      ? latest.reduce((l, c) => (!l || c.data_inspecao > l ? c.data_inspecao : l), '')
      : null;
    // Média das 3 medições (Direito/Meio/Esquerdo) de cada posição — pro gráfico "Média de
    // Desgaste" mostrar o desgaste lateral, não só o meio que alimenta a condição geral.
    const avg = (vals: (number | null | undefined)[]) => {
      const nums = vals.filter((v): v is number => v != null);
      return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 : 0;
    };
    const pMedia = POSICOES.map(pos => ({
      pos: pos.toUpperCase(),
      mediaDir: avg(latest.map(i => (i as any)[`${pos}_s1`])),
      media: avg(latest.map(i => i[pos])),
      mediaEsq: avg(latest.map(i => (i as any)[`${pos}_s3`])),
    })).filter(d => d.media > 0 || d.mediaDir > 0 || d.mediaEsq > 0);

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
              : row.kind === 'inspecao' && calcCondicaoPneu(row.ins) === condicaoFiltro;
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
    const XLSXLib = XLSX;
    const rows = inspecoes.map(i => ({
      Placa: i.equipamentos?.placa, Data: fmtDate(i.data_inspecao), Km: i.km_atual, Condicao: CONDICAO_LABEL[calcCondicaoPneu(i)],
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
        toast.show("Erro ao salvar Excel: " + err.message, "error");
      }
    } else {
      XLSXLib.writeFile(wb, filename);
      toast.show("Planilha Excel gerada e baixada com sucesso!", "success");
    }
  };

   // Geração de PDF extraída pra app/pneus/pdfBoletim.ts — compartilhada com o PneusModal,
   // que oferece a ficha logo após o registro.
   const downloadBoletimPDF = (ins: Inspecao) => gerarFichaPneusPDF(ins);

  return (
    <div className="min-h-full">
      {/* ─── MENU DE CARDS (TELA INICIAL DO MÓDULO) ─── */}
      {tab === "menu" && (
        <div className="p-4 space-y-2.5">
          {!isVisitante && (
            <ListRow
              icon={<Plus size={18} />}
              title="Registrar"
              subtitle="Lançar um novo boletim de inspeção"
              onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            />
          )}
          <ListRow
            icon={<span className="text-base leading-none">🚛</span>}
            title="Boletim Pesados"
            subtitle="Painel e inspeções da frota pesada"
            onClick={() => handleSetTab("dashboard")}
          />
          <ListRow
            icon={<span className="text-base leading-none">🚗</span>}
            title="Boletim Leves"
            subtitle="Painel e inspeções da frota leve"
            onClick={() => handleSetTab("leves")}
          />
          <ListRow
            icon={<ClipboardList size={18} />}
            title="Lista"
            subtitle="Todas as inspeções em formato de lista"
            onClick={() => handleSetTab("lista")}
          />
          <ListRow
            icon={<LayoutGrid size={18} />}
            title="Sulcos Detalhados"
            subtitle="Medição por lado direito, meio e esquerdo"
            onClick={() => handleSetTab("sulcos")}
          />
          <ListRow
            icon={<History size={18} />}
            title="Histórico"
            subtitle="Ciclos e alterações já encerrados"
            onClick={() => handleSetTab("historico")}
          />
        </div>
      )}

      {/* ─── SUB-TELAS (com cabeçalho local de volta ao menu do módulo) ─── */}
      {tab !== "menu" && (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
            <button
              onClick={() => handleSetTab("menu")}
              aria-label="Voltar ao menu de Pneus"
              className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="flex-1 text-sm font-black text-zinc-50 truncate">
              {tab === "dashboard" ? "Boletim Pesados" :
               tab === "leves" ? "Boletim Leves" :
               tab === "lista" ? "Lista" :
               tab === "sulcos" ? "Sulcos Detalhados" : "Histórico"}
            </h2>
            <button
              onClick={() => setShowFiltros(v => !v)}
              aria-label="Filtros"
              className="relative flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <Filter size={18} />
              {(search || searchStatus) && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
              )}
            </button>
          </div>

          <div className="p-4 space-y-4 pb-24">

          {isVisitante && (
            <div className="flex items-center gap-2 px-4 py-3 bg-zinc-900 rounded-2xl text-zinc-400 text-xs font-bold border border-zinc-800">
              <ShieldAlert size={16} className="text-amber-500" />
              VISUALIZAÇÃO
            </div>
          )}

          {!isVisitante && (
            <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
              <button onClick={exportExcel} className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl" style={{ minHeight: "var(--tap-min)" }}>
                <Download size={14} /> Exportar
              </button>
              <button onClick={() => setIsImportOpen(true)} className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 rounded-xl" style={{ minHeight: "var(--tap-min)" }}>
                <Upload size={14} /> Importar
              </button>
              <button
                onClick={() => toast.show("Histórico da quinzena arquivado com sucesso. Iniciando novo ciclo...", "success")}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-xl"
                style={{ minHeight: "var(--tap-min)" }}
              >
                <Archive size={14} /> Fechar Ciclo
              </button>
            </div>
          )}

          {criticos.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold leading-snug">
                ALERTA: {criticos.length} pneus em estado crítico ou troca imediata detectados na frota.
              </span>
            </div>
          )}

          {showFiltros && (
            <Card className="p-4 space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="PLACA..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-100 outline-none"
                  style={{ minHeight: "var(--tap-min)" }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateInicio}
                  onChange={e => setDateInicio(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-zinc-300 outline-none"
                />
                <span className="text-zinc-600 font-bold">—</span>
                <input
                  type="date"
                  value={dateFim}
                  onChange={e => setDateFim(e.target.value)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-[11px] font-bold text-zinc-300 outline-none"
                />
              </div>
              <select
                value={searchStatus}
                onChange={e => setSearchStatus(e.target.value)}
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-300 outline-none"
                style={{ minHeight: "var(--tap-min)" }}
              >
                <option value="">TODOS STATUS</option>
                {Object.keys(counts).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {(search || searchStatus) && (
                <button
                  onClick={handleClearFilters}
                  className="w-full py-2.5 text-xs font-black text-red-400 uppercase tracking-widest active:bg-red-500/10 rounded-xl"
                >
                  Limpar filtros
                </button>
              )}
            </Card>
          )}

          <div className="flex flex-col gap-6">

            {(tab === "dashboard" || tab === "leves") && (
              <div className="space-y-4">

                <button
                  onClick={() => setIsAIReportOpen(true)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-2xl text-sm font-black uppercase tracking-widest active:bg-amber-500/20"
                >
                  <Sparkles size={18} className="text-amber-500" />
                  Relatório IA
                </button>

                <div>
                  <h3 className="font-black text-zinc-100 tracking-tight text-base">
                    {tab === 'leves' ? '🚗 Painel — Carros Leves' : '🚛 Painel — Veículos Pesados'}
                  </h3>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1.5 mt-0.5">
                    <CalendarCheck size={12} className="text-emerald-500" />
                    Atualizado em {fmtDate(globalLatestDate)}
                  </p>
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
                  {modulosDisponiveis.map(mod => (
                    <button
                      key={mod}
                      onClick={() => setModuloFiltro(mod)}
                      className={cn(
                        "shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border",
                        moduloFiltro === mod
                          ? "bg-amber-500 text-zinc-950 border-amber-500"
                          : "bg-zinc-900 text-zinc-400 border-zinc-800"
                      )}
                    >
                      {mod}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleClickCondicao('PENDENTE')}
                    className={cn(
                      "shrink-0 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl border border-dashed",
                      condicaoFiltro === 'PENDENTE'
                        ? "bg-zinc-300 text-zinc-900 border-zinc-300"
                        : "bg-zinc-900 text-zinc-400 border-zinc-700"
                    )}
                  >
                    Pendentes
                  </button>
                </div>

                <Card className="p-3 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-black uppercase tracking-tight text-zinc-400">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Bom</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Recapagem</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Crítico</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-500" /> Pendente</span>
                </Card>

                {/* Aviso: placas há mais de LIMITE_DIAS_BOLETIM dias sem nenhum boletim (independe
                    do período selecionado nos filtros de data acima — usa o histórico real). */}
                {atrasados15d.length > 0 && (
                  <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-900/60 bg-red-950/20">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-wide text-red-400">
                        {atrasados15d.length} placa{atrasados15d.length !== 1 ? "s" : ""} há mais de {LIMITE_DIAS_BOLETIM} dias sem boletim
                      </p>
                      <p className="text-[11px] font-semibold text-red-400/80 mt-1 break-words">
                        {atrasados15d.map(({ eq, dias }) => `${eq.placa} (${dias == null ? "nunca teve boletim" : `${dias}d`})`).join(" · ")}
                      </p>
                    </div>
                  </div>
                )}

                {/* Global KPI Cards — toque num cartão pra filtrar a lista abaixo por aquele status; toque de novo pra limpar */}
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(counts).map(([label, val]) => {
                    const isActive = condicaoFiltro === label;
                    const accent = label === 'BOM' ? 'text-emerald-500 bg-emerald-500/10' : label === 'RECAPAGEM' ? 'text-yellow-400 bg-yellow-400/10' : 'text-red-500 bg-red-500/10';
                    return (
                      <button
                        type="button"
                        key={label}
                        onClick={() => handleClickCondicao(label)}
                        className={cn(
                          "text-left p-3.5 rounded-2xl border bg-zinc-900",
                          isActive ? "border-amber-500 ring-2 ring-amber-500/30" : "border-zinc-800"
                        )}
                      >
                        <span className={cn("inline-flex p-2 rounded-xl mb-2", accent)}>
                          <Circle size={16} fill="currentColor" fillOpacity={0.2} />
                        </span>
                        <div className="text-xl font-black text-zinc-50">{val}</div>
                        <p className="text-[9px] font-bold text-zinc-500 mt-0.5 uppercase">{label} · {Math.round((val/total)*100)}%</p>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleClickCondicao('PENDENTE')}
                    className={cn(
                      "text-left p-3.5 rounded-2xl border border-dashed bg-zinc-900",
                      condicaoFiltro === 'PENDENTE' ? "border-amber-500 ring-2 ring-amber-500/30" : "border-zinc-700"
                    )}
                  >
                    <span className="inline-flex p-2 rounded-xl mb-2 bg-zinc-800 text-zinc-500">
                      <Circle size={16} className="opacity-40" />
                    </span>
                    <div className="text-xl font-black text-zinc-400">{pendentesTotal}</div>
                    <p className="text-[9px] font-bold text-zinc-500 mt-0.5 uppercase">Pendente · sem boletim</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClickCondicao('ATRASADO_15D')}
                    className={cn(
                      "text-left p-3.5 rounded-2xl border bg-zinc-900",
                      condicaoFiltro === 'ATRASADO_15D' ? "border-red-500 ring-2 ring-red-500/30" : "border-red-900/50"
                    )}
                  >
                    <span className="inline-flex p-2 rounded-xl mb-2 bg-red-500/10 text-red-500">
                      <AlertTriangle size={16} />
                    </span>
                    <div className="text-xl font-black text-red-400">{atrasados15d.length}</div>
                    <p className="text-[9px] font-bold text-red-500/80 mt-0.5 uppercase">Atrasadas · +{LIMITE_DIAS_BOLETIM}d</p>
                  </button>
                </div>

                {/* Lista de veículos (respeitando o filtro de módulo/status acima) — toque numa
                    placa abre o esquema completo com os 3 pontos de medição por posição. */}
                {(() => {
                  const items = todosItensFiltrados.map(x => x.row);
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          Veículos{moduloFiltro !== 'TODOS' ? ` · ${moduloFiltro}` : ''} ({items.length})
                        </h4>
                        {condicaoFiltro !== 'TODOS' && (
                          <button
                            type="button"
                            onClick={() => setCondicaoFiltro('TODOS')}
                            className="flex items-center gap-1 px-2 py-1 bg-amber-500/15 text-amber-400 rounded-full text-[9px] font-black uppercase tracking-widest"
                          >
                            {condicaoFiltro} ✕
                          </button>
                        )}
                      </div>
                      {items.length === 0 && (
                        <EmptyState icon={Circle} title="Nenhum veículo encontrado" />
                      )}
                      {todosItensFiltrados.map(({ modulo, row }) => {
                        if (row.kind === 'inspecao') {
                          const ins = row.ins;
                          return (
                            <ListRow
                              key={ins.id}
                              title={ins.equipamentos?.placa || '—'}
                              subtitle={`${modulo} · ${fmtDate(ins.data_inspecao)}${ins.km_atual ? ` · ${ins.km_atual} km` : ''}`}
                              meta={(ins as any)._isPendingSync ? "Salvo offline" : undefined}
                              badge={
                                <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border", condBadge(calcCondicaoPneu(ins)))}>
                                  {CONDICAO_LABEL[calcCondicaoPneu(ins)]}
                                </span>
                              }
                              onClick={() => setSelectedSchematic(ins)}
                              rightSlot={<ChevronDown size={16} className="text-zinc-600 -rotate-90" />}
                            />
                          );
                        }
                        return (
                          <ListRow
                            key={`pendente-${row.eq.id}`}
                            title={row.eq.placa}
                            subtitle={modulo}
                            badge={
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border border-dashed border-zinc-700 bg-zinc-900 text-zinc-500">
                                PENDENTE
                              </span>
                            }
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
                            rightSlot={<ChevronDown size={16} className="text-zinc-700 -rotate-90" />}
                          />
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Charts */}
                <Card className="p-4">
                  <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">📊 Distribuição das Condições</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value" paddingAngle={5}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={COND_COLOR[entry.name]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', background: '#18181b', color: '#fafafa' }} itemStyle={{ fontWeight: 'bold' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="p-4">
                  <h3 className="font-bold text-zinc-200 text-xs uppercase tracking-wide mb-3 flex items-center gap-2">📈 Média de Desgaste (Sulcos)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={posMedia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3f3f46" opacity={0.5} />
                      <XAxis dataKey="pos" tick={{ fontSize: 8, fontWeight: 800, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#a1a1aa' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#27272a' }} contentStyle={{ borderRadius: '12px', border: 'none', background: '#18181b', color: '#fafafa' }} />
                      <Legend wrapperStyle={{ fontSize: 9, fontWeight: 700 }} />
                      <Bar dataKey="mediaDir" name="Direito" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={10} />
                      <Bar dataKey="media" name="Meio" fill="#f97316" radius={[4, 4, 0, 0]} barSize={10} />
                      <Bar dataKey="mediaEsq" name="Esquerdo" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

              </div>
            )}

        {tab === "lista" && (
          <div className="space-y-2">
            {!isVisitante && (
              <label className="flex items-center gap-2 px-1 text-xs font-bold text-zinc-400">
                <input type="checkbox" onChange={toggleSelectAll} checked={inspecoes.length > 0 && selectedIds.size === inspecoes.length} />
                Selecionar todos ({inspecoes.length})
              </label>
            )}
            {selectedIds.size > 0 && !isVisitante && (
              <div className="sticky top-[52px] z-10 flex items-center justify-between px-3 py-2.5 bg-amber-500/15 border border-amber-500/30 rounded-xl">
                <span className="text-xs font-black text-amber-400">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
                <button onClick={() => setPendingConfirm({ kind: "excluir-lote" })} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase">
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            )}
            {latestByEq.length === 0 && <EmptyState icon={ClipboardList} title="Nenhuma inspeção encontrada" />}
            {latestByEq.map(ins => (
              <ListRow
                key={ins.id}
                icon={!isVisitante ? (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(ins.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSelect(ins.id); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : undefined}
                title={ins.equipamentos?.placa || '—'}
                subtitle={`${fmtDate(ins.data_inspecao)}${ins.km_atual ? ` · ${ins.km_atual} km` : ''}${ins.registrado_por_nome ? ` · ${ins.registrado_por_nome}` : ''}`}
                meta={ins._isPendingSync ? "Salvo offline, aguardando conexão" : undefined}
                badge={
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border", condBadge(calcCondicaoPneu(ins)))}>
                    {CONDICAO_LABEL[calcCondicaoPneu(ins)]}
                  </span>
                }
                onClick={() => (isVisitante ? setSelectedSchematic(ins) : setActionSheetItem(ins))}
                rightSlot={!isVisitante ? <MoreVertical size={18} className="text-zinc-500" /> : undefined}
              />
            ))}
          </div>
        )}

        {tab === "sulcos" && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
              Toque numa placa pra ver os 3 pontos de medição (direito/meio/esquerdo) de cada posição
            </p>
            {todosLatestSulcos.length === 0 && <EmptyState icon={LayoutGrid} title="Nenhum boletim encontrado" />}
            {todosLatestSulcos.map(ins => (
              <ListRow
                key={ins.id}
                title={ins.equipamentos?.placa || '—'}
                subtitle={`${fmtDate(ins.data_inspecao)}${ins.registrado_por_nome ? ` · ${ins.registrado_por_nome}` : ''}`}
                badge={
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border", condBadge(calcCondicaoPneu(ins)))}>
                    {CONDICAO_LABEL[calcCondicaoPneu(ins)]}
                  </span>
                }
                onClick={() => setSelectedSchematic(ins)}
                rightSlot={<ChevronDown size={16} className="text-zinc-600 -rotate-90" />}
              />
            ))}
          </div>
        )}

        {tab === "historico" && (
          <div className="space-y-2">
            {!isAdmin && (
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-1">
                Mostrando só os boletins que você registrou
              </p>
            )}
            {historicoVisivel.length === 0 && <EmptyState icon={History} title="Nenhum boletim encontrado" />}
            {historicoVisivel.map(ins => (
              <ListRow
                key={ins.id}
                title={ins.equipamentos?.placa || '—'}
                subtitle={`${fmtDate(ins.data_inspecao)}${ins.km_atual ? ` · ${ins.km_atual} km` : ''}${ins.registrado_por_nome ? ` · ${ins.registrado_por_nome}` : ''}`}
                badge={
                  <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0 border", condBadge(calcCondicaoPneu(ins)))}>
                    {CONDICAO_LABEL[calcCondicaoPneu(ins)]}
                  </span>
                }
                onClick={() => setSelectedSchematic(ins)}
                rightSlot={<ChevronDown size={16} className="text-zinc-600 -rotate-90" />}
              />
            ))}
          </div>
        )}
          </div>
          </div>
        </>
      )}

      {!isVisitante && tab !== "menu" && (
        <Fab onClick={() => { setEditingItem(null); setIsModalOpen(true); }} icon={<Plus size={20} />} label="Registrar" />
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

      {previewInspecao && (
        <FichaPreviewModal
          html={gerarHtmlFichaPneus(previewInspecao)}
          onClose={() => setPreviewInspecao(null)}
          onDownload={() => downloadBoletimPDF(previewInspecao)}
          onShare={() => gerarFichaPneusPDF(previewInspecao, 'share')}
        />
      )}

      <ActionSheet
        open={!!actionSheetItem}
        onClose={() => setActionSheetItem(null)}
        title={actionSheetItem?.equipamentos?.placa}
        items={actionSheetItem ? [
          { key: "ver", label: "Ver Ficha", icon: Eye, onSelect: () => setPreviewInspecao(actionSheetItem) },
          { key: "pdf", label: "Baixar PDF", icon: Printer, onSelect: () => downloadBoletimPDF(actionSheetItem) },
          { key: "editar", label: "Editar", icon: Pencil, onSelect: () => { setEditingItem(actionSheetItem); setIsModalOpen(true); } },
          { key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setPendingConfirm({ kind: "excluir" }) },
        ] as ActionSheetItem[] : []}
      />

      <ConfirmDialog
        open={!!pendingConfirm}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => {
          if (pendingConfirm?.kind === "excluir" && actionSheetItem) handleDelete(actionSheetItem.id);
          if (pendingConfirm?.kind === "excluir-lote") handleBatchDelete();
        }}
        title={pendingConfirm?.kind === "excluir-lote" ? `Excluir ${selectedIds.size} registros?` : "Excluir boletim?"}
        description="Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        destructive
      />
    </div>
  );
}
