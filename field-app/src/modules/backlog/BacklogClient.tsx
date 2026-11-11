// @ts-nocheck
"use client";

// Port de app/backlog/BacklogClient.tsx pro app de campo, redesenhado na Fase 5 pro
// design nativo (ver plano). Uma feature fora do escopo original (Fase 2), mantida fora
// aqui também — ver comentário em ./actions.ts pro motivo:
// - "Lançar via Print" (BacklogAIImportModal, usa extrairPendenciasBacklogIA / Gemini).
// "Gerar O.S." a partir de itens selecionados FOI portada (Fase 6, módulo OS) — ver botão
// "Gerar OS" na barra de seleção em massa abaixo.
import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  Plus,
  Search,
  Filter,
  RefreshCcw,
  Layers,
  ShieldAlert,
  BarChart3,
  Hammer,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/components/auth-context';
import { getBacklog, deleteBacklogItems, gerarOSDeBacklog, getSolicitacoesExclusaoBacklog } from './actions';
import BacklogModal from './BacklogModal';
import BacklogTable from './BacklogTable';
import BacklogImportModal from './BacklogImportModal';
import BacklogDashboard from './BacklogDashboard';
import BacklogSolicitarExclusaoModal from './BacklogSolicitarExclusaoModal';
import BacklogSolicitacoesExclusao from './BacklogSolicitacoesExclusao';
import { PremiumLoader } from '@/components/premium-loader';
import { useOffline } from '@/components/offline-provider';
import { localDb } from '@/lib/offline-db';
import { mesAnoOperacional } from '@/lib/calendario-suzano';
import { Card } from '../../ui/primitives/ListRow';
import { SegmentedTabs } from '../../ui/primitives/SegmentedTabs';
import { BottomSheet } from '../../ui/primitives/BottomSheet';
import { ConfirmDialog } from '../../ui/primitives/ConfirmDialog';
import { Fab } from '../../ui/primitives/Fab';
import { useToast } from '../../ui/primitives/Toast';
import { getCurrentLocalDate } from '@/src/utils/dateUtils';

type Placa = {
  id: string;
  placa: string;
  modulo: string | null;
  area: string | null;
  categoria?: string | null;
  status?: string | null;
  created_at?: string | null;
  deleted_at?: string | null;
};
type Colaborador = { id: string; nome: string };

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export default function BacklogClient({ placas, colaboradores, calendario = [] }: { placas: Placa[], colaboradores: Colaborador[], calendario?: any[] }) {
  const { profile, isAdmin } = useAuth();
  const isVisitante = profile?.role === 'visitante';
  const { isOnline } = useOffline();
  const toast = useToast();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'Geral' | 'Dashboard' | 'Detalhamento' | 'Solicitacoes'>('Dashboard');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // ── Reabre a folha de Novo/Editar Lançamento sozinha se a Activity do Android foi
  // recriada (comum no MIUI mesmo com RAM de sobra, ao voltar da câmera nativa) —
  // confirmado em teste real: sem isso, os VALORES do formulário sobrevivem (useFormDraft,
  // dentro de BacklogModal.tsx, já persiste tudo sozinho, foto inclusive), mas a folha em
  // si fica fechada e o usuário cai de volta no Dashboard, parecendo que "o app esqueceu"
  // o que estava preenchendo — mesmo bug que o padrão de OSClient.tsx/CaptacaoClient.tsx
  // já resolve pros módulos deles, só que BacklogModal (Fase 5) nunca tinha ganhado essa
  // persistência porque usa o useFormDraft genérico (só guarda os VALORES, não se a folha
  // está aberta).
  const SHEET_OPEN_KEY = "eunaman_backlog_sheet_open";
  const EDITING_ID_KEY = "eunaman_backlog_editing_id";
  const hasRestoredModalRef = React.useRef(false);

  useEffect(() => {
    // Sem essa guarda, o próprio mount (isModalOpen ainda no valor inicial "false")
    // disparava este efeito ANTES do de restauração (mais abaixo, condicionado a items/
    // loading) conseguir ler a flag — apagando "true" um instante antes dele ser lido,
    // sempre perdendo a corrida. Confirmado em teste real no aparelho: a foto sobrevivia
    // no rascunho, mas a folha nunca reabria porque essa flag chegava sempre nula.
    if (!hasRestoredModalRef.current) return;
    if (isModalOpen) {
      localStorage.setItem(SHEET_OPEN_KEY, "true");
      if (editingItem?.id) localStorage.setItem(EDITING_ID_KEY, editingItem.id);
      else localStorage.removeItem(EDITING_ID_KEY);
    } else {
      localStorage.removeItem(SHEET_OPEN_KEY);
      localStorage.removeItem(EDITING_ID_KEY);
    }
  }, [isModalOpen, editingItem]);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [filtrosOpen, setFiltrosOpen] = useState(false);

  // Confirmação de exclusão (item único ou seleção em massa)
  const [pendingDelete, setPendingDelete] = useState<string[] | null>(null);

  const [deleteRequestItems, setDeleteRequestItems] = useState<any[] | null>(null);
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [solicitacoesLoading, setSolicitacoesLoading] = useState(false);
  const pendentesCount = React.useMemo(() => solicitacoes.filter(r => r.status === 'PENDENTE').length, [solicitacoes]);

  const loadSolicitacoes = React.useCallback(async () => {
    if (!isAdmin) return;
    setSolicitacoesLoading(true);
    try {
      const res: any = await getSolicitacoesExclusaoBacklog();
      if (res.error) {
        console.error("Erro ao carregar solicitações de exclusão:", res.error);
      } else {
        setSolicitacoes(res.data || []);
      }
    } finally {
      setSolicitacoesLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && isOnline) {
      loadSolicitacoes();
    }
  }, [isAdmin, isOnline, loadSolicitacoes]);

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
    let dbData: any[] = [];
    try {
      dbData = await localDb.getAll("backlog");
    } catch (err) {
      console.error("Erro ao ler backlog local do IndexedDB:", err);
    }
    const hasCache = dbData && dbData.length > 0;

    if (!hasCache) {
      setLoading(true);
    } else {
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

  useEffect(() => {
    if (hasRestoredModalRef.current) return;
    if (typeof window === "undefined") return;
    const wasOpen = localStorage.getItem(SHEET_OPEN_KEY) === "true";
    if (!wasOpen) {
      hasRestoredModalRef.current = true;
      return;
    }
    const editingId = localStorage.getItem(EDITING_ID_KEY);
    if (editingId) {
      // Só marca como restaurado quando os itens já carregaram (ou quando não há mais
      // o que esperar, offline sem cache) — senão o item buscado aqui embaixo pode vir
      // vazio só porque o IndexedDB ainda não respondeu.
      if (items.length === 0 && loading) return;
      const found = items.find((i) => i.id === editingId);
      if (found) setEditingItem(found);
    }
    setIsModalOpen(true);
    hasRestoredModalRef.current = true;
  }, [items, loading]);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const performDelete = async (idsArray: string[]) => {
    if (isOnline) {
      const res = await deleteBacklogItems(idsArray);
      if (res.success) {
        await localDb.deleteMany("backlog", idsArray);
        window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
      } else {
        toast.show(res.error, "error");
      }
    } else {
      await localDb.deleteMany("backlog", idsArray);
      await localDb.addToQueue('backlog', 'delete', idsArray);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
    }
  };

  const handleDelete = (id: string) => {
    // Administrador exclui diretamente; os demais perfis precisam solicitar a exclusão
    // e aguardar a aprovação do administrador (aba "Solicitação de Exclusão").
    if (!isAdmin) {
      if (!isOnline) {
        toast.show("É necessário estar online para solicitar a exclusão de um item do backlog.", "error");
        return;
      }
      const item = items.find(i => i.id === id);
      setDeleteRequestItems(item ? [item] : [{ id }]);
      return;
    }
    setPendingDelete([id]);
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);

    if (!isAdmin) {
      if (!isOnline) {
        toast.show("É necessário estar online para solicitar a exclusão de itens do backlog.", "error");
        return;
      }
      const selectedItems = items.filter(i => idsArray.includes(i.id));
      setDeleteRequestItems(selectedItems);
      return;
    }

    setPendingDelete(idsArray);
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    await performDelete(pendingDelete);
    setSelectedIds(new Set());
  };

  const [gerandoOS, setGerandoOS] = useState(false);
  const handleGerarOS = async () => {
    if (selectedIds.size === 0 || gerandoOS) return;
    if (!isOnline) {
      toast.show("É necessário estar online para gerar uma Ordem de Serviço.", "error");
      return;
    }
    setGerandoOS(true);
    try {
      const res = await gerarOSDeBacklog(Array.from(selectedIds));
      if (res?.error) {
        toast.show(res.error, "error");
        return;
      }
      toast.show(`OS ${res.data?.numero_os || ''} gerada com sucesso.`, "success");
      setSelectedIds(new Set());
      await refreshData();
    } finally {
      setGerandoOS(false);
    }
  };

  const currentPeriod = React.useMemo(() => {
    const today = getCurrentLocalDate();
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) return period;
    const now = new Date();
    return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
  }, [calendario]);

  const defaultMonthName = React.useMemo(() => MESES[Number(currentPeriod.mes) - 1] || 'janeiro', [currentPeriod]);
  const defaultYearString = React.useMemo(() => String(currentPeriod.ano), [currentPeriod]);

  const [filterPlaca, setFilterPlaca] = useState("");
  const [filterModulo, setFilterModulo] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCriticidade, setFilterCriticidade] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterMes, setFilterMes] = useState(defaultMonthName);
  const [filterAno, setFilterAno] = useState(defaultYearString);

  const hasActiveFilters = !!(filterPlaca || filterModulo || filterArea || filterStatus || filterCriticidade || filterDataInicio || filterDataFim || filterMes !== defaultMonthName || filterAno !== defaultYearString);

  const clearFilters = () => {
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

  const placaOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.frota).filter(Boolean))).sort(), [items]);
  const areaOptions = React.useMemo(() => Array.from(new Set(localPlacas.map(p => p.area).filter(Boolean))).sort(), [localPlacas]);
  const moduloOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.modulo).filter(Boolean))).sort(), [items]);
  const statusOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.status).filter(Boolean))).sort(), [items]);
  const criticidadeOptions = React.useMemo(() => Array.from(new Set(items.map(i => i.criticidade).filter(Boolean))).sort(), [items]);

  const anoOptions = React.useMemo(() => {
    const years = new Set<string>();
    items.forEach(i => {
      if (i.data_evidencia) {
        const { ano } = mesAnoOperacional(i.data_evidencia, calendario);
        if (ano) years.add(ano);
      } else if (i.ano) {
        years.add(String(i.ano));
      }
    });
    return Array.from(years).sort();
  }, [items, calendario]);

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
        const periodo = mesAnoOperacional(i.data_evidencia, calendario);
        itemMonth = periodo.mes;
        itemYear = periodo.ano;
      } else if (i.mes) {
        const mIdx = parseInt(i.mes) - 1;
        if (mIdx >= 0 && mIdx < 12) itemMonth = MESES[mIdx];
        if (i.ano) itemYear = String(i.ano);
      }

      if (filterMes && itemMonth !== filterMes) matchMonth = false;
      if (filterAno && itemYear !== filterAno) matchYear = false;

      return matchSearch && matchPlaca && matchModulo && matchArea && matchStatus && matchCriticidade && matchData && matchMonth && matchYear;
    });
  }, [items, search, filterPlaca, filterModulo, filterArea, filterStatus, filterCriticidade, filterDataInicio, filterDataFim, filterMes, filterAno, localPlacas, calendario]);

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backlog");
    XLSX.writeFile(wb, "EUNAMAN_Backlog.xlsx");
    toast.show("Planilha exportada.", "success");
  };

  const selectCls = "w-full px-3 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 outline-none";
  const labelCls = "block text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-1.5";

  const dataOntem = new Date(new Date().setDate(new Date().getDate() - 1)).toLocaleDateString('pt-BR');

  return (
    <div className="p-4 space-y-4 pb-28">
      {/* Cabeçalho compacto */}
      <Card className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
            <Layers size={12} className="text-indigo-500" /> PCM · Planejamento e Controle
          </p>
          <p className="text-[10px] font-bold text-emerald-400 mt-1">Dados até {dataOntem} (D+1)</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={exportToExcel}
            aria-label="Exportar"
            className="flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800"
            style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
          >
            <Download size={18} />
          </button>
          {!isVisitante && (
            <button
              onClick={() => setIsImportOpen(true)}
              aria-label="Importar"
              className="flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <Upload size={18} />
            </button>
          )}
          <button
            onClick={refreshData}
            disabled={loading || isRefreshing}
            aria-label="Atualizar"
            className="flex items-center justify-center rounded-xl text-zinc-400 active:bg-zinc-800 disabled:opacity-40"
            style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
          >
            <RefreshCcw size={18} className={loading || isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </Card>

      {isVisitante && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 rounded-xl text-zinc-400 text-[10px] font-black border border-zinc-800 uppercase tracking-widest">
          <ShieldAlert size={15} className="text-indigo-500" /> Modo de Leitura
        </div>
      )}

      <SegmentedTabs
        items={[
          { key: 'Dashboard', label: 'Dashboard' },
          { key: 'Geral', label: 'Geral' },
          { key: 'Detalhamento', label: 'Detalhamento' },
          ...(isAdmin ? [{ key: 'Solicitacoes', label: `Exclusões${pendentesCount > 0 ? ` (${pendentesCount})` : ''}` }] : []),
        ]}
        value={view}
        onChange={(v) => setView(v as any)}
      />

      {(view === 'Geral' || view === 'Detalhamento') && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por frota ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-bold text-zinc-100 outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-zinc-600"
              style={{ minHeight: "var(--tap-min)" }}
            />
          </div>
          <button
            onClick={() => setFiltrosOpen(true)}
            aria-label="Filtros"
            className="relative shrink-0 flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 active:bg-zinc-800"
            style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
          >
            <Filter size={18} />
            {hasActiveFilters && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500" />}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[300px] py-16">
          <PremiumLoader type="squares-sequential" text="Carregando Backlog" subtext="Calculando aging e criticidades..." />
        </div>
      ) : view === 'Dashboard' ? (
        <BacklogDashboard items={items} placas={localPlacas} calendario={calendario} onEdit={handleEdit} onDelete={handleDelete} />
      ) : view === 'Solicitacoes' ? (
        <BacklogSolicitacoesExclusao requests={solicitacoes} loading={solicitacoesLoading} onRefresh={loadSolicitacoes} />
      ) : (
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
      )}

      {/* Barra de seleção em massa — fixa acima da barra de navegação */}
      {selectedIds.size > 0 && !isVisitante && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-30 flex items-center gap-4 px-5 py-3 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl"
          style={{ bottom: "calc(var(--nav-bar-height) + var(--safe-bottom) + 12px)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xs">
              {selectedIds.size}
            </div>
            <span className="text-[10px] font-black text-zinc-300 uppercase">Selecionados</span>
          </div>
          <button onClick={handleGerarOS} disabled={gerandoOS} className="flex items-center gap-1 text-xs font-black text-sky-400 uppercase disabled:opacity-50">
            <Hammer size={13} /> {gerandoOS ? 'Gerando...' : 'Gerar OS'}
          </button>
          <button onClick={handleBatchDelete} className="text-xs font-black text-red-400 uppercase">
            {isAdmin ? 'Excluir' : 'Solicitar'}
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-xs font-black text-zinc-400 uppercase">
            Limpar
          </button>
        </div>
      )}

      {/* Ação principal */}
      {(view === 'Geral' || view === 'Detalhamento') && !isVisitante && (
        <Fab onClick={() => { setEditingItem(null); setIsModalOpen(true); }} icon={<Plus size={20} />} label="Adicionar" />
      )}

      {/* Filtros */}
      <BottomSheet open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtros">
        <div className="space-y-3 pb-2">
          <div>
            <label className={labelCls}>Placa</label>
            <select value={filterPlaca} onChange={e => setFilterPlaca(e.target.value)} className={selectCls}>
              <option value="">Todas as placas</option>
              {placaOptions.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Módulo</label>
            <select value={filterModulo} onChange={e => setFilterModulo(e.target.value)} className={selectCls}>
              <option value="">Todos os módulos</option>
              {moduloOptions.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Área</label>
            <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className={selectCls}>
              <option value="">Todas as áreas</option>
              {areaOptions.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
              <option value="">Todos os status</option>
              {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Criticidade</label>
            <select value={filterCriticidade} onChange={e => setFilterCriticidade(e.target.value)} className={selectCls}>
              <option value="">Toda criticidade</option>
              {criticidadeOptions.map(c => <option key={c} value={c}>{c === 'A' ? 'A - CRÍTICO' : 'B - NORMAL'}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mês</label>
              <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {MESES.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Ano</label>
              <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {anoOptions.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>De</label>
              <input type="date" value={filterDataInicio} onChange={e => setFilterDataInicio(e.target.value)} className={selectCls} />
            </div>
            <div>
              <label className={labelCls}>Até</label>
              <input type="date" value={filterDataFim} onChange={e => setFilterDataFim(e.target.value)} className={selectCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={clearFilters}
              className="flex-1 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800 active:bg-zinc-700"
              style={{ minHeight: "var(--tap-min)" }}
            >
              Limpar
            </button>
            <button
              onClick={() => setFiltrosOpen(false)}
              className="flex-1 rounded-xl text-xs font-black text-white bg-indigo-600 active:bg-indigo-700"
              style={{ minHeight: "var(--tap-min)" }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </BottomSheet>

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

      <BacklogSolicitarExclusaoModal
        isOpen={!!deleteRequestItems}
        items={deleteRequestItems || []}
        onClose={() => { setDeleteRequestItems(null); setSelectedIds(new Set()); }}
        onSubmitted={() => { setSelectedIds(new Set()); loadSolicitacoes(); }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmPendingDelete}
        title={pendingDelete && pendingDelete.length > 1 ? `Excluir ${pendingDelete.length} itens?` : "Excluir item do backlog?"}
        description="Essa exclusão é definitiva."
        confirmLabel="Excluir"
        destructive
      />
    </div>
  );
}
