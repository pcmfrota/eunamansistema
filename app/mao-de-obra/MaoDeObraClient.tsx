"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Wrench, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Camera, 
  Trash2, 
  FileText, 
  Printer, 
  Share2, 
  Send, 
  Mail, 
  Layers, 
  BarChart2, 
  Calendar, 
  User, 
  Truck, 
  ShieldAlert, 
  PenTool, 
  Copy, 
  Eye, 
  Pencil, 
  Download, 
  RefreshCcw,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import FichaPDFModal, { FichaMaoObraItem } from "./FichaPDFModal";
import { salvarFichaMaoObra, excluirFichaMaoObra, duplicarFichaMaoObra } from "./actions";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  LineChart, 
  Line,
  Legend
} from "recharts";

// Tipos por Manutenção
const TIPOS_MANUTENCAO = [
  "Manutenção Preventiva",
  "Manutenção Corretiva",
  "Elétrica",
  "Hidráulica",
  "Pneumática",
  "Solda",
  "Lubrificação",
  "Troca de Componentes",
  "Diagnóstico",
  "Inspeção",
  "Revisão",
  "Outro"
];

// Atividades Padrão
const ATIVIDADES_PADRAO = [
  "Diagnóstico",
  "Desmontagem",
  "Troca de peça",
  "Ajuste",
  "Teste operacional",
  "Limpeza",
  "Lubrificação",
  "Finalização"
];

interface MaoDeObraClientProps {
  initialFichas: FichaMaoObraItem[];
  equipamentos: any[];
  colaboradores: any[];
  userRole?: string;
}

export default function MaoDeObraClient({
  initialFichas,
  equipamentos = [],
  colaboradores = [],
  userRole = "mecanico"
}: MaoDeObraClientProps) {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const isVisitante = profile?.role === "visitante";
  const isAdmin = profile?.role === "admin" || userRole === "admin";

  const [activeTab, setActiveTab] = useState<"form" | "historico" | "dashboard">("form");
  const [fichas, setFichas] = useState<FichaMaoObraItem[]>(initialFichas || []);
  const [selectedFichaForPDF, setSelectedFichaForPDF] = useState<FichaMaoObraItem | null>(null);

  // Estados do Formulário (Nova Ficha / Edição)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [numeroFicha, setNumeroFicha] = useState(`MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
  const [statusFicha, setStatusFicha] = useState<"Em andamento" | "Finalizado">("Em andamento");

  // Dados do Mecânico
  const [mecanicoNome, setMecanicoNome] = useState(profile?.nome || "");
  const [mecanicoMatricula, setMecanicoMatricula] = useState("");
  const [equipe, setEquipe] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [modulo, setModulo] = useState("");
  const [frenteTrabalho, setFrenteTrabalho] = useState("");

  // Dados do Veículo
  const [placa, setPlaca] = useState("");
  const [equipamento, setEquipamento] = useState("");
  const [modelo, setModelo] = useState("");
  const [cliente, setCliente] = useState("");
  const [horimetro, setHorimetro] = useState<string>("");
  const [km, setKm] = useState<string>("");

  // Serviço & Manutenção
  const [tipoManutencao, setTipoManutencao] = useState("Manutenção Corretiva");
  const [descricaoServico, setDescricaoServico] = useState("");

  // Atividades Executadas
  const [atividades, setAtividades] = useState<{ id: string; descricao: string; checked: boolean; hora_inicio?: string; hora_fim?: string; tempo_gasto?: string }[]>(
    ATIVIDADES_PADRAO.map((desc, idx) => ({ id: `atv_${idx}`, descricao: desc, checked: false, hora_inicio: "", hora_fim: "", tempo_gasto: "" }))
  );
  const [novaAtividadeTexto, setNovaAtividadeTexto] = useState("");

  // Peças Utilizadas
  const [pecas, setPecas] = useState<{ codigo: string; descricao: string; quantidade: number }[]>([]);

  // Evidências Fotográficas
  const [fotosAntes, setFotosAntes] = useState<string[]>([]);
  const [fotosDepois, setFotosDepois] = useState<string[]>([]);

  // Observações & Geolocalização
  const [observacoes, setObservacoes] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();

  // Canvas de Assinaturas
  const [assinaturaMecanico, setAssinaturaMecanico] = useState<string>("");
  const [assinaturaSupervisor, setAssinaturaSupervisor] = useState<string>("");

  // Estados de Filtro do Histórico
  const [filtroMecanico, setFiltroMecanico] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroSupervisor, setFiltroSupervisor] = useState("");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  // Canvas Refs para assinatura touch/mouse
  const canvasMecanicoRef = useRef<HTMLCanvasElement | null>(null);
  const canvasSupervisorRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  // Seleção automática do perfil ao carregar
  useEffect(() => {
    if (profile?.nome && !mecanicoNome) {
      setMecanicoNome(profile.nome);
    }
  }, [profile]);

  // Capturar Geolocalização do Dispositivo ao abrir o formulário
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
        },
        (err) => console.log("Geolocalização não disponível:", err),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }, []);

  // Preenchimento automático ao selecionar a Placa
  const handleSelectPlaca = (selectedPlaca: string) => {
    setPlaca(selectedPlaca);
    const foundEq = equipamentos.find(e => e.placa === selectedPlaca);
    if (foundEq) {
      setEquipamento(foundEq.tipo || foundEq.categoria || "Caminhão");
      setModelo(foundEq.modelo || foundEq.modulo || "Padrão");
      setCliente(foundEq.area || "Suzano");
      if (foundEq.ultimoHist || foundEq.horimetro) {
        setHorimetro(String(foundEq.ultimoHist || foundEq.horimetro));
      }
    }
  };

  // Cálculo automático do tempo de uma atividade em formato "HH:MM"
  const calcTempoGastoAtividade = (inicio: string, fim: string): string => {
    if (!inicio || !fim) return "";
    const [h1, m1] = inicio.split(":").map(Number);
    const [h2, m2] = fim.split(":").map(Number);
    if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";
    
    let totalMinutes = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMinutes < 0) totalMinutes += 24 * 60; // Trata virada de dia
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  // Atualizar tempo de atividade ao mudar horário início ou fim
  const updateAtividadeHorario = (id: string, field: "hora_inicio" | "hora_fim", value: string) => {
    setAtividades(prev => prev.map(a => {
      if (a.id === id) {
        const updated = { ...a, [field]: value };
        const tempo = calcTempoGastoAtividade(
          field === "hora_inicio" ? value : (a.hora_inicio || ""),
          field === "hora_fim" ? value : (a.hora_fim || "")
        );
        return { ...updated, tempo_gasto: tempo, checked: true };
      }
      return a;
    }));
  };

  // Calcular o Total de Horas Trabalhadas
  const tempoTotalHorasCalculado = React.useMemo(() => {
    let totalMinutos = 0;
    atividades.forEach(a => {
      if (a.tempo_gasto) {
        const [h, m] = a.tempo_gasto.split(":").map(Number);
        if (!isNaN(h) && !isNaN(m)) {
          totalMinutos += h * 60 + m;
        }
      }
    });
    return Number((totalMinutos / 60).toFixed(2));
  }, [atividades]);

  // Estampar Marca D'água na Foto usando Canvas HTML5
  const stampPhotoWatermark = (dataUrl: string, placaRef: string, mecanicoRef: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(dataUrl);

        // Desenha imagem original
        ctx.drawImage(img, 0, 0);

        // Configura estilos da faixa da marca d'água no rodapé
        const barHeight = Math.max(30, img.height * 0.12);
        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.fillRect(0, img.height - barHeight, img.width, barHeight);

        const fontSize = Math.max(12, Math.floor(barHeight * 0.28));
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${fontSize}px sans-serif`;

        const dtStr = new Date().toLocaleString("pt-BR");
        const line1 = `EUNAMAN · ${placaRef || "PLACA"} · ${mecanicoRef || "MECÂNICO"}`;
        const line2 = `DATA: ${dtStr} ${latitude ? `· LAT: ${latitude.toFixed(4)} LONG: ${longitude?.toFixed(4)}` : ""}`;

        ctx.fillText(line1, 15, img.height - barHeight + fontSize + 6);
        ctx.fillText(line2, 15, img.height - (barHeight * 0.25));

        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => resolve(dataUrl);
    });
  };

  // Upload de Fotos (Antes ou Depois) com Marca D'água
  const handleUploadFoto = async (e: React.ChangeEvent<HTMLInputElement>, tipo: "antes" | "depois") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const list = Array.from(files).slice(0, 10);
    for (const file of list) {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const rawBase64 = evt.target?.result as string;
        if (rawBase64) {
          const stamped = await stampPhotoWatermark(rawBase64, placa, mecanicoNome);
          if (tipo === "antes") {
            setFotosAntes(prev => [...prev.slice(0, 9), stamped]);
          } else {
            setFotosDepois(prev => [...prev.slice(0, 9), stamped]);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Adicionar Peça Utilizada
  const handleAddPeca = () => {
    setPecas(prev => [...prev, { codigo: "", descricao: "", quantidade: 1 }]);
  };

  // Remover Peça
  const handleRemovePeca = (index: number) => {
    setPecas(prev => prev.filter((_, i) => i !== index));
  };

  // Limpar Formulário
  const resetForm = () => {
    setEditingId(null);
    setNumeroFicha(`MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setStatusFicha("Em andamento");
    setPlaca("");
    setEquipamento("");
    setModelo("");
    setCliente("");
    setHorimetro("");
    setKm("");
    setTipoManutencao("Manutenção Corretiva");
    setDescricaoServico("");
    setAtividades(ATIVIDADES_PADRAO.map((desc, idx) => ({ id: `atv_${idx}`, descricao: desc, checked: false, hora_inicio: "", hora_fim: "", tempo_gasto: "" })));
    setPecas([]);
    setFotosAntes([]);
    setFotosDepois([]);
    setObservacoes("");
    setAssinaturaMecanico("");
    setAssinaturaSupervisor("");
  };

  // Salvar Ficha (Offline-First)
  const handleSaveFicha = async (finalizar = false) => {
    if (!mecanicoNome.trim()) {
      alert("Por favor, preencha o Nome do Mecânico.");
      return;
    }
    if (!placa.trim()) {
      alert("Por favor, selecione ou digite a Placa do Veículo.");
      return;
    }
    if (!descricaoServico.trim()) {
      alert("Por favor, informe a Descrição do Serviço Executado.");
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
      placa,
      equipamento,
      modelo,
      cliente,
      horimetro: horimetro ? parseFloat(horimetro) : undefined,
      km: km ? parseFloat(km) : undefined,
      tipo_manutencao: tipoManutencao,
      descricao_servico: descricaoServico,
      atividades,
      tempo_total_horas: tempoTotalHorasCalculado,
      pecas,
      fotos_antes: fotosAntes,
      fotos_depois: fotosDepois,
      observacoes,
      assinatura_mecanico: assinaturaMecanico,
      assinatura_supervisor: assinaturaSupervisor,
      latitude,
      longitude,
      status: nextStatus,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      // 1. Salva localmente no IndexedDB
      await localDb.put("fichas_mao_obra", newFichaItem);
      setFichas(prev => [newFichaItem, ...prev.filter(f => f.id !== newFichaItem.id)]);

      // 2. Adiciona à fila de sincronização
      await localDb.addToQueue("ficha_mao_obra", "create", newFichaItem);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));

      // 3. Tenta salvar online no Supabase se estiver conectado
      if (isOnline) {
        await salvarFichaMaoObra(newFichaItem);
      }

      alert(finalizar ? "✅ Ficha Diária Finalizada com sucesso!" : "💾 Rascunho salvo localmente!");

      if (finalizar) {
        setSelectedFichaForPDF(newFichaItem);
        resetForm();
      }
    } catch (err) {
      console.error("Erro ao salvar ficha de mão de obra:", err);
      alert("Erro ao salvar ficha. Dados preservados localmente.");
    }
  };

  // Carregar Ficha para Edição
  const handleEditFicha = (f: FichaMaoObraItem) => {
    setEditingId(f.id);
    setNumeroFicha(f.numero_ficha);
    setStatusFicha(f.status as any);
    setMecanicoNome(f.mecanico_nome);
    setMecanicoMatricula(f.mecanico_matricula || "");
    setEquipe(f.equipe || "");
    setSupervisor(f.supervisor || "");
    setModulo(f.modulo || "");
    setFrenteTrabalho(f.frente_trabalho || "");
    setPlaca(f.placa);
    setEquipamento(f.equipamento || "");
    setModelo(f.modelo || "");
    setCliente(f.cliente || "");
    setHorimetro(f.horimetro ? String(f.horimetro) : "");
    setKm(f.km ? String(f.km) : "");
    setTipoManutencao(f.tipo_manutencao);
    setDescricaoServico(f.descricao_servico);
    setAtividades(f.atividades || ATIVIDADES_PADRAO.map((desc, idx) => ({ id: `atv_${idx}`, descricao: desc, checked: false })));
    setPecas(f.pecas || []);
    setFotosAntes(f.fotos_antes || []);
    setFotosDepois(f.fotos_depois || []);
    setObservacoes(f.observacoes || "");
    setAssinaturaMecanico(f.assinatura_mecanico || "");
    setAssinaturaSupervisor(f.assinatura_supervisor || "");
    setActiveTab("form");
  };

  // Excluir Ficha
  const handleDeleteFicha = async (id: string) => {
    if (!confirm("Deseja realmente excluir esta Ficha de Mão de Obra?")) return;
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

  // Duplicar Ficha
  const handleDuplicateFicha = async (id: string) => {
    try {
      if (isOnline) {
        const res = await duplicarFichaMaoObra(id);
        if (res.success && res.data) {
          await localDb.put("fichas_mao_obra", res.data);
          setFichas(prev => [res.data, ...prev]);
          alert("Ficha duplicada com sucesso!");
        }
      } else {
        const target = fichas.find(f => f.id === id);
        if (target) {
          const dup: FichaMaoObraItem = {
            ...target,
            id: `temp_mo_${Date.now()}`,
            numero_ficha: `MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
            status: "Em andamento",
            created_at: new Date().toISOString()
          };
          await localDb.put("fichas_mao_obra", dup);
          setFichas(prev => [dup, ...prev]);
          alert("Ficha duplicada offline com sucesso!");
        }
      }
    } catch (err) {
      console.error("Erro ao duplicar ficha:", err);
    }
  };

  // Lista Filtrada do Histórico
  const fichasFiltradas = React.useMemo(() => {
    return fichas.filter(f => {
      if (filtroMecanico && !f.mecanico_nome.toLowerCase().includes(filtroMecanico.toLowerCase())) return false;
      if (filtroPlaca && !f.placa.toLowerCase().includes(filtroPlaca.toLowerCase())) return false;
      if (filtroTipo && f.tipo_manutencao !== filtroTipo) return false;
      if (filtroSupervisor && !f.supervisor?.toLowerCase().includes(filtroSupervisor.toLowerCase())) return false;
      if (filtroDataInicio && f.created_at < filtroDataInicio) return false;
      if (filtroDataFim && f.created_at > filtroDataFim + "T23:59:59") return false;
      return true;
    });
  }, [fichas, filtroMecanico, filtroPlaca, filtroTipo, filtroSupervisor, filtroDataInicio, filtroDataFim]);

  // Cálculos do Dashboard
  const metrics = React.useMemo(() => {
    const totalServicos = fichas.length;
    const totalHoras = fichas.reduce((acc, f) => acc + (f.tempo_total_horas || 0), 0);
    const preventivas = fichas.filter(f => f.tipo_manutencao === "Manutenção Preventiva").length;
    const corretivas = fichas.filter(f => f.tipo_manutencao === "Manutenção Corretiva").length;
    const tempoMedio = totalServicos > 0 ? (totalHoras / totalServicos).toFixed(1) : 0;
    const totalFotos = fichas.reduce((acc, f) => acc + (f.fotos_antes?.length || 0) + (f.fotos_depois?.length || 0), 0);
    const veiculosUnicos = new Set(fichas.map(f => f.placa)).size;

    // Agrupamento por Mecânico
    const porMecanicoMap: Record<string, number> = {};
    fichas.forEach(f => {
      porMecanicoMap[f.mecanico_nome] = (porMecanicoMap[f.mecanico_nome] || 0) + 1;
    });
    const dataPorMecanico = Object.entries(porMecanicoMap).map(([name, val]) => ({ name, servicos: val }));

    // Agrupamento por Tipo
    const porTipoMap: Record<string, number> = {};
    fichas.forEach(f => {
      porTipoMap[f.tipo_manutencao] = (porTipoMap[f.tipo_manutencao] || 0) + 1;
    });
    const dataPorTipo = Object.entries(porTipoMap).map(([name, value]) => ({ name, value }));

    // Agrupamento por Equipamento/Placa
    const porEquipMap: Record<string, number> = {};
    fichas.forEach(f => {
      porEquipMap[f.placa] = (porEquipMap[f.placa] || 0) + (f.tempo_total_horas || 0);
    });
    const dataPorEquip = Object.entries(porEquipMap).map(([name, horas]) => ({ name, horas: Number(horas.toFixed(1)) }));

    return {
      totalServicos,
      totalHoras: Number(totalHoras.toFixed(1)),
      preventivas,
      corretivas,
      tempoMedio,
      totalFotos,
      veiculosUnicos,
      dataPorMecanico,
      dataPorTipo,
      dataPorEquip
    };
  }, [fichas]);

  const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];

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
              Ficha Diária de Mão de Obra
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Apontamentos diários de atividades, peças e evidências de manutenção.
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
            <span>Nova Ficha / Formulário</span>
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

      {/* ─── ABA 1: FORMULÁRIO DE FICHA (NOVA OU EDIÇÃO) ─── */}
      {activeTab === "form" && (
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
          {/* Topo do Formulário: Ficha Número & Live Status */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {numeroFicha}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                {statusFicha}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
              <Clock size={14} />
              <span>{new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>

          {/* Seção 1: Dados do Mecânico */}
          <div className="space-y-4">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              👨‍🔧 1. Dados do Mecânico
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Mecânico <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={mecanicoNome}
                  onChange={e => setMecanicoNome(e.target.value)}
                  placeholder="Nome do mecânico responsável"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Matrícula
                </label>
                <input
                  type="text"
                  value={mecanicoMatricula}
                  onChange={e => setMecanicoMatricula(e.target.value)}
                  placeholder="Ex: MEC-1234"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Equipe / Turno
                </label>
                <input
                  type="text"
                  value={equipe}
                  onChange={e => setEquipe(e.target.value)}
                  placeholder="Ex: Equipe A (Dia)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Supervisor Responsável
                </label>
                <input
                  type="text"
                  value={supervisor}
                  onChange={e => setSupervisor(e.target.value)}
                  placeholder="Nome do supervisor"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Módulo
                </label>
                <input
                  type="text"
                  value={modulo}
                  onChange={e => setModulo(e.target.value)}
                  placeholder="Ex: Módulo Suzano Mucuri"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Frente de Trabalho
                </label>
                <input
                  type="text"
                  value={frenteTrabalho}
                  onChange={e => setFrenteTrabalho(e.target.value)}
                  placeholder="Ex: Oficina Central / Campo"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 2: Dados do Veículo */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              🚛 2. Dados do Veículo / Equipamento
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Placa <span className="text-red-500">*</span>
                </label>
                <select
                  value={placa}
                  onChange={e => handleSelectPlaca(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-extrabold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- Selecione a Placa --</option>
                  {equipamentos.map((eq, i) => (
                    <option key={i} value={eq.placa}>
                      {eq.placa} ({eq.tipo || eq.categoria || "Frota"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Equipamento / Tipo
                </label>
                <input
                  type="text"
                  value={equipamento}
                  onChange={e => setEquipamento(e.target.value)}
                  placeholder="Ex: Caminhão Volvo FH540"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Modelo
                </label>
                <input
                  type="text"
                  value={modelo}
                  onChange={e => setModelo(e.target.value)}
                  placeholder="Ex: Volvo FH 6x4"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cliente / Área
                </label>
                <input
                  type="text"
                  value={cliente}
                  onChange={e => setCliente(e.target.value)}
                  placeholder="Ex: Suzano S.A."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Horímetro Atual (h)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={horimetro}
                  onChange={e => setHorimetro(e.target.value)}
                  placeholder="Ex: 4520.5"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Quilometragem (KM - Opcional)
                </label>
                <input
                  type="number"
                  value={km}
                  onChange={e => setKm(e.target.value)}
                  placeholder="Ex: 125000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 3: Tipo de Manutenção e Serviço Executado */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              🔧 3. Tipo de Manutenção e Serviço Executado
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tipo de Manutenção <span className="text-red-500">*</span>
                </label>
                <select
                  value={tipoManutencao}
                  onChange={e => setTipoManutencao(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {TIPOS_MANUTENCAO.map((t, i) => (
                    <option key={i} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex justify-between">
                  <span>Descrição Detalhada do Serviço Executado <span className="text-red-500">*</span></span>
                  <span className="text-[10px] text-slate-400">{descricaoServico.length} / 5000 caracteres</span>
                </label>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={descricaoServico}
                  onChange={e => setDescricaoServico(e.target.value)}
                  placeholder="Ex: Substituição da bomba hidráulica devido vazamento identificado durante inspeção..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Seção 4: Atividades Executadas & Tempo Gasto */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
                ⏱️ 4. Atividades Executadas e Horários
              </h3>
              <div className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-xl font-black text-xs">
                Total Horas: {tempoTotalHorasCalculado}h
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {atividades.map((atv) => (
                <div
                  key={atv.id}
                  className={cn(
                    "p-3 rounded-xl border transition-all space-y-2",
                    atv.checked
                      ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`chk_${atv.id}`}
                      checked={atv.checked}
                      onChange={e => {
                        const val = e.target.checked;
                        setAtividades(prev => prev.map(a => a.id === atv.id ? { ...a, checked: val } : a));
                      }}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor={`chk_${atv.id}`} className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex-1">
                      {atv.descricao}
                    </label>
                  </div>

                  {atv.checked && (
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase">Início</span>
                        <input
                          type="time"
                          value={atv.hora_inicio || ""}
                          onChange={e => updateAtividadeHorario(atv.id, "hora_inicio", e.target.value)}
                          className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase">Término</span>
                        <input
                          type="time"
                          value={atv.hora_fim || ""}
                          onChange={e => updateAtividadeHorario(atv.id, "hora_fim", e.target.value)}
                          className="w-full p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <span className="block text-[9px] font-bold text-slate-500 uppercase">Tempo</span>
                        <div className="p-1.5 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/40 font-black text-xs text-emerald-700 dark:text-emerald-300 text-center">
                          {atv.tempo_gasto || "00:00"}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar Atividade Personalizada */}
            <div className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Adicionar atividade personalizada..."
                value={novaAtividadeTexto}
                onChange={e => setNovaAtividadeTexto(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              />
              <button
                type="button"
                onClick={() => {
                  if (novaAtividadeTexto.trim()) {
                    setAtividades(prev => [...prev, { id: `custom_${Date.now()}`, descricao: novaAtividadeTexto.trim(), checked: true }]);
                    setNovaAtividadeTexto("");
                  }
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow"
              >
                <Plus size={14} /> Adicionar
              </button>
            </div>
          </div>

          {/* Seção 5: Peças Utilizadas (Opcional) */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
                🔩 5. Peças Utilizadas (Opcional)
              </h3>
              <button
                type="button"
                onClick={handleAddPeca}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow"
              >
                <Plus size={14} /> Adicionar Peça
              </button>
            </div>

            {pecas.length > 0 && (
              <div className="space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/20">
                {pecas.map((peca, idx) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <div className="sm:col-span-3">
                      <input
                        type="text"
                        placeholder="Código"
                        value={peca.codigo}
                        onChange={e => {
                          const val = e.target.value;
                          setPecas(prev => prev.map((p, i) => i === idx ? { ...p, codigo: val } : p));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-mono bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-6">
                      <input
                        type="text"
                        placeholder="Descrição da peça"
                        value={peca.descricao}
                        onChange={e => {
                          const val = e.target.value;
                          setPecas(prev => prev.map((p, i) => i === idx ? { ...p, descricao: val } : p));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={peca.quantidade}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          setPecas(prev => prev.map((p, i) => i === idx ? { ...p, quantidade: val } : p));
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold bg-white dark:bg-slate-900 text-center"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemovePeca(idx)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 6: Evidências Fotográficas com Marca D'água */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              📸 6. Evidências Fotográficas (Estampagem Automática)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fotos ANTES */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase flex items-center gap-1.5">
                    <Camera size={16} /> Fotos ANTES ({fotosAntes.length}/10)
                  </span>
                  <label className="cursor-pointer px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg shadow">
                    + Foto Antes
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={e => handleUploadFoto(e, "antes")}
                    />
                  </label>
                </div>

                {fotosAntes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {fotosAntes.map((img, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Antes ${i+1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setFotosAntes(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma foto antes capturada.</p>
                )}
              </div>

              {/* Fotos DEPOIS */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                    <Camera size={16} /> Fotos DEPOIS ({fotosDepois.length}/10)
                  </span>
                  <label className="cursor-pointer px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow">
                    + Foto Depois
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      className="hidden"
                      onChange={e => handleUploadFoto(e, "depois")}
                    />
                  </label>
                </div>

                {fotosDepois.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {fotosDepois.map((img, i) => (
                      <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-300 aspect-video">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt={`Depois ${i+1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => setFotosDepois(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Nenhuma foto depois capturada.</p>
                )}
              </div>
            </div>
          </div>

          {/* Seção 7: Observações */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              💬 7. Observações Gerais
            </h3>
            <textarea
              rows={3}
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Peça indisponível no estoque, veículo aguardando teste operacional..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            />
          </div>

          {/* Seção 8: Assinaturas Digitais (Touch/Mouse Canvas) */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-extrabold uppercase text-slate-800 dark:text-slate-200 border-l-4 border-emerald-500 pl-3">
              ✍️ 8. Assinaturas Digitais (Touch / Mouse)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assinatura Mecânico */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <span className="text-xs font-bold block text-slate-700 dark:text-slate-300">
                  Assinatura do Mecânico ({mecanicoNome || "Mecânico"})
                </span>
                {assinaturaMecanico ? (
                  <div className="relative border rounded-lg bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assinaturaMecanico} alt="Assinatura Mecânico" className="h-20 object-contain mx-auto" />
                    <button
                      type="button"
                      onClick={() => setAssinaturaMecanico("")}
                      className="absolute top-1 right-1 text-xs text-red-500 font-bold px-2 py-0.5 bg-red-50 rounded border border-red-200"
                    >
                      Refazer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <canvas
                      ref={canvasMecanicoRef}
                      width={300}
                      height={100}
                      className="w-full h-24 border border-slate-300 dark:border-slate-700 rounded-lg bg-white touch-none cursor-crosshair"
                      onMouseDown={(e) => {
                        isDrawingRef.current = true;
                        const ctx = canvasMecanicoRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawingRef.current) return;
                        const ctx = canvasMecanicoRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.lineWidth = 2;
                          ctx.lineCap = "round";
                          ctx.strokeStyle = "#000000";
                          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                          ctx.stroke();
                        }
                      }}
                      onMouseUp={() => { isDrawingRef.current = false; }}
                      onTouchStart={(e) => {
                        isDrawingRef.current = true;
                        const rect = canvasMecanicoRef.current?.getBoundingClientRect();
                        const ctx = canvasMecanicoRef.current?.getContext("2d");
                        if (ctx && rect && e.touches[0]) {
                          ctx.beginPath();
                          ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (!isDrawingRef.current) return;
                        const rect = canvasMecanicoRef.current?.getBoundingClientRect();
                        const ctx = canvasMecanicoRef.current?.getContext("2d");
                        if (ctx && rect && e.touches[0]) {
                          ctx.lineWidth = 2;
                          ctx.lineCap = "round";
                          ctx.strokeStyle = "#000000";
                          ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                          ctx.stroke();
                        }
                      }}
                      onTouchEnd={() => { isDrawingRef.current = false; }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ctx = canvasMecanicoRef.current?.getContext("2d");
                          ctx?.clearRect(0, 0, 300, 100);
                        }}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded font-semibold"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (canvasMecanicoRef.current) {
                            setAssinaturaMecanico(canvasMecanicoRef.current.toDataURL());
                          }
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold shadow"
                      >
                        Salvar Assinatura
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Assinatura Supervisor */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <span className="text-xs font-bold block text-slate-700 dark:text-slate-300">
                  Assinatura do Supervisor ({supervisor || "Opcional"})
                </span>
                {assinaturaSupervisor ? (
                  <div className="relative border rounded-lg bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assinaturaSupervisor} alt="Assinatura Supervisor" className="h-20 object-contain mx-auto" />
                    <button
                      type="button"
                      onClick={() => setAssinaturaSupervisor("")}
                      className="absolute top-1 right-1 text-xs text-red-500 font-bold px-2 py-0.5 bg-red-50 rounded border border-red-200"
                    >
                      Refazer
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <canvas
                      ref={canvasSupervisorRef}
                      width={300}
                      height={100}
                      className="w-full h-24 border border-slate-300 dark:border-slate-700 rounded-lg bg-white touch-none cursor-crosshair"
                      onMouseDown={(e) => {
                        isDrawingRef.current = true;
                        const ctx = canvasSupervisorRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.beginPath();
                          ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDrawingRef.current) return;
                        const ctx = canvasSupervisorRef.current?.getContext("2d");
                        if (ctx) {
                          ctx.lineWidth = 2;
                          ctx.lineCap = "round";
                          ctx.strokeStyle = "#000000";
                          ctx.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
                          ctx.stroke();
                        }
                      }}
                      onMouseUp={() => { isDrawingRef.current = false; }}
                      onTouchStart={(e) => {
                        isDrawingRef.current = true;
                        const rect = canvasSupervisorRef.current?.getBoundingClientRect();
                        const ctx = canvasSupervisorRef.current?.getContext("2d");
                        if (ctx && rect && e.touches[0]) {
                          ctx.beginPath();
                          ctx.moveTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                        }
                      }}
                      onTouchMove={(e) => {
                        if (!isDrawingRef.current) return;
                        const rect = canvasSupervisorRef.current?.getBoundingClientRect();
                        const ctx = canvasSupervisorRef.current?.getContext("2d");
                        if (ctx && rect && e.touches[0]) {
                          ctx.lineWidth = 2;
                          ctx.lineCap = "round";
                          ctx.strokeStyle = "#000000";
                          ctx.lineTo(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                          ctx.stroke();
                        }
                      }}
                      onTouchEnd={() => { isDrawingRef.current = false; }}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const ctx = canvasSupervisorRef.current?.getContext("2d");
                          ctx?.clearRect(0, 0, 300, 100);
                        }}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded font-semibold"
                      >
                        Limpar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (canvasSupervisorRef.current) {
                            setAssinaturaSupervisor(canvasSupervisorRef.current.toDataURL());
                          }
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold shadow"
                      >
                        Salvar Assinatura
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Botões de Ação Principais */}
          <div className="flex items-center justify-between gap-3 pt-6 border-t border-slate-200 dark:border-slate-800 flex-wrap">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs rounded-xl hover:bg-slate-300 transition"
            >
              Nova Ficha
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
                <CheckCircle2 size={16} /> Finalizar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── ABA 2: HISTÓRICO DE SERVIÇOS ─── */}
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
                placeholder="Mecânico..."
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
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                <option value="">-- Todos os Tipos --</option>
                {TIPOS_MANUTENCAO.map((t, i) => (
                  <option key={i} value={t}>{t}</option>
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
                      <th className="p-3">Mecânico</th>
                      <th className="p-3">Placa</th>
                      <th className="p-3">Tipo Manutenção</th>
                      <th className="p-3 text-center">Tempo</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {fichasFiltradas.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="p-3 font-semibold">
                          {new Date(f.created_at).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                          {f.numero_ficha}
                        </td>
                        <td className="p-3 font-bold">{f.mecanico_nome}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 dark:text-slate-200">{f.placa}</td>
                        <td className="p-3 font-semibold">{f.tipo_manutencao}</td>
                        <td className="p-3 text-center font-black">{f.tempo_total_horas || 0}h</td>
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
                              title="Visualizar / Gerar PDF"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white rounded-lg transition"
                            >
                              <Printer size={15} />
                            </button>
                            <button
                              onClick={() => handleEditFicha(f)}
                              title="Editar Ficha"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white rounded-lg transition"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDuplicateFicha(f.id)}
                              title="Duplicar Ficha"
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white rounded-lg transition"
                            >
                              <Copy size={15} />
                            </button>
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
                <p className="font-semibold text-xs">Nenhuma ficha de mão de obra encontrada.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ABA 3: DASHBOARD DE PRODUTIVIDADE ─── */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Fichas</span>
              <div className="text-xl font-black text-slate-900 dark:text-white">{metrics.totalServicos}</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Horas Totais</span>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{metrics.totalHoras}h</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Preventivas</span>
              <div className="text-xl font-black text-blue-600 dark:text-blue-400">{metrics.preventivas}</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Corretivas</span>
              <div className="text-xl font-black text-amber-600 dark:text-amber-400">{metrics.corretivas}</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tempo Médio</span>
              <div className="text-xl font-black text-purple-600 dark:text-purple-400">{metrics.tempoMedio}h</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Evidências Fotos</span>
              <div className="text-xl font-black text-pink-600 dark:text-pink-400">{metrics.totalFotos}</div>
            </div>

            <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Veículos Atendidos</span>
              <div className="text-xl font-black text-teal-600 dark:text-teal-400">{metrics.veiculosUnicos}</div>
            </div>
          </div>

          {/* Gráficos Recharts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 1: Serviços por Mecânico */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200">
                📊 Serviços Realizados por Mecânico
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.dataPorMecanico}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" stroke="#888888" fontSize={10} />
                    <YAxis stroke="#888888" fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="servicos" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Gráfico 2: Tipos de Manutenção */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200">
                🥧 Distribuição por Tipo de Manutenção
              </h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.dataPorTipo}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {metrics.dataPorTipo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EXIBIÇÃO / GERAÇÃO DE PDF */}
      {selectedFichaForPDF && (
        <FichaPDFModal
          ficha={selectedFichaForPDF}
          onClose={() => setSelectedFichaForPDF(null)}
        />
      )}
    </div>
  );
}
