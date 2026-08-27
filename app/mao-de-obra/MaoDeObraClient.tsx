"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Wrench,
  Plus,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  FileText,
  Printer,
  BarChart2,
  PenTool,
  Copy,
  Pencil,
  RefreshCcw,
  Lock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import FichaPDFModal, { FichaMaoObraItem, AtividadeJornada } from "./FichaPDFModal";
import { salvarFichaMaoObra, excluirFichaMaoObra, duplicarFichaMaoObra, reabrirJornada } from "./actions";
import { TIPOS_ATIVIDADE, isAtividadeProdutiva } from "./tiposAtividade";
import MaoDeObraDashboard from "./MaoDeObraDashboard";

interface MaoDeObraClientProps {
  initialFichas: FichaMaoObraItem[];
  equipamentos: any[];
  colaboradores: any[];
  calendario?: any[];
  userRole?: string;
}

const gerarNumeroFicha = () => `MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
const hojeStr = () => new Date().toISOString().split("T")[0];

export default function MaoDeObraClient({
  initialFichas,
  equipamentos = [],
  colaboradores = [],
  calendario = [],
  userRole = "mecanico"
}: MaoDeObraClientProps) {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const isAdmin = profile?.role === "admin" || userRole === "admin";

  const [activeTab, setActiveTab] = useState<"form" | "historico" | "dashboard">("form");
  const [fichas, setFichas] = useState<FichaMaoObraItem[]>(initialFichas || []);
  const [selectedFichaForPDF, setSelectedFichaForPDF] = useState<FichaMaoObraItem | null>(null);

  // Estados do Formulário (Jornada do Dia)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [numeroFicha, setNumeroFicha] = useState(gerarNumeroFicha());
  const [statusFicha, setStatusFicha] = useState<"Em andamento" | "Finalizado">("Em andamento");

  // Dados do Colaborador
  const [mecanicoNome, setMecanicoNome] = useState((profile as any)?.nome || (profile as any)?.full_name || "");
  const [mecanicoMatricula, setMecanicoMatricula] = useState("");
  const [equipe, setEquipe] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [modulo, setModulo] = useState("");
  const [frenteTrabalho, setFrenteTrabalho] = useState("");

  // Jornada do Dia
  const [dataJornada, setDataJornada] = useState(hojeStr());
  const [horaInicioJornada, setHoraInicioJornada] = useState("07:00");
  const [horaFimJornada, setHoraFimJornada] = useState("17:00");

  // Atividades Apontadas ao longo do dia
  const [atividades, setAtividades] = useState<AtividadeJornada[]>([]);

  // Observações
  const [observacoes, setObservacoes] = useState("");

  // Estados de Filtro do Histórico
  const [filtroMecanico, setFiltroMecanico] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroSupervisor, setFiltroSupervisor] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const autoLoadedRef = useRef(false);

  // Filtro estrito para exibir apenas placas de Veículos Pesados Ativos ordenados alfabeticamente
  const equipamentosPesadosAtivos = useMemo(() => {
    return (equipamentos || [])
      .filter((e: any) => {
        if (!e || e.deleted_at) return false;
        const cat = (e.categoria || "PESADA").toString().toUpperCase();
        const isPesada = cat === "PESADA" || cat === "FROTA PESADA" || cat.includes("PESADA");
        const st = (e.status || "ATIVO").toString().toUpperCase();
        const isAtivo = st !== "INATIVO" && st !== "BAIXADO" && st !== "DESATIVADO";
        return isPesada && isAtivo;
      })
      .sort((a: any, b: any) => (a.placa || "").localeCompare(b.placa || ""));
  }, [equipamentos]);

  // Seleção automática do nome do colaborador a partir do perfil logado
  useEffect(() => {
    const profNome = (profile as any)?.nome || (profile as any)?.full_name;
    if (profNome && !mecanicoNome) {
      setMecanicoNome(profNome);
    }
  }, [profile]);

  // Cálculo genérico do tempo entre dois horários "HH:MM" (trata virada de dia)
  const calcTempoGasto = (inicio: string, fim: string): string => {
    if (!inicio || !fim) return "";
    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";

    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Atualiza um campo de uma atividade, recalculando o tempo gasto quando o horário muda
  const updateAtividadeCampo = (
    id: string,
    field: "tipo_atividade" | "placa" | "descricao" | "hora_inicio" | "hora_fim",
    value: string
  ) => {
    setAtividades(prev => prev.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [field]: value };
      if (field === "hora_inicio" || field === "hora_fim") {
        updated.tempo_gasto = calcTempoGasto(
          field === "hora_inicio" ? value : (a.hora_inicio || ""),
          field === "hora_fim" ? value : (a.hora_fim || "")
        );
      }
      return updated;
    }));
  };

  const handleAddAtividade = () => {
    setAtividades(prev => [...prev, {
      id: `atv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipo_atividade: TIPOS_ATIVIDADE[0].label,
      placa: "",
      descricao: "",
      hora_inicio: "",
      hora_fim: "",
      tempo_gasto: ""
    }]);
  };

  const handleRemoveAtividade = (id: string) => {
    setAtividades(prev => prev.filter(a => a.id !== id));
  };

  // Total de horas apontadas no dia
  const tempoTotalHorasCalculado = useMemo(() => {
    let totalMinutos = 0;
    atividades.forEach(a => {
      if (a.tempo_gasto) {
        const [h, m] = a.tempo_gasto.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) totalMinutos += h * 60 + m;
      }
    });
    return Number((totalMinutos / 60).toFixed(2));
  }, [atividades]);

  // Split produtivo x ocioso, a partir da flag de cada categoria
  const tempoProdutivoCalculado = useMemo(() => {
    let totalMinutos = 0;
    atividades.forEach(a => {
      if (a.tempo_gasto && isAtividadeProdutiva(a.tipo_atividade)) {
        const [h, m] = a.tempo_gasto.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) totalMinutos += h * 60 + m;
      }
    });
    return Number((totalMinutos / 60).toFixed(2));
  }, [atividades]);

  const tempoOciosoCalculado = useMemo(
    () => Number((tempoTotalHorasCalculado - tempoProdutivoCalculado).toFixed(2)),
    [tempoTotalHorasCalculado, tempoProdutivoCalculado]
  );

  // Tempo da jornada sem NENHUMA atividade apontada (nem produtivo, nem ocioso logado)
  const tempoNaoApontadoCalculado = useMemo(() => {
    const duracao = calcTempoGasto(horaInicioJornada, horaFimJornada);
    if (!duracao) return 0;
    const [h, m] = duracao.split(":").map(Number);
    const duracaoHoras = h + m / 60;
    return Math.max(0, Number((duracaoHoras - tempoTotalHorasCalculado).toFixed(2)));
  }, [horaInicioJornada, horaFimJornada, tempoTotalHorasCalculado]);

  // Uma jornada finalizada só pode ser editada por admin (reabrir explicitamente)
  const canEdit = !editingId || statusFicha !== "Finalizado" || isAdmin;

  const resetForm = () => {
    setEditingId(null);
    setNumeroFicha(gerarNumeroFicha());
    setStatusFicha("Em andamento");
    setDataJornada(hojeStr());
    setHoraInicioJornada("07:00");
    setHoraFimJornada("17:00");
    setAtividades([]);
    setObservacoes("");
  };

  // Salvar Jornada (Offline-First)
  const handleSaveFicha = async (finalizar = false) => {
    if (!mecanicoNome.trim()) {
      alert("Por favor, preencha o Nome do Colaborador.");
      return;
    }
    if (finalizar && atividades.length === 0) {
      alert("Adicione ao menos uma atividade antes de finalizar a jornada.");
      return;
    }

    const nextStatus = finalizar ? "Finalizado" : "Em andamento";

    const newFichaItem: FichaMaoObraItem = {
      id: editingId || `temp_mo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      numero_ficha: numeroFicha,
      mecanico_nome: mecanicoNome,
      mecanico_matricula: mecanicoMatricula,
      equipe,
      supervisor,
      modulo,
      frente_trabalho: frenteTrabalho,
      data_jornada: dataJornada,
      hora_inicio_jornada: horaInicioJornada,
      hora_fim_jornada: horaFimJornada,
      atividades,
      tempo_total_horas: tempoTotalHorasCalculado,
      tempo_produtivo_horas: tempoProdutivoCalculado,
      tempo_ocioso_horas: tempoOciosoCalculado,
      observacoes,
      status: nextStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Salva localmente no IndexedDB (Offline-First garantido)
      await localDb.put("fichas_mao_obra", newFichaItem);
      setFichas(prev => [newFichaItem, ...prev.filter(f => f.id !== newFichaItem.id)]);

      // 2. Adiciona à fila de sincronização para replay em background
      await localDb.addToQueue("ficha_mao_obra", "create", newFichaItem);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      // 3. Tenta sincronizar online com o Supabase sem bloquear a resposta do formulário
      if (isOnline) {
        try {
          const res = await salvarFichaMaoObra(newFichaItem);
          if (res && res.error) {
            console.warn("[Mão de Obra] Aviso de sincronização no Supabase (salvo localmente):", res.error);
          } else if (res && res.data) {
            const serverItem = res.data;
            await localDb.put("fichas_mao_obra", serverItem);
            setFichas(prev => [serverItem, ...prev.filter(f => f.id !== newFichaItem.id && f.id !== serverItem.id)]);
          }
        } catch (onlineErr) {
          console.warn("[Mão de Obra] Falha ao enviar para o Supabase (mantido em fila offline):", onlineErr);
        }
      }

      alert(finalizar ? "✅ Jornada Finalizada com sucesso!" : "💾 Rascunho salvo localmente!");

      if (finalizar) {
        setSelectedFichaForPDF(newFichaItem);
        resetForm();
      } else {
        setEditingId(newFichaItem.id);
      }
    } catch (err: any) {
      console.error("Erro no armazenamento local da ficha:", err);
      alert(`Erro ao gravar dados no dispositivo: ${err?.message || String(err)}`);
    }
  };

  // Carregar Jornada para Edição / Visualização
  const handleEditFicha = (f: FichaMaoObraItem) => {
    setEditingId(f.id);
    setNumeroFicha(f.numero_ficha);
    setStatusFicha((f.status as any) || "Em andamento");
    setMecanicoNome(f.mecanico_nome);
    setMecanicoMatricula(f.mecanico_matricula || "");
    setEquipe(f.equipe || "");
    setSupervisor(f.supervisor || "");
    setModulo(f.modulo || "");
    setFrenteTrabalho(f.frente_trabalho || "");
    setDataJornada(f.data_jornada || f.created_at?.split("T")[0] || hojeStr());
    setHoraInicioJornada(f.hora_inicio_jornada || "07:00");
    setHoraFimJornada(f.hora_fim_jornada || "17:00");
    setAtividades(f.atividades || []);
    setObservacoes(f.observacoes || "");
    setActiveTab("form");
  };

  // Retomar automaticamente a jornada de hoje já aberta pelo colaborador, se existir
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (!mecanicoNome || fichas.length === 0) return;
    const todayStr = hojeStr();
    const aberta = fichas.find(f =>
      f.status === "Em andamento" &&
      f.mecanico_nome === mecanicoNome &&
      (f.data_jornada || f.created_at?.split("T")[0]) === todayStr
    );
    if (aberta) {
      handleEditFicha(aberta);
    }
    autoLoadedRef.current = true;
  }, [fichas, mecanicoNome]);

  // Excluir Jornada
  const handleDeleteFicha = async (id: string) => {
    if (!confirm("Deseja realmente excluir este apontamento de mão de obra?")) return;
    try {
      await localDb.delete("fichas_mao_obra", id);
      setFichas(prev => prev.filter(f => f.id !== id));
      if (isOnline) {
        await excluirFichaMaoObra(id);
      }
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
    }
  };

  // Duplicar Jornada (como modelo para um novo dia)
  const handleDuplicateFicha = async (id: string) => {
    try {
      if (isOnline) {
        const res = await duplicarFichaMaoObra(id);
        if (res.success && res.data) {
          await localDb.put("fichas_mao_obra", res.data);
          setFichas(prev => [res.data, ...prev]);
          alert("Jornada duplicada com sucesso!");
        }
      } else {
        const target = fichas.find(f => f.id === id);
        if (target) {
          const dup: FichaMaoObraItem = {
            ...target,
            id: `temp_mo_${Date.now()}`,
            numero_ficha: gerarNumeroFicha(),
            data_jornada: hojeStr(),
            status: "Em andamento",
            created_at: new Date().toISOString()
          };
          await localDb.put("fichas_mao_obra", dup);
          setFichas(prev => [dup, ...prev]);
          alert("Jornada duplicada offline com sucesso!");
        }
      }
    } catch (err) {
      console.error("Erro ao duplicar ficha:", err);
    }
  };

  // Reabrir Jornada finalizada (admin)
  const handleReabrirJornada = async (id: string) => {
    if (!isOnline) {
      alert("Reabrir uma jornada requer conexão com a internet.");
      return;
    }
    if (!confirm("Reabrir esta jornada para edição?")) return;
    const res = await reabrirJornada(id);
    if ("error" in res && res.error) {
      alert(res.error);
      return;
    }
    const alvo = fichas.find(f => f.id === id);
    if (alvo) {
      const atualizado: FichaMaoObraItem = { ...alvo, status: "Em andamento" };
      await localDb.put("fichas_mao_obra", atualizado);
      setFichas(prev => prev.map(f => (f.id === id ? atualizado : f)));
      if (editingId === id) setStatusFicha("Em andamento");
    }
  };

  // Lista Filtrada do Histórico
  const fichasFiltradas = useMemo(() => {
    return fichas.filter(f => {
      if (filtroMecanico && !f.mecanico_nome?.toLowerCase().includes(filtroMecanico.toLowerCase())) return false;
      if (filtroPlaca) {
        const temPlaca =
          (f.atividades || []).some(a => a.placa?.toLowerCase().includes(filtroPlaca.toLowerCase())) ||
          f.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
        if (!temPlaca) return false;
      }
      if (filtroCategoria) {
        const temCategoria = (f.atividades || []).some(a => a.tipo_atividade === filtroCategoria);
        if (!temCategoria) return false;
      }
      if (filtroSupervisor && !f.supervisor?.toLowerCase().includes(filtroSupervisor.toLowerCase())) return false;
      const dataRef = f.data_jornada || f.created_at?.split("T")[0] || "";
      if (filtroDataInicio && dataRef < filtroDataInicio) return false;
      if (filtroDataFim && dataRef > filtroDataFim) return false;
      return true;
    });
  }, [fichas, filtroMecanico, filtroPlaca, filtroCategoria, filtroSupervisor, filtroDataInicio, filtroDataFim]);

  const inputCls = "w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-3 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* ─── CABEÇALHO DO MÓDULO ─── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-white dark:bg-slate-900 p-4 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-md flex items-center justify-center font-black">
            <Wrench size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                EUNAMAN
              </span>
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-bold text-slate-500">
                PWA Offline
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight">
              Apontamento Diário de Mão de Obra
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Tomada de tempo do colaborador: o que fez, quando e por quanto tempo ao longo do dia.
            </p>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700/60 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab("form")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap",
              activeTab === "form"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <PenTool size={15} />
            <span>Apontamento do Dia</span>
          </button>
          <button
            onClick={() => setActiveTab("historico")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap",
              activeTab === "historico"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <FileText size={15} />
            <span>Histórico ({fichas.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-extrabold transition-all whitespace-nowrap",
              activeTab === "dashboard"
                ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            )}
          >
            <BarChart2 size={15} />
            <span>Dashboard</span>
          </button>
        </div>
      </div>

      {/* ─── ABA 1: APONTAMENTO DO DIA (NOVO OU EDIÇÃO) ─── */}
      {activeTab === "form" && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
          {/* Topo do Formulário: Ficha Número & Live Status */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {numeroFicha}
              </span>
              <span className={cn(
                "text-xs px-2.5 py-1 rounded-md font-extrabold",
                statusFicha === "Finalizado"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              )}>
                {statusFicha}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
              <Clock size={14} />
              <span>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>

          {!canEdit && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3 flex-wrap">
              <span className="flex items-center gap-2"><Lock size={14} /> Jornada finalizada — somente leitura.</span>
              {isAdmin && editingId && (
                <button
                  type="button"
                  onClick={() => handleReabrirJornada(editingId)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                >
                  <RefreshCcw size={13} /> Reabrir Jornada
                </button>
              )}
            </div>
          )}

          {/* Seção 1: Dados do Colaborador */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              👨‍🔧 1. Dados do Colaborador e da Jornada
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Colaborador <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={mecanicoNome}
                  onChange={e => setMecanicoNome(e.target.value)}
                  placeholder="Nome do colaborador"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={mecanicoMatricula}
                  onChange={e => setMecanicoMatricula(e.target.value)}
                  placeholder="Ex: MEC-1234"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Equipe / Turno
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={equipe}
                  onChange={e => setEquipe(e.target.value)}
                  placeholder="Ex: Equipe A (Dia)"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Responsável
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={supervisor}
                  onChange={e => setSupervisor(e.target.value)}
                  placeholder="Nome do supervisor"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Módulo
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={modulo}
                  onChange={e => setModulo(e.target.value)}
                  placeholder="Ex: Módulo Suzano Mucuri"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Frente de Trabalho
                </label>
                <input
                  type="text"
                  disabled={!canEdit}
                  value={frenteTrabalho}
                  onChange={e => setFrenteTrabalho(e.target.value)}
                  placeholder="Ex: Oficina Central / Campo"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Data
                </label>
                <input
                  type="date"
                  disabled={!canEdit}
                  value={dataJornada}
                  onChange={e => setDataJornada(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Início da Jornada
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={horaInicioJornada}
                  onChange={e => setHoraInicioJornada(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Fim da Jornada
                </label>
                <input
                  type="time"
                  disabled={!canEdit}
                  value={horaFimJornada}
                  onChange={e => setHoraFimJornada(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Atividades do Dia */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
                ⏱️ 2. Atividades do Dia
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl font-black text-xs">
                  Total: {tempoTotalHorasCalculado}h
                </span>
                <span className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-xl font-black text-xs">
                  Produtivo: {tempoProdutivoCalculado}h
                </span>
                <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-xl font-black text-xs">
                  Ocioso: {tempoOciosoCalculado}h
                </span>
              </div>
            </div>

            {tempoNaoApontadoCalculado > 0 && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-xl text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertCircle size={14} />
                {tempoNaoApontadoCalculado}h da jornada ainda sem nenhuma atividade apontada.
              </div>
            )}

            <div className="space-y-3">
              {atividades.map(atv => (
                <div
                  key={atv.id}
                  className={cn(
                    "p-3 rounded-xl border space-y-2",
                    isAtividadeProdutiva(atv.tipo_atividade)
                      ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/40"
                      : "bg-orange-50/40 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/40"
                  )}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Categoria</span>
                      <select
                        disabled={!canEdit}
                        value={atv.tipo_atividade}
                        onChange={e => updateAtividadeCampo(atv.id, "tipo_atividade", e.target.value)}
                        className={inputCls}
                      >
                        {TIPOS_ATIVIDADE.map(t => (
                          <option key={t.label} value={t.label}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Placa (opcional)</span>
                      <select
                        disabled={!canEdit}
                        value={atv.placa || ""}
                        onChange={e => updateAtividadeCampo(atv.id, "placa", e.target.value)}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        {equipamentosPesadosAtivos.map((eq: any, i: number) => (
                          <option key={i} value={eq.placa}>{eq.placa}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Descrição</span>
                      <input
                        type="text"
                        disabled={!canEdit}
                        value={atv.descricao}
                        onChange={e => updateAtividadeCampo(atv.id, "descricao", e.target.value)}
                        placeholder="O que foi feito..."
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase">Início</span>
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={atv.hora_inicio || ""}
                        onChange={e => updateAtividadeCampo(atv.id, "hora_inicio", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <span className="block text-[9px] font-bold text-slate-500 uppercase">Término</span>
                      <input
                        type="time"
                        disabled={!canEdit}
                        value={atv.hora_fim || ""}
                        onChange={e => updateAtividadeCampo(atv.id, "hora_fim", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40 font-black text-xs text-emerald-700 dark:text-emerald-300 text-center flex-1">
                        {atv.tempo_gasto || "00:00"}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAtividade(atv.id)}
                          className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {atividades.length === 0 && (
                <p className="text-xs text-slate-400 italic">Nenhuma atividade apontada ainda.</p>
              )}
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={handleAddAtividade}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus size={14} /> Adicionar Atividade
              </button>
            )}
          </div>

          {/* Seção 3: Observações */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              💬 3. Observações Gerais
            </h3>
            <textarea
              rows={3}
              disabled={!canEdit}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Peça indisponível no estoque, aguardando autorização do supervisor..."
              className={inputCls}
            />
          </div>

          {/* Botões de Ação Principais */}
          {canEdit && (
            <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-300 transition"
              >
                Nova Jornada
              </button>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleSaveFicha(false)}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow transition active:scale-95 flex items-center gap-1.5"
                >
                  💾 Salvar Rascunho
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveFicha(true)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} /> Finalizar Jornada
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── ABA 2: HISTÓRICO DE JORNADAS ─── */}
      {activeTab === "historico" && (
        <div className="space-y-4">
          {/* Barra de Filtros Avançados */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-slate-500">
              <Filter size={15} /> Filtros de Pesquisa
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <input
                type="text"
                placeholder="Colaborador..."
                value={filtroMecanico}
                onChange={e => setFiltroMecanico(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <input
                type="text"
                placeholder="Placa..."
                value={filtroPlaca}
                onChange={e => setFiltroPlaca(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <select
                value={filtroCategoria}
                onChange={e => setFiltroCategoria(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="">-- Todas as Categorias --</option>
                {TIPOS_ATIVIDADE.map(t => (
                  <option key={t.label} value={t.label}>{t.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Supervisor..."
                value={filtroSupervisor}
                onChange={e => setFiltroSupervisor(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <input
                type="date"
                value={filtroDataInicio}
                onChange={e => setFiltroDataInicio(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <input
                type="date"
                value={filtroDataFim}
                onChange={e => setFiltroDataFim(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
            </div>
          </div>

          {/* Tabela de Histórico */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {fichasFiltradas.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Data</th>
                      <th className="p-3">Número</th>
                      <th className="p-3">Colaborador</th>
                      <th className="p-3 text-center">Atividades</th>
                      <th className="p-3 text-center">Total</th>
                      <th className="p-3 text-center">Produtivo</th>
                      <th className="p-3 text-center">Ocioso</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fichasFiltradas.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold">
                          {(f.data_jornada || f.created_at?.split("T")[0] || "").split("-").reverse().join("/")}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                          {f.numero_ficha}
                        </td>
                        <td className="p-3 font-bold">{f.mecanico_nome}</td>
                        <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">{(f.atividades || []).length}</td>
                        <td className="p-3 text-center font-black">{f.tempo_total_horas || 0}h</td>
                        <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">{f.tempo_produtivo_horas || 0}h</td>
                        <td className="p-3 text-center font-bold text-orange-600 dark:text-orange-400">{f.tempo_ocioso_horas || 0}h</td>
                        <td className="p-3 text-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase",
                            f.status === "Finalizado" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          )}>
                            {f.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedFichaForPDF(f)}
                              title="Visualizar / Gerar Relatório"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              onClick={() => handleEditFicha(f)}
                              title="Abrir"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDuplicateFicha(f.id)}
                              title="Duplicar como modelo"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white rounded-lg transition"
                            >
                              <Copy size={15} />
                            </button>
                            {isAdmin && f.status === "Finalizado" && (
                              <button
                                onClick={() => handleReabrirJornada(f.id)}
                                title="Reabrir (Admin)"
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 hover:text-white rounded-lg transition"
                              >
                                <RefreshCcw size={15} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteFicha(f.id)}
                                title="Excluir (Admin)"
                                className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-red-600 hover:text-white rounded-lg transition"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <FileText size={32} className="mx-auto text-slate-300" />
                <p className="font-semibold text-xs">Nenhum apontamento de mão de obra encontrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA 3: DASHBOARD DE PRODUTIVIDADE ─── */}
      {activeTab === "dashboard" && (
        <MaoDeObraDashboard fichas={fichas} colaboradores={colaboradores} calendario={calendario} />
      )}

      {/* MODAL DE EXIBIÇÃO / GERAÇÃO DE RELATÓRIO */}
      {selectedFichaForPDF && (
        <FichaPDFModal
          ficha={selectedFichaForPDF}
          onClose={() => setSelectedFichaForPDF(null)}
        />
      )}
    </div>
  );
}
