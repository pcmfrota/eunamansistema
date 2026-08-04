"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Droplets,
  Calendar,
  Clock,
  Truck,
  User,
  MapPin,
  Camera,
  Upload,
  Save,
  Send,
  FileText,
  Share2,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  LayoutDashboard,
  ClipboardList,
  History,
  PenTool,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { offlineMedia } from "@/lib/offline-media";
import { FichaLubrificacao } from "@/src/services/LubrificacaoService";
import { registrarFichaLubrificacao, atualizarFichaLubrificacao, excluirFichaLubrificacao } from "./actions";
import { TruckTireCalibrator, TireCalibrationItem } from "./components/TruckTireCalibrator";
import { LubrificacaoDashboard } from "./components/LubrificacaoDashboard";
import { LubrificacaoHistorico } from "./components/LubrificacaoHistorico";
import { gerarPDFLubrificacao } from "./components/LubrificacaoPDF";
import { cn } from "@/lib/utils";

const ITENS_LUBRIFICACAO_DEFAULT = [
  { item: "Pinos da manga de eixo da direção (lado direito)", qtdPrevista: 6, unidade: "Graxeiros", status: "Executado", observacao: "" },
  { item: "Pinos da manga de eixo da direção (lado esquerdo)", qtdPrevista: 6, unidade: "Graxeiros", status: "Executado", observacao: "" },
  { item: "Cruzetas da transmissão", qtdPrevista: 4, unidade: "Qtd", status: "Executado", observacao: "" },
  { item: "Cruzetas da tomada de força (PIPA/Comboio)", qtdPrevista: 2, unidade: "Qtd", status: "Executado", observacao: "" },
  { item: "Rolamento central", qtdPrevista: 1, unidade: "Qtd", status: "Executado", observacao: "" },
  { item: "Catracas de freio dianteiras", qtdPrevista: 3, unidade: "Qtd", status: "Executado", observacao: "" },
  { item: "Catracas de freio traseiras", qtdPrevista: 3, unidade: "Qtd", status: "Executado", observacao: "" },
  { item: "Articulações do cilindro do deslizante e basculante", qtdPrevista: 4, unidade: "Qtd", status: "Executado", observacao: "" },
];

const ITENS_GERAL_DEFAULT = [
  { item: "Limpeza do filtro de ar", status: "SIM", observacao: "" },
  { item: "Esgotar água do racoor", status: "SIM", observacao: "" },
  { item: "Drenagem do compressor de ar", status: "SIM", observacao: "" },
  { item: "Verificar nível do óleo do motor", status: "SIM", observacao: "" },
  { item: "Verificar nível do líquido de arrefecimento", status: "SIM", observacao: "" },
  { item: "Reapertar grampos do chassi", status: "SIM", observacao: "" },
  { item: "Reapertar grampos dos feixes de molas", status: "SIM", observacao: "" },
  { item: "Reapertar parafusos dos vasos de pressão", status: "SIM", observacao: "" },
  { item: "Verificar suspiro do diferencial", status: "SIM", observacao: "" },
  { item: "Regular catracas de freio", status: "SIM", observacao: "" },
];

const ITENS_REAPERTOS_DEFAULT = [
  { item: "Feixe de Molas", status: "Executado", observacao: "" },
  { item: "Grampos", status: "Executado", observacao: "" },
  { item: "Suspensão", status: "Executado", observacao: "" },
  { item: "Vasos de pressão", status: "Executado", observacao: "" },
  { item: "Cardan", status: "Executado", observacao: "" },
  { item: "Suportes", status: "Executado", observacao: "" },
  { item: "Caixa de direção", status: "Executado", observacao: "" },
  { item: "Diferencial", status: "Executado", observacao: "" },
  { item: "Cubos", status: "Executado", observacao: "" },
  { item: "Rodas", status: "Executado", observacao: "" },
  { item: "Outros", status: "Não Executado", observacao: "" },
];

export default function LubrificacaoClient() {
  const { isOnline } = useOffline();
  const [activeTab, setActiveTab] = useState<"formulario" | "dashboard" | "historico">("formulario");

  // Dados auxiliares
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [mecanicos, setMecanicos] = useState<any[]>([]);
  const [fichas, setFichas] = useState<FichaLubrificacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ESTADO DO FORMULÁRIO
  const [horaInicio, setHoraInicio] = useState("07:00");
  const [horaFim, setHoraFim] = useState("08:00");
  const [equipamentoId, setEquipamentoId] = useState("");
  const [placa, setPlaca] = useState("");
  const [horimetroInicio, setHorimetroInicio] = useState<string>("");
  const [horimetroFim, setHorimetroFim] = useState<string>("");
  const [mecanicoResponsavel, setMecanicoResponsavel] = useState("");
  const [ajudante, setAjudante] = useState("");
  const [localServico, setLocalServico] = useState("OFICINA BASE");
  const [modulo, setModulo] = useState("BASE");
  const [cliente, setCliente] = useState("SUZANO");

  // Checklists
  const [checklistLub, setChecklistLub] = useState(ITENS_LUBRIFICACAO_DEFAULT);
  const [checklistGeral, setChecklistGeral] = useState(ITENS_GERAL_DEFAULT);
  const [calibragem, setCalibragem] = useState<TireCalibrationItem[]>([]);
  const [reapertos, setReapertos] = useState(ITENS_REAPERTOS_DEFAULT);

  // Evidências (Fotos Base64 / Local Blob URLs)
  const [fotosAntes, setFotosAntes] = useState<string[]>([]);
  const [fotosDepois, setFotosDepois] = useState<string[]>([]);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsLocationStr, setGpsLocationStr] = useState<string>("");

  // Observações Gerais
  const [observacoes, setObservacoes] = useState("");

  // Assinaturas Digitais Canvas Refs
  const canvasMecanicoRef = useRef<HTMLCanvasElement | null>(null);
  const canvasLiderRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawingMecanico, setIsDrawingMecanico] = useState(false);
  const [isDrawingLider, setIsDrawingLider] = useState(false);
  const [hasSigMecanico, setHasSigMecanico] = useState(false);
  const [hasSigLider, setHasSigLider] = useState(false);
  const [sigMecanicoBase64, setSigMecanicoBase64] = useState<string>("");
  const [sigLiderBase64, setSigLiderBase64] = useState<string>("");

  // Carrega Equipamentos, Colaboradores e Fichas (Online + IndexedDB Local)
  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // 1. Carrega dados do IndexedDB local imediatamente para agilidade offline
      const localEq = await localDb.getAll("equipamentos");
      const localColab = await localDb.getAll("colaboradores");
      const localFichas = await localDb.getAll("fichas_lubrificacao");

      if (localEq.length > 0) setEquipamentos(localEq);
      if (localColab.length > 0) setMecanicos(localColab);
      if (localFichas.length > 0) setFichas(localFichas);

      // 2. Se online, busca versão fresca do Supabase
      if (navigator.onLine) {
        const { obterFichasLubrificacao, obterEquipamentosLubrificacao, obterMecanicosLubrificacao } = await import("./actions");
        const [resF, resE, resM] = await Promise.all([
          obterFichasLubrificacao(),
          obterEquipamentosLubrificacao(),
          obterMecanicosLubrificacao(),
        ]);

        if (resE.data) {
          setEquipamentos(resE.data);
          await localDb.saveMany("equipamentos", resE.data);
        }
        if (resM.data) {
          setMecanicos(resM.data);
          await localDb.saveMany("colaboradores", resM.data);
        }
        if (resF.data) {
          setFichas(resF.data);
          await localDb.saveMany("fichas_lubrificacao", resF.data);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados de lubrificação:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Captura GPS Geolocation automaticamente
    if (typeof window !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLat(pos.coords.latitude);
          setGpsLng(pos.coords.longitude);
          setGpsLocationStr(`Lat: ${pos.coords.latitude.toFixed(5)}, Lng: ${pos.coords.longitude.toFixed(5)}`);
        },
        (err) => console.warn("GPS Geolocation indisponível:", err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // Quando escolhe um Equipamento, autoprenche Placa e Módulo
  const handleSelectEquipamento = (eqId: string) => {
    setEquipamentoId(eqId);
    const found = equipamentos.find((e) => e.id === eqId || e.placa === eqId);
    if (found) {
      setPlaca(found.placa || "");
      if (found.modulo) setModulo(found.modulo);
    }
  };

  // Canvas Handlers para Assinaturas Digitais
  useEffect(() => {
    const initCanvas = (canvas: HTMLCanvasElement | null) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
      }
    };
    initCanvas(canvasMecanicoRef.current);
    initCanvas(canvasLiderRef.current);
  }, [activeTab]);

  const startDrawing = (e: any, setDrawing: (val: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement>) => {
    setDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const draw = (e: any, isDrawing: boolean, canvasRef: React.RefObject<HTMLCanvasElement>, setHasSig: (v: boolean) => void) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    ctx?.lineTo(x, y);
    ctx?.stroke();
    setHasSig(true);
  };

  const stopDrawing = (setDrawing: (val: boolean) => void, canvasRef: React.RefObject<HTMLCanvasElement>, setSigBase64: (val: string) => void) => {
    setDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSigBase64(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = (canvasRef: React.RefObject<HTMLCanvasElement>, setHasSig: (v: boolean) => void, setSigBase64: (v: string) => void) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      setHasSig(false);
      setSigBase64("");
    }
  };

  // Upload de Fotos (Antes / Depois)
  const handlePhotoCapture = (type: "antes" | "depois", event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const maxPhotos = 5;
    const currentList = type === "antes" ? fotosAntes : fotosDepois;

    if (currentList.length + files.length > maxPhotos) {
      alert(`Você pode adicionar no máximo ${maxPhotos} fotos para ${type}.`);
      return;
    }

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        if (base64) {
          if (type === "antes") setFotosAntes((prev) => [...prev, base64]);
          else setFotosDepois((prev) => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Cálculo de Porcentagem de Progresso do Serviço (0 a 100%)
  const progressPercent = React.useMemo(() => {
    let steps = 0;
    let done = 0;

    // Header (Placa + Horímetro + Mecânico)
    steps += 3;
    if (placa) done++;
    if (horimetroInicio && horimetroFim) done++;
    if (mecanicoResponsavel) done++;

    // Checklist Lubrificação
    steps += checklistLub.length;
    done += checklistLub.filter((i) => i.status).length;

    // Checklist Geral
    steps += checklistGeral.length;
    done += checklistGeral.filter((i) => i.status).length;

    // Calibragem (pelo menos 1)
    steps += 1;
    if (calibragem.length > 0) done++;

    // Evidências Fotos
    steps += 2;
    if (fotosAntes.length > 0) done++;
    if (fotosDepois.length > 0) done++;

    // Assinatura Mecânico
    steps += 1;
    if (hasSigMecanico || sigMecanicoBase64) done++;

    return Math.min(100, Math.round((done / steps) * 100));
  }, [placa, horimetroInicio, horimetroFim, mecanicoResponsavel, checklistLub, checklistGeral, calibragem, fotosAntes, fotosDepois, hasSigMecanico, sigMecanicoBase64]);

  // Validação Rigorosa das Regras de Negócio
  const validateForm = (): boolean => {
    const hInic = parseFloat(horimetroInicio);
    const hFim = parseFloat(horimetroFim);

    if (!placa) {
      alert("Selecione um Equipamento / Placa antes de prosseguir.");
      return false;
    }
    if (isNaN(hInic) || isNaN(hFim)) {
      alert("Informe o Horímetro Inicial e o Horímetro Final corretamente.");
      return false;
    }
    if (hFim < hInic) {
      alert("O Horímetro Final deve ser maior ou igual ao Horímetro Inicial.");
      return false;
    }
    if (!mecanicoResponsavel) {
      alert("Informe o Mecânico Responsável pela execução da lubrificação.");
      return false;
    }
    if (fotosAntes.length < 1) {
      alert("É OBRIGATÓRIO adicionar no mínimo 1 Foto Antes do serviço.");
      return false;
    }
    if (fotosDepois.length < 1) {
      alert("É OBRIGATÓRIO adicionar no mínimo 1 Foto Depois do serviço.");
      return false;
    }
    if (!hasSigMecanico && !sigMecanicoBase64) {
      alert("É OBRIGATÓRIA a Assinatura Digital do Mecânico Responsável.");
      return false;
    }
    return true;
  };

  // Limpar formulário
  const handleResetForm = () => {
    setEditingId(null);
    setEquipamentoId("");
    setPlaca("");
    setHorimetroInicio("");
    setHorimetroFim("");
    setMecanicoResponsavel("");
    setAjudante("");
    setObservacoes("");
    setFotosAntes([]);
    setFotosDepois([]);
    setCalibragem([]);
    setChecklistLub(ITENS_LUBRIFICACAO_DEFAULT);
    setChecklistGeral(ITENS_GERAL_DEFAULT);
    setReapertos(ITENS_REAPERTOS_DEFAULT);
    clearCanvas(canvasMecanicoRef, setHasSigMecanico, setSigMecanicoBase64);
    clearCanvas(canvasLiderRef, setHasSigLider, setSigLiderBase64);
  };

  // Salvar Registro (Online / Offline IndexedDB)
  const handleSave = async (modo: "offline" | "enviar") => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      const payload: Partial<FichaLubrificacao> = {
        id: editingId || `temp_lub_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        data_registro: new Date().toISOString(),
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        equipamento_id: equipamentoId || undefined,
        placa: placa.toUpperCase(),
        modulo,
        local_servico: localServico,
        cliente,
        horimetro_inicio: parseFloat(horimetroInicio),
        horimetro_fim: parseFloat(horimetroFim),
        mecanico_responsavel: mecanicoResponsavel,
        ajudante: ajudante || null,
        checklist_lubrificacao: checklistLub,
        checklist_geral: checklistGeral,
        calibragem,
        reapertos,
        fotos_antes: fotosAntes,
        fotos_depois: fotosDepois,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
        observacoes,
        assinatura_mecanico: sigMecanicoBase64,
        assinatura_lider: sigLiderBase64 || null,
        status: "CONCLUÍDO",
      };

      // 1. Sempre salva localmente no IndexedDB 'fichas_lubrificacao'
      await localDb.put("fichas_lubrificacao", payload);

      if (modo === "enviar" && isOnline) {
        // Envio online direto via Server Action
        let res;
        if (editingId) {
          res = await atualizarFichaLubrificacao(editingId, payload);
        } else {
          res = await registrarFichaLubrificacao(payload);
        }
        if (res?.error) throw new Error(res.error);
        alert("Ficha de Lubrificação gravada e sincronizada com sucesso!");
      } else {
        // Modo offline ou sem internet: adiciona na Fila de Sincronização do IndexedDB
        await localDb.addToQueue("ficha_lubrificacao" as any, editingId ? "update" : "create", payload);
        alert("Ficha de Lubrificação salva LOCALMENTE no aparelho! Será enviada automaticamente ao reconectar à internet.");
      }

      handleResetForm();
      await loadInitialData();
    } catch (err: any) {
      alert(`Erro ao salvar ficha: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // Ação Editar
  const handleEditFicha = (f: FichaLubrificacao) => {
    setEditingId(f.id);
    setHoraInicio(f.hora_inicio || "07:00");
    setHoraFim(f.hora_fim || "08:00");
    setPlaca(f.placa);
    setHorimetroInicio(String(f.horimetro_inicio));
    setHorimetroFim(String(f.horimetro_fim));
    setMecanicoResponsavel(f.mecanico_responsavel);
    setAjudante(f.ajudante || "");
    setLocalServico(f.local_servico);
    setModulo(f.modulo);
    setCliente(f.cliente);
    setObservacoes(f.observacoes || "");

    if (Array.isArray(f.checklist_lubrificacao)) setChecklistLub(f.checklist_lubrificacao);
    if (Array.isArray(f.checklist_geral)) setChecklistGeral(f.checklist_geral);
    if (Array.isArray(f.calibragem)) setCalibragem(f.calibragem);
    if (Array.isArray(f.reapertos)) setReapertos(f.reapertos);
    if (Array.isArray(f.fotos_antes)) setFotosAntes(f.fotos_antes);
    if (Array.isArray(f.fotos_depois)) setFotosDepois(f.fotos_depois);

    if (f.assinatura_mecanico) {
      setSigMecanicoBase64(f.assinatura_mecanico);
      setHasSigMecanico(true);
    }

    setActiveTab("formulario");
  };

  // Ação Duplicar
  const handleDuplicateFicha = (f: FichaLubrificacao) => {
    handleEditFicha(f);
    setEditingId(null); // Reseta o ID para criar um novo lançamento
    alert("Dados duplicados na ficha! Ajuste os horímetros e salve a nova lubrificação.");
  };

  // Ação Excluir
  const handleDeleteFicha = async (id: string) => {
    try {
      await localDb.delete("fichas_lubrificacao", id);
      if (isOnline) {
        await excluirFichaLubrificacao(id);
      } else {
        await localDb.addToQueue("ficha_lubrificacao" as any, "delete", { id });
      }
      alert("Ficha excluída com sucesso!");
      loadInitialData();
    } catch (e) {
      alert("Erro ao excluir ficha.");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-6 space-y-6">
      
      {/* BANNER PRINCIPAL COM NAVEGAÇÃO DE ABAS */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-green-800 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
              EUNAMAN PCM • FROTA
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-400/30">
              {isOnline ? "ONLINE SYNC" : "OFFLINE LOCAL"}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase flex items-center gap-3">
            <Droplets className="animate-pulse" size={32} />
            Módulo de Lubrificação
          </h1>
          <p className="text-xs text-emerald-100 max-w-xl font-medium">
            Controle de lubricidade, calibragem de pneus, reapertos e inspecção técnica da frota com funcionamento 100% offline.
          </p>
        </div>

        {/* Botoes de Navegação das Abas */}
        <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl backdrop-blur-md border border-white/10 z-10 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab("formulario")}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === "formulario"
                ? "bg-white text-emerald-800 shadow-lg scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <PenTool size={16} />
            Formulário Ficha
          </button>

          <button
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === "dashboard"
                ? "bg-white text-emerald-800 shadow-lg scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </button>

          <button
            onClick={() => setActiveTab("historico")}
            className={cn(
              "flex-1 sm:flex-initial px-4 py-2.5 rounded-xl font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2",
              activeTab === "historico"
                ? "bg-white text-emerald-800 shadow-lg scale-105"
                : "text-white/80 hover:text-white hover:bg-white/10"
            )}
          >
            <History size={16} />
            Histórico ({fichas.length})
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          ABA 1: FORMULÁRIO DE LUBRIFICAÇÃO (FICHA COMPLETA)
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "formulario" && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* BARRA DE PROGRESSO DO SERVIÇO */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider">
              <span className="text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-500" />
                Indicador de Conformidade do Serviço
              </span>
              <span className="text-emerald-600 dark:text-emerald-400">{progressPercent}% Concluído</span>
            </div>
            <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* 1. CABEÇALHO */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-3">
              <Truck size={18} />
              1. Cabeçalho & Dados de Identificação do Veículo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              
              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Equipamento (Lista de Frota)</label>
                <select
                  value={equipamentoId}
                  onChange={(e) => handleSelectEquipamento(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="">Selecione o Equipamento...</option>
                  {equipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.placa} ({eq.modulo || 'BASE'}) - {eq.tipo || 'Comboio'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Placa (Automático)</label>
                <input
                  type="text"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC-1234"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono font-black uppercase focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Horímetro Inicial *</label>
                <input
                  type="number"
                  step="0.1"
                  value={horimetroInicio}
                  onChange={(e) => setHorimetroInicio(e.target.value)}
                  placeholder="Ex: 1250"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Horímetro Final *</label>
                <input
                  type="number"
                  step="0.1"
                  value={horimetroFim}
                  onChange={(e) => setHorimetroFim(e.target.value)}
                  placeholder="Ex: 1255"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Hora Inicial</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Hora Final</label>
                <input
                  type="time"
                  value={horaFim}
                  onChange={(e) => setHoraFim(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Mecânico Responsável *</label>
                <input
                  type="text"
                  value={mecanicoResponsavel}
                  onChange={(e) => setMecanicoResponsavel(e.target.value)}
                  placeholder="Nome do Mecânico..."
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Ajudante (Opcional)</label>
                <input
                  type="text"
                  value={ajudante}
                  onChange={(e) => setAjudante(e.target.value)}
                  placeholder="Nome do Ajudante..."
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Local do Serviço</label>
                <input
                  type="text"
                  value={localServico}
                  onChange={(e) => setLocalServico(e.target.value)}
                  placeholder="Ex: OFICINA BASE"
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Módulo</label>
                <select
                  value={modulo}
                  onChange={(e) => setModulo(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="BASE">BASE</option>
                  <option value="COLHEITA">COLHEITA</option>
                  <option value="SILVICULTURA">SILVICULTURA</option>
                  <option value="TRANSPORTE">TRANSPORTE</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-zinc-500 mb-1">Cliente</label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

            </div>
          </div>

          {/* 2. CHECKLIST DE LUBRIFICAÇÃO */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-3">
              <Droplets size={18} />
              2. Checklist de Pontos de Lubrificação (Com Quantidades Previstas)
            </h3>

            <div className="space-y-3">
              {checklistLub.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-extrabold text-zinc-800 dark:text-zinc-200">{item.item}</p>
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Quantidade Prevista: {item.qtdPrevista} {item.unidade}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {(["Executado", "Não Executado", "Não se Aplica"] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          const next = [...checklistLub];
                          next[idx].status = st;
                          setChecklistLub(next);
                        }}
                        className={cn(
                          "px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                          item.status === st
                            ? st === "Executado"
                              ? "bg-emerald-500 text-white border-emerald-600"
                              : st === "Não Executado"
                              ? "bg-rose-500 text-white border-rose-600"
                              : "bg-zinc-600 text-white border-zinc-700"
                            : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                        )}
                      >
                        {st}
                      </button>
                    ))}
                    <input
                      type="text"
                      placeholder="Obs..."
                      value={item.observacao}
                      onChange={(e) => {
                        const next = [...checklistLub];
                        next[idx].observacao = e.target.value;
                        setChecklistLub(next);
                      }}
                      className="px-2 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[10px] flex-1 sm:w-36 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. CHECKLIST GERAL (SIM / NÃO) */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-3">
              <ClipboardList size={18} />
              3. Checklist Geral de Inspecção Técnica (SIM / NÃO)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {checklistGeral.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-2"
                >
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.item}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...checklistGeral];
                        next[idx].status = "SIM";
                        setChecklistGeral(next);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg font-black text-[10px] uppercase border transition-all",
                        item.status === "SIM"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                      )}
                    >
                      SIM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...checklistGeral];
                        next[idx].status = "NÃO";
                        setChecklistGeral(next);
                      }}
                      className={cn(
                        "px-3 py-1 rounded-lg font-black text-[10px] uppercase border transition-all",
                        item.status === "NÃO"
                          ? "bg-rose-500 text-white border-rose-600"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                      )}
                    >
                      NÃO
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. ABA CALIBRAGEM DE PNEUS (DIAGRAMA INTERATIVO DO CAMINHÃO) */}
          <TruckTireCalibrator
            calibragens={calibragem}
            onChange={(updated) => setCalibragem(updated)}
          />

          {/* 5. ABA REAPERTOS */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-3">
              <RotateCcw size={18} />
              5. Checklist de Reapertos da Suspensão e Eixos
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {reapertos.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between gap-2"
                >
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{item.item}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...reapertos];
                        next[idx].status = "Executado";
                        setReapertos(next);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border transition-all",
                        item.status === "Executado"
                          ? "bg-emerald-500 text-white border-emerald-600"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                      )}
                    >
                      Executado
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = [...reapertos];
                        next[idx].status = "Não Executado";
                        setReapertos(next);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border transition-all",
                        item.status === "Não Executado"
                          ? "bg-rose-500 text-white border-rose-600"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400"
                      )}
                    >
                      Não Exec.
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. EVIDÊNCIAS FOTOGRÁFICAS E GPS */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <Camera size={18} />
                6. Evidências Fotográficas & Geolocalização GPS (Obrigatório)
              </h3>
              {gpsLocationStr && (
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <MapPin size={12} /> {gpsLocationStr}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Fotos Antes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300">
                    📷 Fotos Antes (Mín. 1, Máx. 5) *
                  </label>
                  <span className="text-[10px] font-bold text-zinc-400">{fotosAntes.length} / 5</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {fotosAntes.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 shadow-sm group">
                      <img src={src} className="w-full h-full object-cover" alt={`Antes ${i}`} />
                      <button
                        type="button"
                        onClick={() => setFotosAntes(fotosAntes.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {fotosAntes.length < 5 && (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer text-zinc-400 hover:text-emerald-500 transition-all bg-zinc-50 dark:bg-zinc-950">
                      <Camera size={20} />
                      <span className="text-[9px] font-black uppercase mt-1">Adicionar</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => handlePhotoCapture("antes", e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Fotos Depois */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300">
                    📷 Fotos Depois (Mín. 1, Máx. 5) *
                  </label>
                  <span className="text-[10px] font-bold text-zinc-400">{fotosDepois.length} / 5</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  {fotosDepois.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-zinc-300 dark:border-zinc-700 shadow-sm group">
                      <img src={src} className="w-full h-full object-cover" alt={`Depois ${i}`} />
                      <button
                        type="button"
                        onClick={() => setFotosDepois(fotosDepois.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}

                  {fotosDepois.length < 5 && (
                    <label className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-500 flex flex-col items-center justify-center cursor-pointer text-zinc-400 hover:text-emerald-500 transition-all bg-zinc-50 dark:bg-zinc-950">
                      <Camera size={20} />
                      <span className="text-[9px] font-black uppercase mt-1">Adicionar</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={(e) => handlePhotoCapture("depois", e)}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* 7. OBSERVAÇÕES GERAIS */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                7. Observações Gerais do Serviço
              </label>
              <span className="text-[10px] font-bold text-zinc-400">{observacoes.length} / 2000 carac.</span>
            </div>
            <textarea
              rows={4}
              maxLength={2000}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Digite aqui observações adicionais sobre o estado dos componentes, vazamentos identificados..."
              className="w-full px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* 8. ASSINATURAS DIGITAIS */}
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2 border-b pb-3">
              <PenTool size={18} />
              8. Assinaturas Digitais do Mecânico e Líder
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Canvas Mecânico */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300">
                    Assinatura do Mecânico (Obrigatória) *
                  </label>
                  <button
                    type="button"
                    onClick={() => clearCanvas(canvasMecanicoRef, setHasSigMecanico, setSigMecanicoBase64)}
                    className="text-[10px] font-bold text-rose-500 hover:underline uppercase"
                  >
                    Limpar
                  </button>
                </div>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white touch-none">
                  <canvas
                    ref={canvasMecanicoRef}
                    width={340}
                    height={140}
                    onMouseDown={(e) => startDrawing(e, setIsDrawingMecanico, canvasMecanicoRef)}
                    onMouseMove={(e) => draw(e, isDrawingMecanico, canvasMecanicoRef, setHasSigMecanico)}
                    onMouseUp={() => stopDrawing(setIsDrawingMecanico, canvasMecanicoRef, setSigMecanicoBase64)}
                    onTouchStart={(e) => startDrawing(e, setIsDrawingMecanico, canvasMecanicoRef)}
                    onTouchMove={(e) => draw(e, isDrawingMecanico, canvasMecanicoRef, setHasSigMecanico)}
                    onTouchEnd={() => stopDrawing(setIsDrawingMecanico, canvasMecanicoRef, setSigMecanicoBase64)}
                    className="w-full h-36 cursor-crosshair"
                  />
                </div>
              </div>

              {/* Canvas Líder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300">
                    Assinatura do Líder (Opcional)
                  </label>
                  <button
                    type="button"
                    onClick={() => clearCanvas(canvasLiderRef, setHasSigLider, setSigLiderBase64)}
                    className="text-[10px] font-bold text-rose-500 hover:underline uppercase"
                  >
                    Limpar
                  </button>
                </div>
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-2xl overflow-hidden bg-white touch-none">
                  <canvas
                    ref={canvasLiderRef}
                    width={340}
                    height={140}
                    onMouseDown={(e) => startDrawing(e, setIsDrawingLider, canvasLiderRef)}
                    onMouseMove={(e) => draw(e, isDrawingLider, canvasLiderRef, setHasSigLider)}
                    onMouseUp={() => stopDrawing(setIsDrawingLider, canvasLiderRef, setSigLiderBase64)}
                    onTouchStart={(e) => startDrawing(e, setIsDrawingLider, canvasLiderRef)}
                    onTouchMove={(e) => draw(e, isDrawingLider, canvasLiderRef, setHasSigLider)}
                    onTouchEnd={() => stopDrawing(setIsDrawingLider, canvasLiderRef, setSigLiderBase64)}
                    className="w-full h-36 cursor-crosshair"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* 9. PAINEL DE AÇÕES / BOTÕES */}
          <div className="p-5 rounded-2xl bg-zinc-900 text-white shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-extrabold text-xs uppercase tracking-wider transition-colors"
              >
                Limpar Ficha
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave("offline")}
                disabled={loading}
                className="px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <Save size={16} />
                Salvar Offline
              </button>

              <button
                type="button"
                onClick={() => handleSave("enviar")}
                disabled={loading}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <Send size={16} />
                Enviar Ficha
              </button>

              <button
                type="button"
                onClick={() => {
                  if (validateForm()) {
                    gerarPDFLubrificacao({
                      placa,
                      data_registro: new Date().toISOString(),
                      hora_inicio: horaInicio,
                      hora_fim: horaFim,
                      horimetro_inicio: parseFloat(horimetroInicio),
                      horimetro_fim: parseFloat(horimetroFim),
                      mecanico_responsavel: mecanicoResponsavel,
                      ajudante,
                      local_servico: localServico,
                      modulo,
                      cliente,
                      checklist_lubrificacao: checklistLub,
                      checklist_geral: checklistGeral,
                      calibragem,
                      reapertos,
                      fotos_antes: fotosAntes,
                      fotos_depois: fotosDepois,
                      observacoes,
                      assinatura_mecanico: sigMecanicoBase64,
                      assinatura_lider: sigLiderBase64,
                    });
                  }
                }}
                className="px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center gap-2"
              >
                <FileText size={16} />
                Gerar PDF
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ABA 2: DASHBOARD DE INDICADORES
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "dashboard" && (
        <div className="animate-in fade-in">
          <LubrificacaoDashboard fichas={fichas} equipamentos={equipamentos} />
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ABA 3: HISTÓRICO E RELATÓRIOS
      ───────────────────────────────────────────────────────────── */}
      {activeTab === "historico" && (
        <div className="animate-in fade-in">
          <LubrificacaoHistorico
            fichas={fichas}
            onEdit={handleEditFicha}
            onDuplicate={handleDuplicateFicha}
            onDelete={handleDeleteFicha}
          />
        </div>
      )}

    </div>
  );
}
