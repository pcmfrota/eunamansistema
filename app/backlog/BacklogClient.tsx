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
  BarChart3,
  Sparkles,
  History,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  CheckCircle2
} from 'lucide-react';
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { useAuth } from '@/components/auth-context';
import { getBacklog, deleteBacklogItems, getSolicitacoesExclusaoBacklog, gerarOSDeBacklog, getBacklogHistorico, encerrarBacklogsEmMassa } from './actions';
import type { HistoricoBacklog, AcaoHistoricoBacklog } from '@/lib/backlog-historico';
import { nomeSistema, nomeSubsistema, nomeComponente } from './classificacaoTecnica';
import BacklogModal from './BacklogModal';
import BacklogQuickView from './BacklogQuickView';
import BacklogTable from './BacklogTable';
import BacklogImportModal from './BacklogImportModal';
import BacklogAIImportModal from './BacklogAIImportModal';
import BacklogDashboard from './BacklogDashboard';
import BacklogSolicitarExclusaoModal from './BacklogSolicitarExclusaoModal';
import BacklogSolicitacoesExclusao from './BacklogSolicitacoesExclusao';
import OSFichaModal, { type OSFichaData } from '@/app/os/OSFicha';
import { PremiumLoader } from '@/components/premium-loader';
import { useOffline } from '@/components/offline-provider';
import { localDb } from '@/lib/offline-db';
import { mesAnoOperacional } from '@/lib/calendario-suzano';

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

export default function BacklogClient({ placas, colaboradores, calendario = [] }: { placas: Placa[], colaboradores: Colaborador[], calendario?: any[] }) {
  const { profile, isAdmin } = useAuth();
  const isVisitante = profile?.role === 'visitante';
  const { isOnline } = useOffline();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'Geral' | 'Dashboard' | 'Detalhamento' | 'Solicitacoes' | 'Historico'>('Dashboard');

  // Gerar O.S. a partir de itens de backlog selecionados
  const [fichaOS, setFichaOS] = useState<OSFichaData | null>(null);
  const [gerandoOS, setGerandoOS] = useState(false);
  const [fechandoSelecao, setFechandoSelecao] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [quickViewItem, setQuickViewItem] = useState<any>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);

  // Solicitação de Exclusão (usuários não-admin) + Aba de revisão (admin)
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

  // Histórico (quem criou/editou/excluiu cada item) — carregado sob demanda na
  // primeira vez que a aba é aberta, igual ao Controle de Custos.
  const [historico, setHistorico] = useState<HistoricoBacklog[] | null>(null);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [buscaHistorico, setBuscaHistorico] = useState("");
  const [filtroAcaoHistorico, setFiltroAcaoHistorico] = useState<string>("");
  const [linhaExpandidaHistorico, setLinhaExpandidaHistorico] = useState<string | null>(null);

  useEffect(() => {
    if (view !== 'Historico' || historico !== null || historicoCarregando) return;
    setHistoricoCarregando(true);
    getBacklogHistorico()
      .then((data) => setHistorico(data))
      .catch(() => setHistorico([]))
      .finally(() => setHistoricoCarregando(false));
  }, [view, historico, historicoCarregando]);

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
    setQuickViewItem(null);
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleQuickView = (item: any) => {
    setQuickViewItem(item);
  };

  const performDelete = async (idsArray: string[]) => {
    if (isOnline) {
      const res = await deleteBacklogItems(idsArray);
      if (res.success) {
        await localDb.deleteMany("backlog", idsArray);
        window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
      } else {
        alert(res.error);
      }
    } else {
      await localDb.deleteMany("backlog", idsArray);
      await localDb.addToQueue('backlog', 'delete', idsArray);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
    }
  };

  const handleDelete = async (id: string) => {
    // Administrador exclui diretamente; os demais perfis precisam solicitar a exclusão
    // e aguardar a aprovação do administrador (aba "Solicitação de Exclusão").
    if (!isAdmin) {
      if (!isOnline) {
        alert("É necessário estar online para solicitar a exclusão de um item do backlog.");
        return;
      }
      const item = items.find(i => i.id === id);
      setDeleteRequestItems(item ? [item] : [{ id }]);
      return;
    }
    if (!confirm("Confirmar exclusão definitiva deste item?")) return;
    await performDelete([id]);
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    const idsArray = Array.from(selectedIds);

    if (!isAdmin) {
      if (!isOnline) {
        alert("É necessário estar online para solicitar a exclusão de itens do backlog.");
        return;
      }
      const selectedItems = items.filter(i => idsArray.includes(i.id));
      setDeleteRequestItems(selectedItems);
      return;
    }

    if (!confirm(`Confirmar exclusão de ${selectedIds.size} itens?`)) return;
    await performDelete(idsArray);
    setSelectedIds(new Set());
  };

  const selectedItems = React.useMemo(
    () => items.filter(i => selectedIds.has(i.id)),
    [items, selectedIds]
  );
  const selectedPlacas = React.useMemo(
    () => new Set(selectedItems.map(i => i.frota).filter(Boolean)),
    [selectedItems]
  );

  const handleGerarOS = async () => {
    if (selectedItems.length === 0) return;
    if (!isOnline) {
      alert("É necessário estar online para gerar a O.S.");
      return;
    }
    if (selectedPlacas.size !== 1) {
      alert("Selecione itens de uma única placa para gerar a O.S.");
      return;
    }
    const placa = Array.from(selectedPlacas)[0];
    if (!confirm(`Gerar uma Ordem de Serviço com os ${selectedItems.length} itens de backlog selecionados da placa ${placa}?`)) return;

    setGerandoOS(true);
    try {
      const res: any = await gerarOSDeBacklog(Array.from(selectedIds));
      if (res?.error) {
        alert(res.error);
        return;
      }
      setFichaOS(res.data as OSFichaData);
      setSelectedIds(new Set());
      refreshData();
    } finally {
      setGerandoOS(false);
    }
  };

  const handleFecharSelecionados = async () => {
    if (selectedIds.size === 0) return;
    if (!isOnline) {
      alert("É necessário estar online para encerrar itens do backlog.");
      return;
    }
    if (!confirm(`Confirmar o encerramento de ${selectedIds.size} item(ns) do backlog?`)) return;

    setFechandoSelecao(true);
    try {
      const hoje = new Date().toISOString().slice(0, 10);
      const res: any = await encerrarBacklogsEmMassa(Array.from(selectedIds), hoje);
      if (res?.error) {
        alert(res.error);
        return;
      }
      setSelectedIds(new Set());
      refreshData();
    } finally {
      setFechandoSelecao(false);
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
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [filterCriticidade, setFilterCriticidade] = useState("");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [filterMes, setFilterMes] = useState(defaultMonthName);
  const [filterAno, setFilterAno] = useState(defaultYearString);

  const hasActiveFilters = search || filterPlaca || filterModulo || filterArea || filterStatuses.length > 0 || filterCriticidade || filterDataInicio || filterDataFim || filterMes !== defaultMonthName || filterAno !== defaultYearString;

  const clearFilters = () => {
    setSearch("");
    setFilterPlaca("");
    setFilterModulo("");
    setFilterArea("");
    setFilterStatuses([]);
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

      const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(i.status);
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
  }, [items, search, filterPlaca, filterModulo, filterArea, filterStatuses, filterCriticidade, filterDataInicio, filterDataFim, filterMes, filterAno, localPlacas, calendario]);

  const exportToExcel = () => {
    const fmtData = (d: string | null | undefined) => d ? d.split('T')[0].split('-').reverse().join('/') : '';

    // Nunca exportar o objeto bruto do backlog: ele carrega "evidencia_imagem" (foto em
    // base64, às vezes centenas de KB por linha), que estoura o limite de 32.767 caracteres
    // por célula do Excel e corrompe/trava a geração do arquivo. Monta linhas explícitas,
    // só com os campos legíveis — e a partir do que está filtrado na tela, não tudo.
    const exportRows = filteredItems.map(item => ({
      'Frota': item.frota || '',
      'Módulo': item.modulo || '',
      'Status': item.status || '',
      'Status Programação': item.status_programacao || '',
      'Criticidade': item.criticidade || '',
      'Tipo': item.tipo || '',
      'TAG': item.tag || '',
      'Descrição': item.descricao || '',
      'Origem': item.origem || '',
      'Colaborador': item.colaborador || '',
      'Campo/Base': item.campo_base || '',
      'Sistema': item.sistema_cod ? `${item.sistema_cod} – ${nomeSistema(Number(item.sistema_cod))}` : '',
      'Subsistema': item.subsistema_cod ? `${item.subsistema_cod} – ${nomeSubsistema(Number(item.subsistema_cod))}` : '',
      'Componente': item.componente_cod ? `${item.componente_cod} – ${nomeComponente(Number(item.componente_cod))}` : '',
      'Data de Evidência': fmtData(item.data_evidencia),
      'Nº RC': item.nr_rc || '',
      'Situação RC': item.situacao_rc || '',
      'Data da RC': fmtData(item.data_rc),
      'Data Necessidade Material': fmtData(item.data_nec_material),
      'Previsão do Material': item.previsao_material || '',
      'Material': item.material || '',
      'Fornecedor': item.fornecedor || '',
      'Nº Ordem': item.nr_ordem || '',
      'Detalhamento do Pedido': item.detalhamento || '',
      'Previsão Programação': fmtData(item.data_programacao),
      'Previsão Conclusão': fmtData(item.previsao_conclusao),
      'Data de Conclusão': fmtData(item.data_conclusao),
      'Mão de Obra': item.mao_obra || '',
      'Tempo Estimado': item.tempo_execucao || '',
      'Observação': item.observacao || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Backlog");
    XLSX.writeFile(wb, "EUNAMAN_Backlog.xlsx");
  };

  // ── Histórico: labels, formatação e diff (mesmo padrão do Controle de Custos) ──
  const ACAO_LABEL: Record<AcaoHistoricoBacklog, string> = { CRIACAO: "Criação", EDICAO: "Edição", EXCLUSAO: "Exclusão" };
  const ACAO_BADGE: Record<AcaoHistoricoBacklog, string> = {
    CRIACAO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    EDICAO: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    EXCLUSAO: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };

  const CAMPO_LABEL: Record<string, string> = {
    data_evidencia: "Data de Evidência", status: "Status", criticidade: "Criticidade",
    modulo: "Módulo", regiao_programa: "Região x Programação", frota: "Frota", tag: "TAG",
    tipo: "Tipo", descricao: "Descrição", origem: "Origem", colaborador: "Colaborador",
    tempo_execucao: "Tempo Estimado", campo_base: "Campo / Base", os: "Nº O.S", material: "Material",
    nr_rc: "Nº RC", nr_ordem: "Nº Ordem", fornecedor: "Fornecedor", detalhamento: "Detalhamento do Pedido",
    data_rc: "Data da RC", data_nec_material: "Data Necessidade Material", previsao_material: "Previsão do Material",
    situacao_rc: "Situação RC", data_programacao: "Previsão Programação", mao_obra: "Mão de Obra",
    status_programacao: "Status Programação", previsao_conclusao: "Previsão Conclusão",
    data_conclusao: "Data de Conclusão", observacao: "Observação",
    sistema_cod: "Sistema", subsistema_cod: "Subsistema", componente_cod: "Componente",
  };
  const CAMPO_IGNORAR_HISTORICO = new Set([
    "id", "filial_id", "created_at", "_isPendingSync",
    "evidencia_imagens", "evidencia_imagens_conclusao", "evidencia_imagem",
    "semana", "mes", "ano", "dias_abertura", "delta", "dias_resolucao",
  ]);

  function formatarValorHistorico(campo: string, valor: any): string {
    if (valor === null || valor === undefined || valor === "") return "-";
    if (["data_evidencia", "data_rc", "data_nec_material", "data_programacao", "data_conclusao"].includes(campo)) {
      const d = String(valor).split("T")[0];
      const partes = d.split("-");
      return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : String(valor);
    }
    if (campo === "sistema_cod") return `${valor} – ${nomeSistema(Number(valor))}`;
    if (campo === "subsistema_cod") return `${valor} – ${nomeSubsistema(Number(valor))}`;
    if (campo === "componente_cod") return `${valor} – ${nomeComponente(Number(valor))}`;
    if (campo === "criticidade") return valor === "A" ? "A - Crítico" : valor === "C" ? "C - Baixa" : "B - Normal";
    if (typeof valor === "boolean") return valor ? "Sim" : "Não";
    return String(valor);
  }

  function montarComparacaoHistorico(antes: any, depois: any) {
    const chaves = Array.from(new Set([...(antes ? Object.keys(antes) : []), ...(depois ? Object.keys(depois) : [])]))
      .filter((k) => !CAMPO_IGNORAR_HISTORICO.has(k));
    return chaves.map((campo) => {
      const valorAntes = antes ? antes[campo] : undefined;
      const valorDepois = depois ? depois[campo] : undefined;
      return {
        campo,
        label: CAMPO_LABEL[campo] || campo.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        antes: formatarValorHistorico(campo, valorAntes),
        depois: formatarValorHistorico(campo, valorDepois),
        mudou: !!(antes && depois) && String(valorAntes) !== String(valorDepois),
      };
    });
  }

  const historicoFiltrado = React.useMemo(() => {
    let lista = historico || [];
    if (filtroAcaoHistorico) lista = lista.filter((h) => h.acao === filtroAcaoHistorico);
    const term = buscaHistorico.toLowerCase().trim();
    if (term) {
      lista = lista.filter(
        (h) => h.descricao?.toLowerCase().includes(term) || h.usuario_nome?.toLowerCase().includes(term)
      );
    }
    return lista;
  }, [historico, filtroAcaoHistorico, buscaHistorico]);

  return (
    <div className="p-3 md:p-5 flex flex-col gap-4 w-full h-full animate-in fade-in duration-700">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-950 p-4 md:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xl relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -mr-32 -mt-32 group-hover:bg-indigo-500/10 transition-all duration-700" />
         
         <div className="flex items-center gap-6 relative z-10">
            <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-2xl shadow-indigo-500/40 scale-100 group-hover:scale-105 transition-all">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-zinc-900 dark:text-zinc-50 uppercase italic">Backlog Geral</h1>
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
                  onClick={() => setIsAIImportOpen(true)}
                  className="flex items-center gap-2.5 px-6 py-3.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 rounded-2xl hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-all shadow-sm"
                >
                   <Sparkles size={18} /> Lançar via Print
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
            {(['Geral', 'Dashboard', 'Detalhamento', 'Solicitacoes', 'Historico'] as const)
              .filter(v => v !== 'Solicitacoes' || isAdmin)
              .map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-6 py-2 text-[10px] font-black uppercase tracking-[0.15em] rounded-xl transition-all flex items-center gap-1.5",
                  view === v ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-lg" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                {v === 'Dashboard' && <BarChart3 size={12} />}
                {v === 'Solicitacoes' && <ShieldAlert size={12} />}
                {v === 'Historico' && <History size={12} />}
                {v === 'Solicitacoes' ? 'Solicitação de Exclusão' : v === 'Historico' ? 'Histórico' : v}
                {v === 'Solicitacoes' && pendentesCount > 0 && (
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[8px] leading-none">{pendentesCount}</span>
                )}
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
            {!isVisitante && (view === 'Geral' || view === 'Detalhamento') && filteredItems.length > 0 && (
              <button
                onClick={() => {
                  if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(filteredItems.map(i => i.id)));
                }}
                className={cn(
                  "flex items-center gap-2 px-4 py-3.5 text-[10px] font-black uppercase tracking-widest rounded-2xl border transition-all shadow-sm",
                  selectedIds.size === filteredItems.length
                    ? "bg-indigo-600 text-white border-indigo-500"
                    : "bg-white dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500/30"
                )}
              >
                {selectedIds.size === filteredItems.length
                  ? <CheckSquare size={16} />
                  : <Square size={16} />}
                {selectedIds.size === filteredItems.length ? 'Tudo Selecionado' : 'Selecionar Tudo'}
              </button>
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
        {(view === 'Geral' || view === 'Detalhamento') && (
          <div className="flex flex-col gap-4">
            {/* Search Input (Full Width) */}
            <div className="relative group w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                type="text"
                placeholder="BUSCAR POR FROTA OU DESCRIÇÃO..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-12 pr-6 py-3 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
              />
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Placa filter */}
              <select
                value={filterPlaca}
                onChange={e => setFilterPlaca(e.target.value)}
                className={cn(
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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

              {/* Status filter (multi-select) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStatusDropdown(v => !v)}
                  className={cn(
                    "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer w-full flex items-center justify-between gap-2",
                    filterStatuses.length > 0
                      ? "bg-indigo-600 text-white border-indigo-500"
                      : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                  )}
                >
                  <span className="truncate">
                    {filterStatuses.length === 0
                      ? "📋 TODOS OS STATUS"
                      : filterStatuses.length === 1
                      ? filterStatuses[0]
                      : `${filterStatuses.length} STATUS SEL.`}
                  </span>
                  <ChevronDown size={14} className="opacity-60 shrink-0" />
                </button>

                {showStatusDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowStatusDropdown(false)} />
                    <div className="absolute left-0 mt-2 w-full min-w-[180px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-3 shadow-2xl z-50 flex flex-col gap-2">
                      {statusOptions.map(status => {
                        const active = filterStatuses.includes(status);
                        return (
                          <label key={status} className="flex items-center gap-2.5 text-[10px] font-black text-zinc-600 dark:text-zinc-300 uppercase tracking-wider cursor-pointer hover:text-indigo-500 transition-colors">
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={() => {
                                if (active) setFilterStatuses(filterStatuses.filter(s => s !== status));
                                else setFilterStatuses([...filterStatuses, status]);
                              }}
                              className="w-3.5 h-3.5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            {status}
                          </label>
                        );
                      })}
                      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-2 mt-1 flex justify-between">
                        <button
                          type="button"
                          onClick={() => setFilterStatuses([])}
                          className="text-[8px] font-bold text-red-500 hover:underline uppercase"
                        >
                          Limpar
                        </button>
                        <button
                          type="button"
                          onClick={() => setFilterStatuses(statusOptions)}
                          className="text-[8px] font-bold text-indigo-500 hover:underline uppercase"
                        >
                          Todos
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Criticidade filter */}
              <select
                value={filterCriticidade}
                onChange={e => setFilterCriticidade(e.target.value)}
                className={cn(
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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
                  "px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border outline-none transition-all shadow-sm cursor-pointer appearance-none w-full",
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
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm w-full">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">De:</span>
                <input 
                  type="date" 
                  value={filterDataInicio} 
                  onChange={e => setFilterDataInicio(e.target.value)}
                  className="bg-transparent text-xs font-black text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer w-full text-right"
                />
              </div>

              {/* Data Fim */}
              <div className="flex items-center justify-between gap-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-4 py-2.5 shadow-sm w-full">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Até:</span>
                <input 
                  type="date" 
                  value={filterDataFim} 
                  onChange={e => setFilterDataFim(e.target.value)}
                  className="bg-transparent text-xs font-black text-zinc-600 dark:text-zinc-400 outline-none cursor-pointer w-full text-right"
                />
              </div>
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
        <BacklogDashboard items={items} placas={localPlacas} calendario={calendario} onEdit={handleEdit} onDelete={handleDelete} onQuickView={handleQuickView} />
      ) : view === 'Solicitacoes' ? (
        /* Solicitações de Exclusão (somente administrador) */
        <BacklogSolicitacoesExclusao requests={solicitacoes} loading={solicitacoesLoading} onRefresh={loadSolicitacoes} />
      ) : view === 'Historico' ? (
        /* Histórico: tudo que foi criado/editado/excluído e quem mexeu */
        <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                value={buscaHistorico}
                onChange={(e) => setBuscaHistorico(e.target.value)}
                placeholder="Buscar por descrição ou usuário..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:border-indigo-500"
              />
            </div>
            <select
              value={filtroAcaoHistorico}
              onChange={(e) => setFiltroAcaoHistorico(e.target.value)}
              className="px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none"
            >
              <option value="">Todas as Ações</option>
              <option value="CRIACAO">Criação</option>
              <option value="EDICAO">Edição</option>
              <option value="EXCLUSAO">Exclusão</option>
            </select>
          </div>

          {historicoCarregando ? (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <RefreshCcw className="animate-spin" size={24} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="text-[11px] uppercase">
                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Data/Hora</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">Ação</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Descrição</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">Usuário</th>
                    <th className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center w-16">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-700 dark:text-zinc-300 text-xs">
                  {historicoFiltrado.map((h, idx) => (
                    <React.Fragment key={h.id}>
                      <tr className={idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : ""}>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 whitespace-nowrap">
                          {new Date(h.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", ACAO_BADGE[h.acao])}>
                            {ACAO_LABEL[h.acao]}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800">{h.descricao || "-"}</td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 whitespace-nowrap">{h.usuario_nome || "Sistema"}</td>
                        <td className="px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-center">
                          {(h.dados_antes || h.dados_depois) && (
                            <button onClick={() => setLinhaExpandidaHistorico(linhaExpandidaHistorico === h.id ? null : h.id)} className="p-1 text-zinc-400 hover:text-indigo-600">
                              {linhaExpandidaHistorico === h.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          )}
                        </td>
                      </tr>
                      {linhaExpandidaHistorico === h.id && (
                        <tr>
                          <td colSpan={5} className="px-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60">
                            <div className="overflow-x-auto max-h-72 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                              <table className="w-full text-left border-collapse bg-white dark:bg-zinc-950">
                                <thead className="text-[10px] uppercase sticky top-0">
                                  <tr className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                                    <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Campo</th>
                                    {h.dados_antes && <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Antes</th>}
                                    {h.dados_depois && <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800">Depois</th>}
                                  </tr>
                                </thead>
                                <tbody className="text-[11px]">
                                  {montarComparacaoHistorico(h.dados_antes, h.dados_depois).map((linha) => (
                                    <tr key={linha.campo} className={linha.mudou ? "bg-amber-50 dark:bg-amber-900/10" : ""}>
                                      <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-semibold text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{linha.label}</td>
                                      {h.dados_antes && (
                                        <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400">{linha.antes}</td>
                                      )}
                                      {h.dados_depois && (
                                        <td className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-medium text-zinc-800 dark:text-zinc-100">{linha.depois}</td>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {historicoFiltrado.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500">Nenhum registro de histórico encontrado.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                     {selectedPlacas.size === 1 ? (
                       <button
                         onClick={handleGerarOS}
                         disabled={gerandoOS}
                         className="flex items-center gap-2 text-xs font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         <FileText size={18} /> {gerandoOS ? 'GERANDO...' : 'GERAR O.S.'}
                       </button>
                     ) : (
                       <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                         Selecione 1 placa p/ gerar O.S.
                       </span>
                     )}
                     <button
                       onClick={handleFecharSelecionados}
                       disabled={fechandoSelecao}
                       className="flex items-center gap-2 text-xs font-black text-emerald-400 hover:text-emerald-300 transition-colors uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       <CheckCircle2 size={18} /> {fechandoSelecao ? 'FECHANDO...' : 'FECHAR SELEÇÃO'}
                     </button>
                     <button onClick={handleBatchDelete} className="flex items-center gap-2 text-xs font-black text-red-400 hover:text-red-300 transition-colors uppercase tracking-widest">
                       <Plus size={18} className="rotate-45" /> {isAdmin ? 'EXCLUIR SELEÇÃO' : 'SOLICITAR EXCLUSÃO'}
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
              onQuickView={handleQuickView}
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
      <BacklogQuickView
        item={quickViewItem}
        onClose={() => setQuickViewItem(null)}
        onEdit={handleEdit}
      />

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

      <BacklogAIImportModal
        isOpen={isAIImportOpen}
        onClose={() => { setIsAIImportOpen(false); refreshData(); }}
      />

      <BacklogSolicitarExclusaoModal
        isOpen={!!deleteRequestItems}
        items={deleteRequestItems || []}
        onClose={() => { setDeleteRequestItems(null); setSelectedIds(new Set()); }}
        onSubmitted={() => { setSelectedIds(new Set()); loadSolicitacoes(); }}
      />

      {fichaOS && (
        <OSFichaModal os={fichaOS} onClose={() => setFichaOS(null)} />
      )}
    </div>
  );
}
