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
  Lock,
  X,
  Save
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import FichaPDFModal, { FichaMaoObraItem, AtividadeJornada } from "./FichaPDFModal";
import { salvarFichaMaoObra, excluirFichaMaoObra, duplicarFichaMaoObra, reabrirJornada, salvarApontamento, excluirApontamento } from "./actions";
import { TIPOS_ATIVIDADE, isAtividadeProdutiva, formatMinutos } from "./tiposAtividade";
import MaoDeObraDashboard from "./MaoDeObraDashboard";

interface MaoDeObraClientProps {
  initialFichas: FichaMaoObraItem[];
  initialApontamentos: AtividadeJornada[];
  equipamentos: any[];
  colaboradores: any[];
  calendario?: any[];
  userRole?: string;
}

const gerarNumeroFicha = () => `MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
const hojeStr = () => new Date().toISOString().split("T")[0];

const gerarId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

// Cálculo do tempo entre dois horários "HH:MM" (trata virada de dia)
function calcTempoGasto(inicio?: string, fim?: string): string {
  if (!inicio || !fim) return "";
  const [h1, m1] = inicio.split(":").map(Number);
  const [h2, m2] = fim.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";

  let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function tempoGastoParaMinutos(tempoGasto?: string): number {
  if (!tempoGasto) return 0;
  const [h, m] = tempoGasto.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

// tempo_gasto_minutos é a coluna real (fonte de verdade); tempo_gasto (string "HH:MM")
// só existe como conveniência de exibição no rascunho em edição no cliente.
function somarMinutos(lista: AtividadeJornada[]): number {
  const totalMinutos = lista.reduce((acc, a) => {
    if (typeof a.tempo_gasto_minutos === "number") return acc + a.tempo_gasto_minutos;
    return acc + tempoGastoParaMinutos(a.tempo_gasto);
  }, 0);
  return Number((totalMinutos / 60).toFixed(2));
}

export default function MaoDeObraClient({
  initialFichas,
  initialApontamentos,
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
  const [apontamentos, setApontamentos] = useState<AtividadeJornada[]>(initialApontamentos || []);
  const [selectedFichaForPDF, setSelectedFichaForPDF] = useState<FichaMaoObraItem | null>(null);

  // Mantém o estado sincronizado com o que a página carrega do IndexedDB/Supabase —
  // essencial porque vários colaboradores apontam ao mesmo tempo por celulares
  // diferentes: quando o sync roda em segundo plano (o próprio dispositivo gravando
  // localmente, ou puxando dados novos do servidor), essa tela precisa refletir.
  useEffect(() => { setFichas(initialFichas || []); }, [initialFichas]);
  useEffect(() => { setApontamentos(initialApontamentos || []); }, [initialApontamentos]);

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

  // Rascunho da atividade sendo apontada agora (uma por vez — registrada imediatamente ao confirmar)
  const [draftAtividade, setDraftAtividade] = useState<AtividadeJornada | null>(null);
  const [savingAtividade, setSavingAtividade] = useState(false);

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

  // Atividades já registradas (persistidas) da jornada aberta no formulário, em ordem cronológica
  const apontamentosDaJornada = useMemo(() => {
    if (!editingId) return [];
    return apontamentos
      .filter(a => a.jornada_id === editingId)
      .sort((a, b) => (a.hora_inicio || "").localeCompare(b.hora_inicio || ""));
  }, [apontamentos, editingId]);

  const tempoTotalHorasCalculado = useMemo(() => somarMinutos(apontamentosDaJornada), [apontamentosDaJornada]);
  const tempoProdutivoCalculado = useMemo(
    () => somarMinutos(apontamentosDaJornada.filter(a => isAtividadeProdutiva(a.tipo_atividade))),
    [apontamentosDaJornada]
  );
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

  // Só aloca o id/data de criação — não grava nada. Usado tanto por quem já tem jornada
  // aberta (reaproveita) quanto para saber com qual id a próxima gravação vai trabalhar.
  const allocateJornadaId = (): { id: string; created_at: string } => {
    if (editingId) {
      const existente = fichas.find(f => f.id === editingId);
      return { id: editingId, created_at: existente?.created_at || new Date().toISOString() };
    }
    return { id: gerarId(), created_at: new Date().toISOString() };
  };

  // Garante que a jornada já existe gravada (local + fila de sync + melhor esforço online)
  // antes de um apontamento poder referenciá-la — essencial pra ordem de sincronização
  // funcionar quando o colaborador começa direto apontando uma atividade, sem antes
  // clicar em "Salvar Rascunho".
  const ensureJornadaPersisted = async (): Promise<{ id: string; created_at: string }> => {
    if (editingId) {
      const existente = fichas.find(f => f.id === editingId);
      return { id: editingId, created_at: existente?.created_at || new Date().toISOString() };
    }

    const novoId = gerarId();
    const createdAt = new Date().toISOString();
    const novaFicha: FichaMaoObraItem = {
      id: novoId,
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
      tempo_total_horas: 0,
      tempo_produtivo_horas: 0,
      tempo_ocioso_horas: 0,
      observacoes,
      status: "Em andamento",
      created_at: createdAt,
      updated_at: createdAt
    };

    const localRecord = { ...novaFicha, _isPendingSync: true };
    await localDb.put("fichas_mao_obra", localRecord);
    setFichas(prev => [localRecord, ...prev]);
    await localDb.addToQueue("ficha_mao_obra", "create", novaFicha);
    window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

    if (isOnline) {
      try {
        const res = await salvarFichaMaoObra(novaFicha);
        if (res?.data) {
          await localDb.put("fichas_mao_obra", res.data);
          setFichas(prev => [res.data, ...prev.filter((f: any) => f.id !== res.data.id)]);
        }
      } catch (err) {
        console.warn("[Mão de Obra] Falha ao criar jornada online (mantido em fila offline):", err);
      }
    }

    setEditingId(novoId);
    return { id: novoId, created_at: createdAt };
  };

  const resetForm = () => {
    setEditingId(null);
    setNumeroFicha(gerarNumeroFicha());
    setStatusFicha("Em andamento");
    setDataJornada(hojeStr());
    setHoraInicioJornada("07:00");
    setHoraFimJornada("17:00");
    setDraftAtividade(null);
    setObservacoes("");
  };

  // Salvar cabeçalho da Jornada (Offline-First)
  const handleSaveFicha = async (finalizar = false) => {
    if (!mecanicoNome.trim()) {
      alert("Por favor, preencha o Nome do Colaborador.");
      return;
    }
    if (finalizar && apontamentosDaJornada.length === 0) {
      alert("Adicione ao menos uma atividade antes de finalizar a jornada.");
      return;
    }

    const { id: jornadaId, created_at } = allocateJornadaId();
    const nextStatus = finalizar ? "Finalizado" : "Em andamento";

    const updatedFicha: FichaMaoObraItem = {
      id: jornadaId,
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
      tempo_total_horas: tempoTotalHorasCalculado,
      tempo_produtivo_horas: tempoProdutivoCalculado,
      tempo_ocioso_horas: tempoOciosoCalculado,
      observacoes,
      status: nextStatus,
      created_at,
      updated_at: new Date().toISOString()
    };

    try {
      if (!editingId) setEditingId(jornadaId);

      const localRecord = { ...updatedFicha, _isPendingSync: true };
      await localDb.put("fichas_mao_obra", localRecord);
      setFichas(prev => [localRecord, ...prev.filter(f => f.id !== localRecord.id)]);

      await localDb.addToQueue("ficha_mao_obra", "update", updatedFicha);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      if (isOnline) {
        try {
          const res = await salvarFichaMaoObra(updatedFicha);
          if (res && res.error) {
            console.warn("[Mão de Obra] Aviso de sincronização no Supabase (salvo localmente):", res.error);
          } else if (res && res.data) {
            const serverItem = res.data;
            await localDb.put("fichas_mao_obra", serverItem);
            setFichas(prev => [serverItem, ...prev.filter(f => f.id !== serverItem.id)]);
          }
        } catch (onlineErr) {
          console.warn("[Mão de Obra] Falha ao enviar para o Supabase (mantido em fila offline):", onlineErr);
        }
      }

      setStatusFicha(nextStatus);
      alert(finalizar ? "✅ Jornada Finalizada com sucesso!" : "💾 Rascunho salvo!");

      if (finalizar) {
        setSelectedFichaForPDF(updatedFicha);
        resetForm();
      }
    } catch (err: any) {
      console.error("Erro no armazenamento local da ficha:", err);
      alert(`Erro ao gravar dados no dispositivo: ${err?.message || String(err)}`);
    }
  };

  // Carregar Jornada para Edição / Visualização / Continuidade
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
    setDraftAtividade(null);
    setObservacoes(f.observacoes || "");
    setActiveTab("form");
  };

  // Retoma automaticamente a jornada de hoje já aberta pelo colaborador (mesmo nome + mesma
  // data), caso exista — permite dar continuidade aos apontamentos do dia em outra sessão/
  // aparelho sem duplicar a jornada.
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

  // ─── Atividades: apontar, editar, remover (cada uma é sua própria linha no banco) ───

  const handleNovaAtividade = () => {
    if (!mecanicoNome.trim()) {
      alert("Preencha o Nome do Colaborador antes de apontar atividades.");
      return;
    }
    setDraftAtividade({
      id: gerarId(),
      tipo_atividade: TIPOS_ATIVIDADE[0].label,
      placa: "",
      descricao: "",
      hora_inicio: "",
      hora_fim: "",
      tempo_gasto: ""
    });
  };

  const handleEditarAtividade = (atv: AtividadeJornada) => {
    setDraftAtividade({ ...atv });
  };

  const handleCancelarDraft = () => setDraftAtividade(null);

  const updateDraftCampo = (
    field: "tipo_atividade" | "placa" | "descricao" | "hora_inicio" | "hora_fim",
    value: string
  ) => {
    setDraftAtividade(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (field === "hora_inicio" || field === "hora_fim") {
        updated.tempo_gasto = calcTempoGasto(
          field === "hora_inicio" ? value : (prev.hora_inicio || ""),
          field === "hora_fim" ? value : (prev.hora_fim || "")
        );
        updated.tempo_gasto_minutos = tempoGastoParaMinutos(updated.tempo_gasto);
      }
      return updated;
    });
  };

  // Confirma e grava UMA atividade imediatamente (não espera o "Salvar" geral da jornada) —
  // é isso que torna seguro vários colaboradores apontando ao mesmo tempo em celulares
  // diferentes: cada apontamento é sua própria gravação, nunca sobrescreve a lista inteira.
  const handleRegistrarAtividade = async () => {
    if (!draftAtividade) return;
    if (!draftAtividade.hora_inicio) {
      alert("Informe pelo menos o horário de início da atividade.");
      return;
    }

    setSavingAtividade(true);
    try {
      const { id: jornadaId } = await ensureJornadaPersisted();
      const isUpdate = apontamentos.some(a => a.id === draftAtividade.id);

      const payload: AtividadeJornada = {
        id: draftAtividade.id,
        jornada_id: jornadaId,
        tipo_atividade: draftAtividade.tipo_atividade,
        placa: draftAtividade.placa || undefined,
        descricao: draftAtividade.descricao || "",
        hora_inicio: draftAtividade.hora_inicio || "",
        hora_fim: draftAtividade.hora_fim || "",
        tempo_gasto: draftAtividade.tempo_gasto || "",
        produtivo: isAtividadeProdutiva(draftAtividade.tipo_atividade),
        tempo_gasto_minutos: tempoGastoParaMinutos(draftAtividade.tempo_gasto)
      };

      const localRecord = { ...payload, _isPendingSync: true };
      await localDb.put("apontamentos_mao_obra", localRecord);
      setApontamentos(prev => [localRecord, ...prev.filter(a => a.id !== localRecord.id)]);

      await localDb.addToQueue("apontamento_mao_obra", isUpdate ? "update" : "create", payload);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      if (isOnline) {
        try {
          const res = await salvarApontamento(payload);
          if (res && res.error) {
            console.warn("[Mão de Obra] Aviso ao sincronizar apontamento:", res.error);
          } else if (res && res.data) {
            await localDb.put("apontamentos_mao_obra", res.data);
            setApontamentos(prev => [res.data, ...prev.filter((a: any) => a.id !== res.data.id)]);
          }
        } catch (err) {
          console.warn("[Mão de Obra] Falha ao enviar apontamento (mantido em fila offline):", err);
        }
      }

      setDraftAtividade(null);
    } finally {
      setSavingAtividade(false);
    }
  };

  const handleExcluirAtividade = async (id: string) => {
    if (!confirm("Remover este apontamento?")) return;
    try {
      await localDb.delete("apontamentos_mao_obra", id);
      setApontamentos(prev => prev.filter(a => a.id !== id));
      await localDb.addToQueue("apontamento_mao_obra", "delete", { id });
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      if (isOnline) {
        const res = await excluirApontamento(id);
        if (res && "error" in res && res.error) {
          console.warn("[Mão de Obra] Aviso ao excluir apontamento:", res.error);
        }
      }
    } catch (err) {
      console.error("Erro ao excluir apontamento:", err);
    }
  };

  // Excluir Jornada
  const handleDeleteFicha = async (id: string) => {
    if (!confirm("Deseja realmente excluir este apontamento de mão de obra? Todas as atividades registradas nele também serão removidas.")) return;
    try {
      await localDb.delete("fichas_mao_obra", id);
      setFichas(prev => prev.filter(f => f.id !== id));
      setApontamentos(prev => prev.filter(a => a.jornada_id !== id));
      if (isOnline) {
        await excluirFichaMaoObra(id);
      }
    } catch (err) {
      console.error("Erro ao excluir ficha:", err);
    }
  };

  // Duplicar Jornada (como modelo para um novo dia — sem copiar as atividades já apontadas)
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
            id: gerarId(),
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
        const atividadesDaFicha = apontamentos.filter(a => a.jornada_id === f.id);
        const temPlaca =
          atividadesDaFicha.some(a => a.placa?.toLowerCase().includes(filtroPlaca.toLowerCase())) ||
          f.placa?.toLowerCase().includes(filtroPlaca.toLowerCase());
        if (!temPlaca) return false;
      }
      if (filtroCategoria) {
        const atividadesDaFicha = apontamentos.filter(a => a.jornada_id === f.id);
        const temCategoria = atividadesDaFicha.some(a => a.tipo_atividade === filtroCategoria);
        if (!temCategoria) return false;
      }
      if (filtroSupervisor && !f.supervisor?.toLowerCase().includes(filtroSupervisor.toLowerCase())) return false;
      const dataRef = f.data_jornada || f.created_at?.split("T")[0] || "";
      if (filtroDataInicio && dataRef < filtroDataInicio) return false;
      if (filtroDataFim && dataRef > filtroDataFim) return false;
      return true;
    });
  }, [fichas, apontamentos, filtroMecanico, filtroPlaca, filtroCategoria, filtroSupervisor, filtroDataInicio, filtroDataFim]);

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
              Cada atividade é registrada na hora — vários colaboradores podem apontar ao mesmo tempo, cada um pelo próprio celular.
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

      {/* ─── ABA 1: APONTAMENTO DO DIA (NOVO OU CONTINUAÇÃO) ─── */}
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
            {editingId && (
              <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1.5">
                <RefreshCcw size={11} /> Jornada em aberto — pode ser retomada de qualquer celular com o mesmo nome, na mesma data.
              </p>
            )}
          </div>

          {/* Seção 2: Atividades do Dia */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
                ⏱️ 2. Atividades do Dia — Histórico de Apontamentos
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

            {/* Rascunho da atividade sendo apontada agora */}
            {draftAtividade && canEdit && (
              <div className="p-3 rounded-xl border-2 border-emerald-400 dark:border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Categoria</span>
                    <select
                      value={draftAtividade.tipo_atividade}
                      onChange={e => updateDraftCampo("tipo_atividade", e.target.value)}
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
                      value={draftAtividade.placa || ""}
                      onChange={e => updateDraftCampo("placa", e.target.value)}
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
                      value={draftAtividade.descricao}
                      onChange={e => updateDraftCampo("descricao", e.target.value)}
                      placeholder="O que está sendo feito..."
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Início</span>
                    <input
                      type="time"
                      value={draftAtividade.hora_inicio || ""}
                      onChange={e => updateDraftCampo("hora_inicio", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Término</span>
                    <input
                      type="time"
                      value={draftAtividade.hora_fim || ""}
                      onChange={e => updateDraftCampo("hora_fim", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-500 uppercase">Duração</span>
                    <div className="p-1.5 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40 font-black text-xs text-emerald-700 dark:text-emerald-300 text-center">
                      {draftAtividade.tempo_gasto || "00:00"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={savingAtividade}
                      onClick={handleRegistrarAtividade}
                      className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow disabled:opacity-60"
                    >
                      <Save size={13} /> {savingAtividade ? "Salvando..." : "Registrar"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelarDraft}
                      className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Atividades já registradas (histórico do dia) */}
            <div className="space-y-2">
              {apontamentosDaJornada
                .filter(atv => atv.id !== draftAtividade?.id)
                .map(atv => (
                  <div
                    key={atv.id}
                    className={cn(
                      "p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4",
                      isAtividadeProdutiva(atv.tipo_atividade)
                        ? "bg-indigo-50/40 dark:bg-indigo-950/10 border-indigo-200 dark:border-indigo-900/40"
                        : "bg-orange-50/40 dark:bg-orange-950/10 border-orange-200 dark:border-orange-900/40"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{atv.tipo_atividade}</span>
                        {atv.placa && <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{atv.placa}</span>}
                        <span className="text-[10px] font-bold text-slate-500">{atv.hora_inicio || "—"} → {atv.hora_fim || "—"} ({formatMinutos(atv.tempo_gasto_minutos)})</span>
                      </div>
                      {atv.descricao && <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{atv.descricao}</p>}
                      <p className="text-[9px] text-slate-400 mt-1">
                        {(atv as any)._isPendingSync
                          ? "Aguardando sincronização..."
                          : atv.criado_em
                            ? `Registrado em ${new Date(atv.criado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}${atv.registrado_por_nome ? ` por ${atv.registrado_por_nome}` : ""}`
                            : null}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditarAtividade(atv)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExcluirAtividade(atv.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}

              {apontamentosDaJornada.length === 0 && !draftAtividade && (
                <p className="text-xs text-slate-400 italic">Nenhuma atividade apontada ainda.</p>
              )}
            </div>

            {canEdit && !draftAtividade && (
              <button
                type="button"
                onClick={handleNovaAtividade}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus size={14} /> Apontar Atividade
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
                  💾 Salvar Cabeçalho
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
                    {fichasFiltradas.map((f) => {
                      const qtdAtividades = apontamentos.filter(a => a.jornada_id === f.id).length;
                      return (
                        <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                          <td className="p-3 font-semibold">
                            {(f.data_jornada || f.created_at?.split("T")[0] || "").split("-").reverse().join("/")}
                          </td>
                          <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                            {f.numero_ficha}
                          </td>
                          <td className="p-3 font-bold">{f.mecanico_nome}</td>
                          <td className="p-3 text-center font-bold text-slate-600 dark:text-slate-300">{qtdAtividades}</td>
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
                                title="Abrir / Continuar"
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
                      );
                    })}
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
        <MaoDeObraDashboard fichas={fichas} apontamentos={apontamentos} colaboradores={colaboradores} calendario={calendario} />
      )}

      {/* MODAL DE EXIBIÇÃO / GERAÇÃO DE RELATÓRIO */}
      {selectedFichaForPDF && (
        <FichaPDFModal
          ficha={selectedFichaForPDF}
          apontamentos={apontamentos.filter(a => a.jornada_id === selectedFichaForPDF.id)}
          onClose={() => setSelectedFichaForPDF(null)}
        />
      )}
    </div>
  );
}
