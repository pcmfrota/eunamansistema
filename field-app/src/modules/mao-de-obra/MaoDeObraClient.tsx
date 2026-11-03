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
  Layers,
  ChevronLeft,
  MoreVertical,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect, Option } from "@/components/SearchableSelect";
import FichaPDFModal, { FichaMaoObraItem, AtividadeJornada } from "./FichaPDFModal";
import { salvarFichaMaoObra, excluirFichaMaoObra, duplicarFichaMaoObra, reabrirJornada, salvarApontamento, excluirApontamento } from "./actions";
import { isAtividadeProdutiva, formatMinutos } from "./tiposAtividade";
import MaoDeObraDashboard from "./MaoDeObraDashboard";
import MaoDeObraCatalogos from "./MaoDeObraCatalogos";
import { ListRow, Card } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { StatTile } from "../../ui/primitives/StatTile";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";

interface MaoDeObraClientProps {
  initialFichas: FichaMaoObraItem[];
  initialApontamentos: AtividadeJornada[];
  equipamentos: any[];
  colaboradores: any[];
  calendario?: any[];
  catalogos?: any[];
  apontamentosCatalogo?: any[];
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

function paraMinutosAbsolutos(hora?: string): number {
  if (!hora) return NaN;
  const [h, m] = hora.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return NaN;
  return h * 60 + m;
}

// Duas atividades não podem ocupar o mesmo intervalo de horário — o colaborador só pode
// estar fazendo uma coisa por vez. Trata virada de dia (ex: 23:00 -> 01:00) como o cálculo
// de duração já faz.
function intervalosSeSobrepoem(inicio1?: string, fim1?: string, inicio2?: string, fim2?: string): boolean {
  let s1 = paraMinutosAbsolutos(inicio1);
  let e1 = paraMinutosAbsolutos(fim1);
  let s2 = paraMinutosAbsolutos(inicio2);
  let e2 = paraMinutosAbsolutos(fim2);
  if ([s1, e1, s2, e2].some(v => isNaN(v))) return false;
  if (e1 <= s1) e1 += 24 * 60;
  if (e2 <= s2) e2 += 24 * 60;
  return s1 < e2 && s2 < e1;
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

type PendingConfirm =
  | { kind: "excluir-atividade"; id: string }
  | { kind: "excluir-ficha"; id: string; numero: string }
  | { kind: "reabrir-ficha"; id: string };

export default function MaoDeObraClient({
  initialFichas,
  initialApontamentos,
  equipamentos = [],
  colaboradores = [],
  calendario = [],
  catalogos: initialCatalogos = [],
  apontamentosCatalogo: initialApontamentosCatalogo = [],
  userRole = "mecanico"
}: MaoDeObraClientProps) {
  const { profile, user } = useAuth();
  const { isOnline } = useOffline();
  const toast = useToast();
  const isAdmin = profile?.role === "admin" || userRole === "admin";

  const [activeTab, setActiveTab] = useState<"menu" | "form" | "historico" | "dashboard" | "catalogos">("menu");
  const [actionSheetFichaId, setActionSheetFichaId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [fichas, setFichas] = useState<FichaMaoObraItem[]>(initialFichas || []);
  const [apontamentos, setApontamentos] = useState<AtividadeJornada[]>(initialApontamentos || []);
  const [catalogos, setCatalogos] = useState<any[]>(initialCatalogos || []);
  const [apontamentosCatalogo, setApontamentosCatalogo] = useState<any[]>(initialApontamentosCatalogo || []);
  const [selectedFichaForPDF, setSelectedFichaForPDF] = useState<FichaMaoObraItem | null>(null);

  // Mantém o estado sincronizado com o que a página carrega do IndexedDB/Supabase —
  // essencial porque vários colaboradores apontam ao mesmo tempo por celulares
  // diferentes: quando o sync roda em segundo plano (o próprio dispositivo gravando
  // localmente, ou puxando dados novos do servidor), essa tela precisa refletir.
  useEffect(() => { setFichas(initialFichas || []); }, [initialFichas]);
  useEffect(() => { setApontamentos(initialApontamentos || []); }, [initialApontamentos]);
  useEffect(() => { setCatalogos(initialCatalogos || []); }, [initialCatalogos]);
  useEffect(() => { setApontamentosCatalogo(initialApontamentosCatalogo || []); }, [initialApontamentosCatalogo]);

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

  const filtrosAtivos = [filtroMecanico, filtroPlaca, filtroCategoria, filtroSupervisor, filtroDataInicio, filtroDataFim].filter(Boolean).length;

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

  const placaOptions: Option[] = useMemo(
    () => equipamentosPesadosAtivos.map((eq: any) => ({ value: eq.placa, label: eq.placa })),
    [equipamentosPesadosAtivos]
  );

  const colaboradorOptions: Option[] = useMemo(() => {
    const mecanicos = (colaboradores || []).filter((c: any) => !c.tipo || c.tipo.toUpperCase() === "MECÂNICO");
    const base = mecanicos.length > 0 ? mecanicos : (colaboradores || []);
    return base
      .map((c: any) => ({ value: c.nome, label: c.nome }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [colaboradores]);

  const catalogoPorCategoria = (categoriaBusca: string): Option[] =>
    (catalogos || [])
      .filter((c: any) => c.categoria === categoriaBusca)
      .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((c: any) => ({ value: c.valor, label: c.valor }));

  const supervisorOptions = useMemo(() => catalogoPorCategoria("supervisor"), [catalogos]);
  const equipeOptions = useMemo(() => catalogoPorCategoria("equipe_turno"), [catalogos]);
  const moduloOptions = useMemo(() => catalogoPorCategoria("modulo"), [catalogos]);
  const frenteTrabalhoOptions = useMemo(() => catalogoPorCategoria("frente_trabalho"), [catalogos]);
  const tipoManutencaoOptions = useMemo(() => catalogoPorCategoria("tipo_manutencao"), [catalogos]);

  // Catálogo de apontamentos (o que o colaborador está fazendo) — ordenado pelo código,
  // o que já agrupa naturalmente Improdutivo (1xx) antes de Produtivo (2xx).
  const apontamentoOptions: Option[] = useMemo(() => {
    return (apontamentosCatalogo || [])
      .slice()
      .sort((a: any, b: any) => String(a.codigo).localeCompare(String(b.codigo)))
      .map((c: any) => ({
        value: c.codigo,
        label: `${c.produtivo ? "🟢 Produtivo" : "🟠 Improdutivo"} · ${c.codigo} · ${c.descricao}`
      }));
  }, [apontamentosCatalogo]);

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

  // Atividade já registrada que ocupa o mesmo horário do rascunho em edição — bloqueia o
  // registro enquanto existir, já que o colaborador não pode estar em duas atividades ao
  // mesmo tempo.
  const conflitoDraft = useMemo(() => {
    if (!draftAtividade?.hora_inicio || !draftAtividade?.hora_fim) return null;
    return apontamentosDaJornada.find(a =>
      a.id !== draftAtividade.id &&
      intervalosSeSobrepoem(draftAtividade.hora_inicio, draftAtividade.hora_fim, a.hora_inicio, a.hora_fim)
    ) || null;
  }, [draftAtividade, apontamentosDaJornada]);

  const tempoTotalHorasCalculado = useMemo(() => somarMinutos(apontamentosDaJornada), [apontamentosDaJornada]);
  const tempoProdutivoCalculado = useMemo(
    () => somarMinutos(apontamentosDaJornada.filter(a => a.produtivo ?? isAtividadeProdutiva(a.tipo_atividade))),
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
      toast.show("Preencha o Nome do Colaborador.", "error");
      return;
    }
    if (finalizar && apontamentosDaJornada.length === 0) {
      toast.show("Adicione ao menos uma atividade antes de finalizar a jornada.", "error");
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
      toast.show(finalizar ? "Jornada finalizada com sucesso!" : "Rascunho salvo!", "success");

      if (finalizar) {
        setSelectedFichaForPDF(updatedFicha);
        resetForm();
      }
    } catch (err: any) {
      console.error("Erro no armazenamento local da ficha:", err);
      toast.show(`Erro ao gravar dados no dispositivo: ${err?.message || String(err)}`, "error");
    }
  };

  // Carregar Jornada para Edição / Visualização / Continuidade. `navigate: false` só
  // preenche os dados sem tirar o usuário da tela de menu (usado na retomada automática).
  const handleEditFicha = (f: FichaMaoObraItem, options?: { navigate?: boolean }) => {
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
    if (options?.navigate !== false) setActiveTab("form");
  };

  // Retoma automaticamente a jornada de hoje já aberta pelo colaborador (mesmo nome + mesma
  // data), caso exista — permite dar continuidade aos apontamentos do dia em outra sessão/
  // aparelho sem duplicar a jornada. Só carrega os dados em segundo plano: quem decide
  // entrar no formulário é o usuário, clicando no card — a tela inicial continua sendo
  // sempre o menu de cards.
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
      handleEditFicha(aberta, { navigate: false });
    }
    autoLoadedRef.current = true;
  }, [fichas, mecanicoNome]);

  // ─── Atividades: apontar, editar, remover (cada uma é sua própria linha no banco) ───

  const handleNovaAtividade = () => {
    if (!mecanicoNome.trim()) {
      toast.show("Preencha o Nome do Colaborador antes de apontar atividades.", "error");
      return;
    }
    setDraftAtividade({
      id: gerarId(),
      tipo_atividade: "",
      tipo_manutencao: "",
      apontamento_codigo: "",
      produtivo: false,
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
    field: "tipo_manutencao" | "placa" | "descricao" | "hora_inicio" | "hora_fim",
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

  // Selecionar o apontamento (o que está sendo feito) já define de uma vez a descrição
  // e se é produtivo ou improdutivo, direto do catálogo — não depende mais de tentar
  // adivinhar por texto.
  const handleSelecionarApontamento = (codigo: string) => {
    const item = (apontamentosCatalogo || []).find((c: any) => c.codigo === codigo);
    setDraftAtividade(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        apontamento_codigo: codigo,
        tipo_atividade: item?.descricao || "",
        produtivo: item?.produtivo ?? false
      };
    });
  };

  // Confirma e grava UMA atividade imediatamente (não espera o "Salvar" geral da jornada) —
  // é isso que torna seguro vários colaboradores apontando ao mesmo tempo em celulares
  // diferentes: cada apontamento é sua própria gravação, nunca sobrescreve a lista inteira.
  const handleRegistrarAtividade = async () => {
    if (!draftAtividade) return;
    if (!draftAtividade.apontamento_codigo) {
      toast.show("Selecione o apontamento (o que está sendo feito).", "error");
      return;
    }
    if (!draftAtividade.hora_inicio) {
      toast.show("Informe pelo menos o horário de início da atividade.", "error");
      return;
    }
    if (conflitoDraft) {
      toast.show(`Esse horário sobrepõe "${conflitoDraft.tipo_atividade}" (${conflitoDraft.hora_inicio} → ${conflitoDraft.hora_fim}).`, "error");
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
        tipo_manutencao: draftAtividade.tipo_manutencao || undefined,
        apontamento_codigo: draftAtividade.apontamento_codigo || undefined,
        placa: draftAtividade.placa || undefined,
        descricao: draftAtividade.descricao || "",
        hora_inicio: draftAtividade.hora_inicio || "",
        hora_fim: draftAtividade.hora_fim || "",
        tempo_gasto: draftAtividade.tempo_gasto || "",
        produtivo: draftAtividade.produtivo ?? isAtividadeProdutiva(draftAtividade.tipo_atividade),
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
      toast.show("Atividade registrada!", "success");
    } finally {
      setSavingAtividade(false);
    }
  };

  const handleExcluirAtividade = async (id: string) => {
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
    try {
      await localDb.delete("fichas_mao_obra", id);
      setFichas(prev => prev.filter(f => f.id !== id));
      setApontamentos(prev => prev.filter(a => a.jornada_id !== id));
      if (isOnline) {
        await excluirFichaMaoObra(id);
      }
      toast.show("Jornada excluída.", "success");
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
          toast.show("Jornada duplicada com sucesso!", "success");
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
          toast.show("Jornada duplicada offline com sucesso!", "success");
        }
      }
    } catch (err) {
      console.error("Erro ao duplicar ficha:", err);
    }
  };

  // Reabrir Jornada finalizada (admin)
  const handleReabrirJornada = async (id: string) => {
    if (!isOnline) {
      toast.show("Reabrir uma jornada requer conexão com a internet.", "error");
      return;
    }
    const res = await reabrirJornada(id);
    if ("error" in res && res.error) {
      toast.show(res.error, "error");
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

  // Segurança de exibição: mecânicos e motoristas só veem as próprias fichas no histórico
  // — só o admin acompanha o que todo mundo lançou. Prioriza created_by (id do usuário
  // autenticado) por ser confiável; cai pro nome só em fichas antigas sem esse campo
  // preenchido. Calculado à parte dos filtros de busca (placa/categoria/data) pra também
  // poder alimentar o contador do card de menu sem herdar um filtro de busca esquecido.
  const meuNomeNormalizado = (profile?.full_name || "").trim().toLowerCase();
  const fichasVisiveis = useMemo(() => {
    if (isAdmin) return fichas;
    return fichas.filter(f => {
      const donoId = (f as any).created_by;
      return donoId
        ? donoId === user?.id
        : (f.mecanico_nome || "").trim().toLowerCase() === meuNomeNormalizado;
    });
  }, [fichas, isAdmin, user?.id, meuNomeNormalizado]);

  // Lista Filtrada do Histórico
  const fichasFiltradas = useMemo(() => {
    return fichasVisiveis.filter(f => {
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
  }, [fichasVisiveis, apontamentos, filtroMecanico, filtroPlaca, filtroCategoria, filtroSupervisor, filtroDataInicio, filtroDataFim]);

  const fichaDoActionSheet = useMemo(
    () => fichasFiltradas.find(f => f.id === actionSheetFichaId) || null,
    [fichasFiltradas, actionSheetFichaId]
  );

  const actionSheetItems: ActionSheetItem[] = useMemo(() => {
    if (!fichaDoActionSheet) return [];
    const f = fichaDoActionSheet;
    const items: ActionSheetItem[] = [
      { key: "ver", label: "Ver / Imprimir", icon: Printer, onSelect: () => setSelectedFichaForPDF(f) },
      { key: "editar", label: "Editar", icon: Pencil, onSelect: () => handleEditFicha(f) },
      { key: "duplicar", label: "Duplicar", icon: Copy, onSelect: () => handleDuplicateFicha(f.id) }
    ];
    if (isAdmin && f.status === "Finalizado") {
      items.push({ key: "reabrir", label: "Reabrir Jornada", icon: RefreshCcw, onSelect: () => setPendingConfirm({ kind: "reabrir-ficha", id: f.id }) });
    }
    if (isAdmin) {
      items.push({ key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setPendingConfirm({ kind: "excluir-ficha", id: f.id, numero: f.numero_ficha }) });
    }
    return items;
  }, [fichaDoActionSheet, isAdmin]);

  const inputCls = "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60 disabled:cursor-not-allowed placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const subTelaTitulo =
    activeTab === "form" ? "Apontamento do Dia" :
    activeTab === "historico" ? "Histórico" :
    activeTab === "dashboard" ? "Dashboard" :
    activeTab === "catalogos" ? "Catálogos" : "";

  return (
    <div className="min-h-full">
      {/* ─── MENU DE CARDS (TELA INICIAL DO MÓDULO) ─── */}
      {activeTab === "menu" && (
        <div className="p-4 space-y-2.5">
          <ListRow
            icon={<PenTool size={18} />}
            title="Apontamento do Dia"
            subtitle="Registrar atividades da jornada"
            onClick={() => setActiveTab("form")}
          />
          <ListRow
            icon={<FileText size={18} />}
            title={`Histórico (${fichasVisiveis.length})`}
            subtitle="Ver e editar jornadas lançadas"
            onClick={() => setActiveTab("historico")}
          />
          <ListRow
            icon={<BarChart2 size={18} />}
            title="Dashboard"
            subtitle="Gráficos e indicadores"
            onClick={() => setActiveTab("dashboard")}
          />
          {isAdmin && (
            <ListRow
              icon={<Layers size={18} />}
              title="Catálogos"
              subtitle="Gerenciar listas do formulário"
              onClick={() => setActiveTab("catalogos")}
            />
          )}
        </div>
      )}

      {/* ─── SUB-TELAS (com cabeçalho local de volta ao menu do módulo) ─── */}
      {activeTab !== "menu" && (
        <>
          <div
            className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800"
          >
            <button
              onClick={() => setActiveTab("menu")}
              aria-label="Voltar ao menu de Mão de Obra"
              className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="flex-1 text-sm font-black text-zinc-50">{subTelaTitulo}</h2>
            {activeTab === "historico" && (
              <button
                onClick={() => setFiltrosOpen(true)}
                aria-label="Filtros"
                className="relative flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
                style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
              >
                <Filter size={18} />
                {filtrosAtivos > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
                )}
              </button>
            )}
          </div>

          <div className="p-4 space-y-4 pb-24">
            {/* ─── APONTAMENTO DO DIA ─── */}
            {activeTab === "form" && (
              <>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-base font-black text-amber-500">{numeroFicha}</span>
                    <span className={cn(
                      "text-[10px] px-2.5 py-1 rounded-full font-black uppercase",
                      statusFicha === "Finalizado" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                    )}>
                      {statusFicha}
                    </span>
                  </div>

                  {!canEdit && (
                    <div className="p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300 flex items-center justify-between gap-3 flex-wrap">
                      <span className="flex items-center gap-2"><Lock size={14} /> Jornada finalizada — somente leitura.</span>
                      {isAdmin && editingId && (
                        <button
                          type="button"
                          onClick={() => setPendingConfirm({ kind: "reabrir-ficha", id: editingId })}
                          className="px-3 py-2 bg-zinc-700 active:bg-zinc-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"
                          style={{ minHeight: "var(--tap-min)" }}
                        >
                          <RefreshCcw size={13} /> Reabrir Jornada
                        </button>
                      )}
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Nome do Colaborador *</label>
                      <SearchableSelect options={colaboradorOptions} value={mecanicoNome} onChange={setMecanicoNome} disabled={!canEdit} placeholder="Selecione o colaborador..." />
                    </div>
                    <div>
                      <label className={labelCls}>Matrícula</label>
                      <input type="text" disabled={!canEdit} value={mecanicoMatricula} onChange={e => setMecanicoMatricula(e.target.value)} placeholder="Ex: MEC-1234" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Equipe / Turno</label>
                        <SearchableSelect options={equipeOptions} value={equipe} onChange={setEquipe} disabled={!canEdit} placeholder="Turno..." />
                      </div>
                      <div>
                        <label className={labelCls}>Supervisor</label>
                        <SearchableSelect options={supervisorOptions} value={supervisor} onChange={setSupervisor} disabled={!canEdit} placeholder="Supervisor..." />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Módulo</label>
                        <SearchableSelect options={moduloOptions} value={modulo} onChange={setModulo} disabled={!canEdit} placeholder="Módulo..." />
                      </div>
                      <div>
                        <label className={labelCls}>Frente de Trabalho</label>
                        <SearchableSelect options={frenteTrabalhoOptions} value={frenteTrabalho} onChange={setFrenteTrabalho} disabled={!canEdit} placeholder="Frente..." />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Data</label>
                      <input type="date" disabled={!canEdit} value={dataJornada} onChange={e => setDataJornada(e.target.value)} className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Início da Jornada</label>
                        <input type="time" disabled={!canEdit} value={horaInicioJornada} onChange={e => setHoraInicioJornada(e.target.value)} className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Fim da Jornada</label>
                        <input type="time" disabled={!canEdit} value={horaFimJornada} onChange={e => setHoraFimJornada(e.target.value)} className={inputCls} />
                      </div>
                    </div>
                  </div>
                  {editingId && (
                    <p className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5">
                      <RefreshCcw size={11} /> Jornada em aberto — pode ser retomada de qualquer celular com o mesmo nome, na mesma data.
                    </p>
                  )}
                </Card>

                {mecanicoNome.trim() && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <StatTile icon={Clock} label="Total" value={`${tempoTotalHorasCalculado}h`} accent="zinc" />
                      <StatTile icon={CheckCircle2} label="Produtivo" value={`${tempoProdutivoCalculado}h`} accent="emerald" />
                      <StatTile icon={AlertCircle} label="Ocioso" value={`${tempoOciosoCalculado}h`} accent="amber" />
                    </div>

                    {tempoNaoApontadoCalculado > 0 && (
                      <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-xs font-bold text-red-400 flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        {tempoNaoApontadoCalculado}h da jornada ainda sem nenhuma atividade apontada.
                      </div>
                    )}

                    <div className="space-y-2">
                      <h3 className="text-xs font-extrabold uppercase text-zinc-400">Atividades do Dia</h3>
                      {apontamentosDaJornada.length === 0 && (
                        <EmptyState icon={Clock} title="Nenhuma atividade apontada ainda" />
                      )}
                      {apontamentosDaJornada.map(atv => (
                        <div
                          key={atv.id}
                          className={cn(
                            "p-3 rounded-2xl border flex items-start gap-3",
                            (atv.produtivo ?? isAtividadeProdutiva(atv.tipo_atividade))
                              ? "bg-emerald-950/20 border-emerald-900/40"
                              : "bg-amber-950/20 border-amber-900/40"
                          )}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {atv.apontamento_codigo && <span className="text-[9px] font-mono font-black text-zinc-500">#{atv.apontamento_codigo}</span>}
                              <span className="text-xs font-black text-zinc-100">{atv.tipo_atividade}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {atv.tipo_manutencao && <span className="text-[9px] font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded uppercase">{atv.tipo_manutencao}</span>}
                              {atv.placa && <span className="text-[10px] font-mono font-bold text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">{atv.placa}</span>}
                              <span className="text-[10px] font-bold text-zinc-500">{atv.hora_inicio || "—"} → {atv.hora_fim || "—"} ({formatMinutos(atv.tempo_gasto_minutos)})</span>
                            </div>
                            {atv.descricao && <p className="text-[11px] text-zinc-400 mt-1">{atv.descricao}</p>}
                          </div>
                          {canEdit && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => handleEditarAtividade(atv)} className="p-2 text-zinc-400 active:bg-zinc-800 rounded-lg" style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}>
                                <Pencil size={15} />
                              </button>
                              <button type="button" onClick={() => setPendingConfirm({ kind: "excluir-atividade", id: atv.id })} className="p-2 text-zinc-400 active:bg-red-950/40 active:text-red-400 rounded-lg" style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className={labelCls}>Observações Gerais</label>
                      <textarea
                        rows={3}
                        disabled={!canEdit}
                        value={observacoes}
                        onChange={e => setObservacoes(e.target.value)}
                        placeholder="Ex: Peça indisponível no estoque, aguardando autorização do supervisor..."
                        className={inputCls}
                      />
                    </div>

                    {canEdit && (
                      <div className="flex flex-col gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => handleSaveFicha(true)}
                          className="w-full rounded-xl text-sm font-black text-white bg-emerald-600 active:bg-emerald-700 flex items-center justify-center gap-2"
                          style={{ minHeight: "var(--tap-min)" }}
                        >
                          <CheckCircle2 size={16} /> Finalizar Jornada
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleSaveFicha(false)}
                            className="flex-1 rounded-xl text-xs font-black text-white bg-amber-600 active:bg-amber-700"
                            style={{ minHeight: "var(--tap-min)" }}
                          >
                            Salvar Cabeçalho
                          </button>
                          <button
                            type="button"
                            onClick={resetForm}
                            className="flex-1 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800 active:bg-zinc-700"
                            style={{ minHeight: "var(--tap-min)" }}
                          >
                            Nova Jornada
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* ─── HISTÓRICO ─── */}
            {activeTab === "historico" && (
              <div className="space-y-2">
                {fichasFiltradas.length === 0 && (
                  <EmptyState icon={FileText} title="Nenhum apontamento de mão de obra encontrado" />
                )}
                {fichasFiltradas.map(f => {
                  const qtdAtividades = apontamentos.filter(a => a.jornada_id === f.id).length;
                  return (
                    <ListRow
                      key={f.id}
                      title={`${f.numero_ficha} · ${f.mecanico_nome}`}
                      subtitle={`${(f.data_jornada || f.created_at?.split("T")[0] || "").split("-").reverse().join("/")} · ${qtdAtividades} ativ. · Total ${f.tempo_total_horas || 0}h`}
                      badge={
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase shrink-0",
                          f.status === "Finalizado" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
                        )}>
                          {f.status}
                        </span>
                      }
                      onClick={() => setActionSheetFichaId(f.id)}
                      rightSlot={<MoreVertical size={18} className="text-zinc-500" />}
                    />
                  );
                })}
              </div>
            )}

            {/* ─── DASHBOARD ─── */}
            {activeTab === "dashboard" && (
              <MaoDeObraDashboard fichas={fichas} apontamentos={apontamentos} colaboradores={colaboradores} calendario={calendario} />
            )}

            {/* ─── CATÁLOGOS (ADMIN) ─── */}
            {activeTab === "catalogos" && isAdmin && (
              <MaoDeObraCatalogos
                catalogos={catalogos}
                apontamentosCatalogo={apontamentosCatalogo}
                onCatalogoAdicionado={item => setCatalogos(prev => [...prev.filter(c => c.id !== item.id), item])}
                onCatalogoRemovido={id => setCatalogos(prev => prev.filter(c => c.id !== id))}
                onApontamentoAdicionado={item => setApontamentosCatalogo(prev => [...prev.filter(c => c.id !== item.id), item])}
                onApontamentoRemovido={id => setApontamentosCatalogo(prev => prev.filter(c => c.id !== id))}
              />
            )}
          </div>
        </>
      )}

      {/* FAB — apontar nova atividade (só na aba do formulário, com colaborador identificado) */}
      {activeTab === "form" && mecanicoNome.trim() && canEdit && (
        <Fab onClick={handleNovaAtividade} icon={<Plus size={20} />} label="Apontar" />
      )}

      {/* BOTTOM SHEET — rascunho da atividade sendo apontada */}
      <BottomSheet open={!!draftAtividade} onClose={handleCancelarDraft} title="Apontar Atividade">
        {draftAtividade && (
          <div className="space-y-3 pb-2">
            <div>
              <label className={labelCls}>Categoria (Tipo de Manutenção)</label>
              <SearchableSelect options={tipoManutencaoOptions} value={draftAtividade.tipo_manutencao || ""} onChange={v => updateDraftCampo("tipo_manutencao", v)} placeholder="— Não aplicável —" />
            </div>
            <div>
              <label className={labelCls}>Apontamento (Produtivo / Improdutivo) *</label>
              <SearchableSelect options={apontamentoOptions} value={draftAtividade.apontamento_codigo || ""} onChange={handleSelecionarApontamento} placeholder="Selecione o que está sendo feito..." />
            </div>
            <div>
              <label className={labelCls}>Placa (opcional)</label>
              <SearchableSelect options={placaOptions} value={draftAtividade.placa || ""} onChange={v => updateDraftCampo("placa", v)} placeholder="— Nenhuma —" />
            </div>
            <div>
              <label className={labelCls}>Observação (opcional)</label>
              <input type="text" value={draftAtividade.descricao} onChange={e => updateDraftCampo("descricao", e.target.value)} placeholder="Detalhe extra sobre a atividade..." className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Início</label>
                <input type="time" value={draftAtividade.hora_inicio || ""} onChange={e => updateDraftCampo("hora_inicio", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Término</label>
                <input type="time" value={draftAtividade.hora_fim || ""} onChange={e => updateDraftCampo("hora_fim", e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 font-black text-sm text-amber-400 text-center">
              Duração: {draftAtividade.tempo_gasto || "00:00"}
            </div>

            {conflitoDraft && (
              <div className="p-3 bg-red-950/30 border border-red-900/40 rounded-xl text-[11px] font-bold text-red-400 flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                Esse horário sobrepõe "{conflitoDraft.tipo_atividade}" ({conflitoDraft.hora_inicio} → {conflitoDraft.hora_fim}).
              </div>
            )}

            <button
              type="button"
              disabled={savingAtividade || !!conflitoDraft}
              onClick={handleRegistrarAtividade}
              className="w-full rounded-xl text-sm font-black text-white bg-emerald-600 active:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ minHeight: "var(--tap-min)" }}
            >
              {savingAtividade ? "Salvando..." : "Registrar Atividade"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* BOTTOM SHEET — filtros do histórico */}
      <BottomSheet open={filtrosOpen} onClose={() => setFiltrosOpen(false)} title="Filtros">
        <div className="space-y-3 pb-2">
          <div>
            <label className={labelCls}>Colaborador</label>
            <input type="text" placeholder="Colaborador..." value={filtroMecanico} onChange={e => setFiltroMecanico(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Placa</label>
            <input type="text" placeholder="Placa..." value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Apontamento</label>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} className={inputCls}>
              <option value="">-- Todos os Apontamentos --</option>
              {(apontamentosCatalogo || [])
                .slice()
                .sort((a: any, b: any) => String(a.codigo).localeCompare(String(b.codigo)))
                .map((t: any) => (
                  <option key={t.codigo} value={t.descricao}>{t.codigo} · {t.descricao}</option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Supervisor</label>
            <input type="text" placeholder="Supervisor..." value={filtroSupervisor} onChange={e => setFiltroSupervisor(e.target.value)} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>De</label>
              <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Até</label>
              <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setFiltroMecanico(""); setFiltroPlaca(""); setFiltroCategoria(""); setFiltroSupervisor(""); setFiltroDataInicio(""); setFiltroDataFim(""); }}
              className="flex-1 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-800 active:bg-zinc-700"
              style={{ minHeight: "var(--tap-min)" }}
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setFiltrosOpen(false)}
              className="flex-1 rounded-xl text-xs font-black text-white bg-amber-600 active:bg-amber-700"
              style={{ minHeight: "var(--tap-min)" }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* ACTION SHEET — ações por ficha no histórico (substitui o antigo menu flutuante ancorado) */}
      <ActionSheet
        open={!!actionSheetFichaId}
        onClose={() => setActionSheetFichaId(null)}
        title={fichaDoActionSheet ? `${fichaDoActionSheet.numero_ficha} · ${fichaDoActionSheet.mecanico_nome}` : undefined}
        items={actionSheetItems}
      />

      {/* CONFIRMAÇÕES (exclusão / reabertura) */}
      <ConfirmDialog
        open={pendingConfirm?.kind === "excluir-atividade"}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { if (pendingConfirm?.kind === "excluir-atividade") handleExcluirAtividade(pendingConfirm.id); }}
        title="Remover apontamento?"
        description="Essa atividade será removida da jornada."
        confirmLabel="Remover"
        destructive
      />
      <ConfirmDialog
        open={pendingConfirm?.kind === "excluir-ficha"}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { if (pendingConfirm?.kind === "excluir-ficha") handleDeleteFicha(pendingConfirm.id); }}
        title="Excluir jornada?"
        description={pendingConfirm?.kind === "excluir-ficha" ? `A jornada ${pendingConfirm.numero} e todas as atividades registradas nela serão removidas.` : undefined}
        confirmLabel="Excluir"
        destructive
      />
      <ConfirmDialog
        open={pendingConfirm?.kind === "reabrir-ficha"}
        onClose={() => setPendingConfirm(null)}
        onConfirm={() => { if (pendingConfirm?.kind === "reabrir-ficha") handleReabrirJornada(pendingConfirm.id); }}
        title="Reabrir esta jornada?"
        description="A jornada volta a ficar editável."
        confirmLabel="Reabrir"
      />

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
