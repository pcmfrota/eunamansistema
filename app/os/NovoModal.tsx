"use client";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { X, CheckCircle2, AlertTriangle, ListChecks, Check, FlipHorizontal } from "lucide-react";
import { SearchableSelect } from '@/components/SearchableSelect';

// ─── Componente de Câmera In-Page ────────────────────────────────────────────
// Usa getUserMedia para tirar foto sem sair da página (evita reload no mobile)
function CameraModal({ onCapture, onClose }: { onCapture: (dataUrl: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);

  const startCamera = useCallback(async (mode: "environment" | "user") => {
    setReady(false);
    setError(null);
    // Para stream anterior
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setReady(true);
        };
      }
    } catch (err: any) {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [facingMode, startCamera]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const MAX = 800;
    let w = video.videoWidth;
    let h = video.videoHeight;
    if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
    else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    setCaptured(dataUrl);
    // Para o stream enquanto mostra preview
    streamRef.current?.getTracks().forEach(t => t.stop());
  };

  const handleConfirm = () => {
    if (captured) onCapture(captured);
    onClose();
  };

  const handleRetake = () => {
    setCaptured(null);
    startCamera(facingMode);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
    setCaptured(null);
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm">
      <div className="relative w-full max-w-md flex flex-col gap-3 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-white font-semibold text-sm">📷 Tirar Foto</span>
          <button type="button" onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); onClose(); }}
            className="text-white/70 hover:text-white transition-colors p-1">
            <X size={22} />
          </button>
        </div>

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button type="button" onClick={() => startCamera(facingMode)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Tentar novamente</button>
          </div>
        ) : captured ? (
          // Preview da foto capturada
          <>
            <div className="rounded-xl overflow-hidden bg-black aspect-[4/3] w-full">
              <img src={captured} alt="Preview" className="w-full h-full object-contain" />
            </div>
            <div className="flex gap-3 justify-center">
              <button type="button" onClick={handleRetake}
                className="flex-1 py-3 rounded-xl bg-zinc-700 text-white font-semibold text-sm hover:bg-zinc-600 transition-colors">
                🔄 Nova Foto
              </button>
              <button type="button" onClick={handleConfirm}
                className="flex-1 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 transition-colors">
                ✅ Usar Esta
              </button>
            </div>
          </>
        ) : (
          // Viewfinder da câmera
          <>
            <div className="rounded-xl overflow-hidden bg-black aspect-[4/3] w-full relative">
              <video ref={videoRef} autoPlay playsInline muted
                className="w-full h-full object-cover" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <div className="flex gap-3 items-center justify-center">
              <button type="button" onClick={toggleCamera}
                className="p-3 rounded-full bg-zinc-700/80 text-white hover:bg-zinc-600 transition-colors" title="Virar câmera">
                <FlipHorizontal size={20} />
              </button>
              <button type="button" onClick={handleCapture} disabled={!ready}
                className="w-16 h-16 rounded-full bg-white border-4 border-zinc-300 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-50">
                <div className="w-11 h-11 rounded-full bg-zinc-900" />
              </button>
              <div className="w-12" />{/* Spacer */}
            </div>
          </>
        )}

        {/* Canvas oculto para captura */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
import { criarOrdemServico, atualizarOrdemServico } from "./actions";
import { encerrarBacklogs } from "@/app/backlog/actions";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";

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
  horario_parada: string | null;
  qual_reserva: string | null;
  horas_reserva_chegou: string | null;
  observacoes: string | null;
  equipamento_id: string;
  assinatura_mecanico?: string | null;
  fotos?: string[] | null;
};

type Equipamento = { id: string; placa: string; modulo?: string; tipo?: string; ultimoHist?: number; categoria?: string; status?: string; };

type CatalogoItem = {
  id: number;
  sistema: string;
  sistema_codigo: number;
  subsistema: string;
  subsistema_codigo: number;
  componente: string;
  componente_codigo: number;
};

interface OSFormModalProps {
  equipamentos: Equipamento[];
  initialData?: OS | null;
  onClose: () => void;
  operacoesTipo?: string[];
  motivos?: string[];
  catalogo?: CatalogoItem[];
  backlogs?: any[];
  colaboradores?: any[];
  fotos: string[];
  setFotos: React.Dispatch<React.SetStateAction<string[]>>;
}

function getLocalDT() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth()+1)}-${p(now.getDate())}T${p(now.getHours())}:${p(now.getMinutes())}`;
}

export default function OSFormModal({
  equipamentos, initialData, onClose,
  operacoesTipo = [], motivos = [], catalogo = [],
  backlogs = [],
  colaboradores = [],
  fotos,
  setFotos,
}: OSFormModalProps) {
  const { isOnline } = useOffline();
  const [loading, setLoading] = useState(false);
  const isSubmitting = useRef(false); // Guard contra duplo clique
  const [equip, setEquip] = useState<Equipamento | null>(null);
  const [operacaoTipo, setOperacaoTipo] = useState(initialData?.operacao_tipo || "");
  const [foiReserva, setFoiReserva] = useState(initialData?.foi_enviado_reserva || false);
  const [sistema, setSistema] = useState(initialData?.sistema || "");
  const [subSistema, setSubSistema] = useState(initialData?.sub_sistema || "");
  const [componente, setComponente] = useState(initialData?.componente || "");
  const [dataAbertura, setDataAbertura] = useState(initialData?.data_abertura?.slice(0,16) || getLocalDT());
  const [dataFechamento, setDataFechamento] = useState(initialData?.data_fechamento?.slice(0,16) || "");
  const [mecanicos, setMecanicos] = useState<string[]>(
    (initialData as any)?.mecanicos?.length ? (initialData as any).mecanicos : [""]
  );
  type SigPadTarget = number | 'encarregado' | 'pcm' | 'operador' | 'supervisor_suzano' | false;
  // showSigPad: índice numérico = mecânico, string = cargo fixo, false = fechado
  const [showSigPad, setShowSigPad] = useState<SigPadTarget>(false);

  // Assinaturas dos mecânicos (array indexado)
  // Assinaturas dos cargos fixos (objeto)
  const CARGOS_LABELS: Record<string, string> = {
    encarregado: "Encarregado / Supervisor",
    pcm: "PCM / Planejamento",
    operador: "Operador / Motorista",
    supervisor_suzano: "Supervisor / Autorizador / Suzano",
  };
  const parseInitialSigsAndCargos = () => {
    const raw = initialData?.assinatura_mecanico || "";
    if (!raw) return { mecanicos: [] as string[], cargos: {} as Record<string, string> };
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { mecanicos: parsed, cargos: {} };
      if (parsed && typeof parsed === 'object' && 'mecanicos' in parsed) {
        return { mecanicos: parsed.mecanicos || [], cargos: parsed.cargos || {} };
      }
    } catch {}
    return { mecanicos: [raw], cargos: {} }; // compat. string simples
  };
  const initParsed = parseInitialSigsAndCargos();
  const [assinaturas, setAssinaturas] = useState<string[]>(initParsed.mecanicos);
  const [sigCargos, setSigCargos] = useState<Record<string, string>>(initParsed.cargos);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [resolvedBacklogs, setResolvedBacklogs] = useState<Set<string>>(new Set());
  const [showCameraModal, setShowCameraModal] = useState(false);

  const formRef = useRef<HTMLFormElement | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const draftKey = initialData ? `os_draft_edit_${initialData.id}` : "os_draft_new";

  const clearDraft = async () => {
    try {
      await localDb.delete("aux_config", draftKey);
      localStorage.removeItem("eunaman_active_os_draft_key");
    } catch (err) {
      console.warn("Erro ao limpar rascunho:", err);
    }
  };

  const handleCancel = async () => {
    await clearDraft();
    onClose();
  };

  const saveDraft = () => {
    if (typeof window === "undefined" || !formRef.current) return;
    const fd = new FormData(formRef.current);
    const draftData = {
      horario_parada: fd.get("horario_parada") as string,
      status: fd.get("status") as string,
      horimetro: fd.get("horimetro") as string,
      local: fd.get("local") as string,
      classe: fd.get("classe") as string,
      qual_reserva: fd.get("qual_reserva") as string,
      horas_reserva_chegou: fd.get("horas_reserva_chegou") as string,
      descricao: fd.get("descricao") as string,
      motivo: fd.get("motivo") as string,
      observacoes: fd.get("observacoes") as string,
      
      equipamento_id: equip?.id || "",
      operacaoTipo,
      foiReserva,
      sistema,
      subSistema,
      componente,
      dataAbertura,
      dataFechamento,
      mecanicos,
      assinaturas,
      sigCargos,
      resolvedBacklogs: Array.from(resolvedBacklogs),
      fotos,
    };
    localDb.put("aux_config", { id: draftKey, draftData }).catch(err => {
      console.warn("Falha ao salvar rascunho no IndexedDB:", err);
    });
  };

  const saveDraftDebounced = () => {
    if (!isInitialized) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      saveDraft();
    }, 500);
  };

  useEffect(() => {
    const initializeForm = async () => {
      if (typeof window === "undefined") return;

      try {
        localStorage.setItem("eunaman_active_os_draft_key", draftKey);
      } catch (err) {
        console.warn("Erro ao definir active draft key no localStorage:", err);
      }

      try {
        const draft = await localDb.get<{ id: string; draftData: any }>("aux_config", draftKey);
        if (draft && draft.draftData) {
          const d = draft.draftData;
          if (d.equipamento_id) {
            const eq = equipamentos.find(e => e.id === d.equipamento_id) || null;
            setEquip(eq);
          }
          if (d.operacaoTipo !== undefined) setOperacaoTipo(d.operacaoTipo);
          if (d.foiReserva !== undefined) setFoiReserva(d.foiReserva);
          if (d.sistema !== undefined) setSistema(d.sistema);
          if (d.subSistema !== undefined) setSubSistema(d.subSistema);
          if (d.componente !== undefined) setComponente(d.componente);
          if (d.dataAbertura !== undefined) setDataAbertura(d.dataAbertura);
          if (d.dataFechamento !== undefined) setDataFechamento(d.dataFechamento);
          if (d.mecanicos !== undefined) setMecanicos(d.mecanicos);
          if (d.assinaturas !== undefined) setAssinaturas(d.assinaturas);
          else if (d.assinaturaDataUrl !== undefined) setAssinaturas(d.assinaturaDataUrl ? [d.assinaturaDataUrl] : []);
          if (d.sigCargos !== undefined) setSigCargos(d.sigCargos);
          if (d.resolvedBacklogs !== undefined) setResolvedBacklogs(new Set(d.resolvedBacklogs));
          if (d.fotos !== undefined) {
            setFotos((prev) => {
              const uniquePhotos = [...d.fotos];
              prev.forEach((photo) => {
                if (!uniquePhotos.includes(photo)) {
                  uniquePhotos.push(photo);
                }
              });
              return uniquePhotos;
            });
          }

          setTimeout(() => {
            if (formRef.current) {
              const form = formRef.current;
              if (d.horario_parada !== undefined) {
                const el = form.querySelector('[name="horario_parada"]') as HTMLInputElement;
                if (el) el.value = d.horario_parada;
              }
              if (d.status !== undefined) {
                const el = form.querySelector('[name="status"]') as HTMLSelectElement;
                if (el) el.value = d.status;
              }
              if (d.horimetro !== undefined) {
                const el = form.querySelector('[name="horimetro"]') as HTMLInputElement;
                if (el) el.value = d.horimetro;
              }
              if (d.local !== undefined) {
                const el = form.querySelector('[name="local"]') as HTMLInputElement;
                if (el) el.value = d.local;
              }
              if (d.classe !== undefined) {
                const el = form.querySelector('[name="classe"]') as HTMLSelectElement;
                if (el) el.value = d.classe;
              }
              if (d.qual_reserva !== undefined) {
                const el = form.querySelector('[name="qual_reserva"]') as HTMLSelectElement;
                if (el) el.value = d.qual_reserva;
              }
              if (d.horas_reserva_chegou !== undefined) {
                const el = form.querySelector('[name="horas_reserva_chegou"]') as HTMLInputElement;
                if (el) el.value = d.horas_reserva_chegou;
              }
              if (d.descricao !== undefined) {
                const el = form.querySelector('[name="descricao"]') as HTMLTextAreaElement;
                if (el) el.value = d.descricao;
              }
              if (d.motivo !== undefined) {
                const el = form.querySelector('[name="motivo"]') as HTMLSelectElement;
                if (el) el.value = d.motivo;
              }
              if (d.observacoes !== undefined) {
                const el = form.querySelector('[name="observacoes"]') as HTMLTextAreaElement;
                if (el) el.value = d.observacoes;
              }
            }
            setIsInitialized(true);
          }, 50);
          return;
        }
      } catch (err) {
        console.error("Erro ao carregar rascunho:", err);
      }

      if (initialData?.equipamento_id) {
        const eq = equipamentos.find(e => e.id === initialData.equipamento_id) || null;
        setEquip(eq);
        if (!initialData.operacao_tipo && eq) {
          setOperacaoTipo(eq.tipo || "");
        }
      }
      setIsInitialized(true);
    };

    initializeForm();

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Auto-salvamento com debounce para inputs de texto e seleções rápidas
  useEffect(() => {
    if (isInitialized) {
      saveDraftDebounced();
    }
  }, [
    isInitialized,
    equip,
    operacaoTipo,
    foiReserva,
    sistema,
    subSistema,
    componente,
    dataAbertura,
    dataFechamento,
    mecanicos,
    sigCargos,
    resolvedBacklogs
  ]);

  // Auto-salvamento imediato para fotos e assinaturas (operações de arquivos)
  useEffect(() => {
    if (isInitialized) {
      saveDraft();
    }
  }, [isInitialized, fotos, assinaturas, sigCargos]);

  // Filter open backlogs for the selected vehicle (equip?.placa)
  const openBacklogs = useMemo(() => {
    if (!equip?.placa) return [];
    return (backlogs || []).filter(item => {
      const isSamePlate = item.frota && item.frota.toUpperCase() === equip.placa.toUpperCase();
      const st = String(item.status || '').toUpperCase().trim();
      const isNotClosed = st !== 'ENCERRADO' && st !== 'CONCLUIDO' && st !== 'CONCLUÍDO' && st !== 'ENCERRADA';
      return isSamePlate && isNotClosed;
    });
  }, [backlogs, equip?.placa]);

  // Filter heavy fleet & active equipments (categoria == 'PESADA' and status != 'INATIVO')
  // We always include the currently selected equipment if editing to prevent UI issues
  const filteredEquipamentos = useMemo(() => {
    return equipamentos.filter(eq => {
      if (initialData && eq.id === initialData.equipamento_id) return true;
      const isHeavy = eq.categoria && eq.categoria.toUpperCase() === "PESADA";
      const isActive = eq.status && eq.status.toUpperCase() !== "INATIVO";
      return isHeavy && isActive;
    });
  }, [equipamentos, initialData]);

  // Catalogos em cascata
  const sistemasUnicos = Array.from(new Set(catalogo.map(c => c.sistema))).sort();
  const subsistemasFiltrados = sistema
    ? Array.from(new Set(catalogo.filter(c => c.sistema === sistema).map(c => c.subsistema))).sort()
    : [];
  const componentesFiltrados = sistema && subSistema
    ? Array.from(new Set(catalogo.filter(c => c.sistema === sistema && c.subsistema === subSistema).map(c => c.componente))).sort()
    : [];

  // Calcular tempo total de manutenção
  const diffMin = (() => {
    if (!dataAbertura || !dataFechamento) return 0;
    const d = Math.floor((new Date(dataFechamento).getTime() - new Date(dataAbertura).getTime()) / 60000);
    return d > 0 ? d : 0;
  })();
  const tempoFmt = `${String(Math.floor(diffMin/60)).padStart(2,"0")}:${String(diffMin%60).padStart(2,"0")}`;

  const handleEquipChange = (id: string) => {
    const eq = equipamentos.find(e => e.id === id) || null;
    setEquip(eq);
    if (eq) {
      setOperacaoTipo(eq.tipo || "");
    }
  };

  // ─── Assinatura Digital Canvas Draw Logic ──────────────────────────────────
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // Caneta azul escura
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      if (e.cancelable) e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (showSigPad === false) return;
    
    // Validar se o canvas não está em branco
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert("Por favor, faça a assinatura antes de salvar.");
      return;
    }

    if (typeof showSigPad === 'number') {
      // Mecânico
      const idx = showSigPad;
      setAssinaturas(prev => { const next = [...prev]; next[idx] = canvas.toDataURL(); return next; });
    } else {
      // Cargo fixo
      const key = showSigPad;
      setSigCargos(prev => ({ ...prev, [key]: canvas.toDataURL() }));
    }
    setShowSigPad(false);
  };


  const removeFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Guard contra duplo clique / duplo submit
    if (isSubmitting.current) return;
    isSubmitting.current = true;
    setLoading(true);

    try {
      const fd = new FormData(e.currentTarget);
      fd.set("placa", equip?.placa || "");
      // CRÍTICO: módulo é readOnly — precisa ser setado manualmente no FormData
      fd.set("modulo", equip?.modulo || "");
      fd.set("horas_manutencao", String(Number((diffMin/60).toFixed(2))));
      fd.set("sistema", sistema);
      fd.set("sub_sistema", subSistema);
      fd.set("componente", componente);
      // Serializa assinaturas (mecânicos + cargos) num JSON estruturado
      fd.set("assinatura_mecanico", JSON.stringify({ mecanicos: assinaturas, cargos: sigCargos }));

      // Mecânicos: envia cada nome individualmente
      mecanicos.forEach((nome, idx) => {
        fd.set(`mecanico_${idx + 1}`, nome.trim());
      });

      // Fotos do serviço: envia as fotos
      fotos.forEach((foto) => {
        fd.append("fotos", foto);
      });

      const handleSaveOffline = async () => {
        const dataFechamentoVal = (fd.get("data_fechamento") as string) || null;
        if (initialData) {
          // Editar OS Offline
          const serialized = serializeFormData(fd);
          const osNum = initialData.numero_os;
          
          // Se houver backlogs selecionados para encerramento
          if (resolvedBacklogs.size > 0) {
            const dataConclusao = dataFechamentoVal || getLocalDT();
            for (const backlogId of resolvedBacklogs) {
              const backlog = backlogs.find(b => b.id === backlogId);
              if (backlog) {
                const updatedBk = {
                  ...backlog,
                  status: "ENCERRADO",
                  os: osNum,
                  data_conclusao: dataConclusao,
                  _isPendingSync: true
                };
                await localDb.put("backlog", updatedBk);
                await localDb.addToQueue("backlog", "update", updatedBk);
              }
            }
            window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
          }

          const updatedOS = {
            ...initialData,
            ...serialized,
            horimetro: fd.get("horimetro") ? parseFloat(fd.get("horimetro") as string) : null,
            horas_manutencao: Number((diffMin/60).toFixed(2)),
            foi_enviado_reserva: fd.get("foi_enviado_reserva") === "on",
            fotos: fotos,
            _isPendingSync: true
          };
          await localDb.put("ordens_servico", updatedOS);
          await localDb.addToQueue("os", "update", { id: initialData.id, ...serialized });
        } else {
          // Criar OS Offline
          const tempId = `temp_os_${Date.now()}`;
          const tempNum = `OS-OFF-${Math.floor(Math.random() * 9000) + 1000}`;
          
          // Adicionar o número temporário no FormData para ser salvo e enfileirado no sync
          fd.set("temp_numero_os", tempNum);
          const serialized = serializeFormData(fd);

          // Se houver backlogs selecionados para encerramento
          if (resolvedBacklogs.size > 0) {
            const dataConclusao = dataFechamentoVal || getLocalDT();
            for (const backlogId of resolvedBacklogs) {
              const backlog = backlogs.find(b => b.id === backlogId);
              if (backlog) {
                const updatedBk = {
                  ...backlog,
                  status: "ENCERRADO",
                  os: tempNum,
                  data_conclusao: dataConclusao,
                  _isPendingSync: true
                };
                await localDb.put("backlog", updatedBk);
                await localDb.addToQueue("backlog", "update", updatedBk);
              }
            }
            window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
          }

          const newOS = {
            id: tempId,
            numero_os: tempNum,
            placa: equip?.placa || "",
            modulo: equip?.modulo || "",
            status: fd.get("status") as string || "Aberta",
            data_abertura: fd.get("data_abertura") as string,
            data_fechamento: dataFechamentoVal,
            horas_manutencao: Number((diffMin/60).toFixed(2)),
            descricao: fd.get("descricao") as string,
            horimetro: fd.get("horimetro") ? parseFloat(fd.get("horimetro") as string) : null,
            operacao_tipo: fd.get("operacao_tipo") as string,
            local: fd.get("local") as string,
            classe: fd.get("classe") as string || "CORRETIVA",
            foi_enviado_reserva: fd.get("foi_enviado_reserva") === "on",
            motivo: fd.get("motivo") as string,
            sistema: sistema,
            sub_sistema: subSistema,
            componente: componente,
            mecanicos: mecanicos.filter(m => m.trim() !== ""),
            horario_parada: (fd.get("horario_parada") as string) || null,
            qual_reserva: (fd.get("qual_reserva") as string) || null,
            horas_reserva_chegou: (fd.get("horas_reserva_chegou") as string) || null,
            observacoes: fd.get("observacoes") as string,
            equipamento_id: fd.get("equipamento_id") as string,
            assinatura_mecanico: JSON.stringify({ mecanicos: assinaturas, cargos: sigCargos }),
            fotos: fotos,
            _isPendingSync: true
          };
          await localDb.put("ordens_servico", newOS);
          await localDb.addToQueue("os", "create", serialized);
        }

        // Notifica as tabelas e fecha o modal
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
        await clearDraft();
        onClose();
        alert("Ordem de serviço salva com sucesso (Offline)!");
      };

      if (isOnline) {
        try {
          const res = initialData
            ? await atualizarOrdemServico(initialData.id, fd)
            : await criarOrdemServico(fd);

          if (res && typeof res === "object" && "error" in res) {
            console.warn("[OS] Falha ao salvar online, tentando offline...", res.error);
            await handleSaveOffline();
            return;
          }

          // Se houver backlogs selecionados para encerramento
          if (resolvedBacklogs.size > 0 && res && typeof res === "object" && "numero_os" in res) {
            const osNum = (res as any).numero_os;
            const dataConclusao = (fd.get("data_fechamento") as string) || getLocalDT();

            // Chamar action de fechamento dos backlogs no Supabase
            const encRes = await encerrarBacklogs(Array.from(resolvedBacklogs), osNum, dataConclusao);
            if (encRes && "error" in encRes) {
              console.error("Erro ao encerrar backlogs no servidor:", encRes.error);
            }

            // Atualizar localmente no IndexedDB
            for (const backlogId of resolvedBacklogs) {
              const backlog = backlogs.find(b => b.id === backlogId);
              if (backlog) {
                await localDb.put("backlog", {
                  ...backlog,
                  status: "ENCERRADO",
                  os: osNum,
                  data_conclusao: dataConclusao
                });
              }
            }
            window.dispatchEvent(new CustomEvent("offline-db-updated-backlog"));
          }

          // Salvo com sucesso no Supabase — atualiza cache local sem bloquear
          try {
            if (res && typeof res === "object" && "id" in res) {
              await localDb.put("ordens_servico", res);
            }
          } catch (cacheErr) {
            // Erro no cache local é não-crítico: o dado já foi salvo no servidor
            console.warn("[Cache] Falha ao atualizar IndexedDB (não-crítico):", cacheErr);
          }

          window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
          await clearDraft();
          onClose();
          alert("Ordem de serviço salva com sucesso!");
        } catch (err: any) {
          console.error("[OS] Erro critico no salvamento online, caindo para offline:", err);
          await handleSaveOffline();
        }
      } else {
        await handleSaveOffline();
      }
    } catch (error: any) {
      console.error("Erro inesperado no handleSubmit:", error);
      alert("Erro inesperado ao salvar a OS. Tente novamente.");
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {initialData ? "Editar OS" : "Nova OS"}
          </h2>
          <button type="button" onClick={handleCancel} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} onChange={saveDraftDebounced} onInput={saveDraftDebounced} className="flex flex-col gap-4">

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
            <Field label="Horário Real da Parada *">
              <input name="horario_parada" type="datetime-local" required
                defaultValue={initialData?.horario_parada?.slice(0,16) || ""}
                className={`${I} border-red-200 dark:border-red-800`} />
            </Field>
            <Field label="Início Manutenção *">
              <input name="data_abertura" type="datetime-local" required
                value={dataAbertura} onChange={e => setDataAbertura(e.target.value)}
                className={I} />
            </Field>
            <Field label="Fechamento da OS">
              <input name="data_fechamento" type="datetime-local"
                value={dataFechamento} onChange={e => setDataFechamento(e.target.value)}
                className={I} />
            </Field>
          </div>

          {/* Status + Placa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Status *">
              <select name="status" required defaultValue={initialData?.status || "Aberta"} className={I}>
                <option>Aberta</option>
                <option>Em Andamento</option>
                <option>Fechada</option>
              </select>
            </Field>
            <Field label="Placa *">
              <SearchableSelect 
                name="equipamento_id"
                options={filteredEquipamentos.map(eq => ({ value: eq.id, label: eq.placa }))}
                value={equip?.id || ""} 
                onChange={val => handleEquipChange(val)}
              />
            </Field>
          </div>

          {/* Módulo só leitura - puxado automaticamente da placa */}
          <Field label="Módulo (automático pela placa)">
            <input type="text" name="modulo" readOnly value={equip?.modulo || ""}
              placeholder="Selecione a placa para puxar o módulo..."
              className={`${I} bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed text-emerald-700 dark:text-emerald-400 font-semibold`} />
          </Field>

          {/* Horímetro, Operação, Local */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Horímetro">
              <input name="horimetro" type="number" step="0.1"
                defaultValue={initialData?.horimetro ?? equip?.ultimoHist ?? ""}
                className={I} />
            </Field>
            <Field label="Operação (Tipo)">
              <input name="operacao_tipo" type="text" list="lista-op"
                value={operacaoTipo} onChange={e => setOperacaoTipo(e.target.value)}
                className={I} />
              <datalist id="lista-op">
                {operacoesTipo.map(o => <option key={o} value={o} />)}
              </datalist>
            </Field>
            <Field label="Local">
              <input name="local" type="text"
                defaultValue={initialData?.local || ""}
                className={I} />
            </Field>
          </div>

          {/* Tipo de Manutenção + Reserva */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <Field label="Tipo de Manutenção">
              <select name="classe" defaultValue={initialData?.classe || "CORRETIVA"} className={I}>
                <option value="CORRETIVA">CORRETIVA</option>
                <option value="PREVENTIVA">PREVENTIVA</option>
                <option value="PREDITIVA">PREDITIVA</option>
                <option value="REFORMA">REFORMA</option>
              </select>
            </Field>
            <div className="pt-4 flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" name="foi_enviado_reserva"
                  checked={foiReserva}
                  onChange={e => setFoiReserva(e.target.checked)}
                  className="sr-only peer" />
                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-700 rounded-full peer peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
                <span className="ml-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Foi enviado reserva?
                  <br /><span className="text-[10px] text-zinc-400 font-normal">Impacta o medidor de parada operacional</span>
                </span>
              </label>
            </div>
          </div>

          {/* Reserva details */}
          {foiReserva && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
              <Field label="Qual o Caminhão Reserva?">
                <select name="qual_reserva" required
                  defaultValue={initialData?.qual_reserva || ""}
                  className={`${I} border-orange-200`}>
                  <option value="">Selecione...</option>
                  {equipamentos.map(eq => (
                    <option key={`r-${eq.id}`} value={eq.placa}>{eq.placa}</option>
                  ))}
                </select>
              </Field>
              <Field label="Que Horas o Reserva Chegou?">
                <input name="horas_reserva_chegou" type="datetime-local" required
                  defaultValue={initialData?.horas_reserva_chegou?.slice(0,16) || ""}
                  className={`${I} border-orange-200`} />
              </Field>
            </div>
          )}

          {/* Vínculo de Backlogs da Placa */}
          {equip?.placa && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="text-blue-500 dark:text-blue-400" size={18} />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                    Backlogs Pendentes ({openBacklogs.length})
                  </span>
                </div>
                {openBacklogs.length === 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full">
                    <CheckCircle2 size={12} /> Sem pendências
                  </span>
                )}
              </div>

              {openBacklogs.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Selecione os backlogs que foram resolvidos nesta manutenção para encerrá-los automaticamente:
                  </p>
                  {openBacklogs.map((item) => {
                    const isSelected = resolvedBacklogs.has(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setResolvedBacklogs(prev => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10"
                            : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/40"
                        }`}
                      >
                        <div className={`mt-0.5 w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-zinc-300 dark:border-zinc-700 text-transparent"
                        }`}>
                          <Check size={12} className="stroke-[3]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-bold leading-relaxed ${isSelected ? "text-emerald-900 dark:text-emerald-400" : "text-zinc-800 dark:text-zinc-200"}`}>
                            {item.descricao || "Sem descrição"}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            {item.criticidade === 'A' ? (
                              <span className="relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30">
                                <span className="flex h-1.5 w-1.5 relative">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                </span>
                                Crítico A
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-900/20">
                                Normal B
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-400 font-medium font-mono">
                              Evidência: {item.data_evidencia ? new Date(item.data_evidencia).toLocaleDateString('pt-BR') : '-'}
                            </span>
                            {item.colaborador && (
                              <span className="text-[10px] text-zinc-400 font-semibold uppercase">
                                • {item.colaborador}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 bg-white dark:bg-zinc-900/20 border border-zinc-150 dark:border-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    Nenhum backlog pendente ou programado encontrado para esta placa.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Descrição */}
          <Field label="Descrição da Atividade *">
            <textarea name="descricao" required rows={3}
              defaultValue={initialData?.descricao || ""}
              placeholder="Descreva a falha ou manutenção..."
              className={`${I} resize-none`} />
          </Field>

          {/* Motivo */}
          <Field label="Motivo">
            <select name="motivo" defaultValue={initialData?.motivo || ""} className={I}>
              <option value="">Selecione</option>
              {motivos.map(m => <option key={m} value={m}>{m}</option>)}
              {motivos.length === 0 && (
                <>
                  <option>Desgaste Natural</option>
                  <option>Quebra Operacional</option>
                  <option>Falha Elétrica</option>
                </>
              )}
            </select>
          </Field>

          {/* Mecânicos */}
          <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                🔧 Mecânicos Executores
              </p>
              {mecanicos.length < 5 && (
                <button
                  type="button"
                  onClick={() => setMecanicos(prev => [...prev, ""])}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-medium flex items-center gap-1 transition-colors"
                >
                  <span className="text-base leading-none">+</span> Adicionar mecânico
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {mecanicos.map((nome, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 w-4 shrink-0">{idx + 1}.</span>
                  <div className="flex-1">
                    <SearchableSelect
                      options={colaboradores.map(colab => ({ value: colab.nome, label: colab.nome }))}
                      value={nome}
                      onChange={val => {
                        const copia = [...mecanicos];
                        copia[idx] = val;
                        setMecanicos(copia);
                      }}
                      placeholder={`Selecione o mecânico ${idx + 1}...`}
                    />
                  </div>
                  {mecanicos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMecanicos(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 transition-colors text-lg leading-none px-1"
                      title="Remover"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Assinaturas individuais por mecânico */}
            {mecanicos.some(m => m.trim() !== "") && (
              <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800/40 flex flex-col gap-3">
                <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                  ✍️ Assinaturas Digitais
                </p>
                {mecanicos.map((nome, idx) => {
                  if (!nome.trim()) return null;
                  const sig = assinaturas[idx] || "";
                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/50 border border-emerald-100 dark:border-emerald-900/30 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 truncate">
                          🔧 {nome}
                        </p>
                        {sig ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                              <img src={sig} alt={`Assinatura ${nome}`} className="h-9 object-contain max-w-[140px]" />
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setAssinaturas(prev => { const next = [...prev]; next[idx] = ""; return next; });
                              }}
                              className="text-red-400 hover:text-red-600 text-lg leading-none px-1 transition-colors"
                              title="Remover assinatura"
                            >×</button>
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-400 mt-0.5">Sem assinatura</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // Limpa o canvas antes de abrir
                          setTimeout(() => {
                            const canvas = canvasRef.current;
                            if (canvas) {
                              const ctx = canvas.getContext('2d');
                              ctx?.clearRect(0, 0, canvas.width, canvas.height);
                            }
                          }, 50);
                          setShowSigPad(idx);
                        }}
                        className="shrink-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                      >
                        {sig ? "Alterar" : "Assinar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Assinaturas dos Cargos Fixos ── */}
            <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800/40 flex flex-col gap-3">
              <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                📋 Aprovações / Assinaturas de Responsáveis
              </p>
              {(Object.entries(CARGOS_LABELS) as [string, string][]).map(([key, label]) => {
                const sig = sigCargos[key] || "";
                return (
                  <div key={key} className="flex items-center justify-between gap-3 p-3 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                        {label}
                      </p>
                      {sig ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="p-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm">
                            <img src={sig} alt={`Assinatura ${label}`} className="h-9 object-contain max-w-[140px]" />
                          </div>
                          <button
                            type="button"
                            onClick={() => setSigCargos(prev => { const n = {...prev}; delete n[key]; return n; })}
                            className="text-red-400 hover:text-red-600 text-lg leading-none px-1 transition-colors"
                            title="Remover assinatura"
                          >×</button>
                        </div>
                      ) : (
                        <p className="text-[10px] text-zinc-400 mt-0.5">Sem assinatura</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setTimeout(() => {
                          const canvas = canvasRef.current;
                          if (canvas) { const ctx = canvas.getContext('2d'); ctx?.clearRect(0, 0, canvas.width, canvas.height); }
                        }, 50);
                        setShowSigPad(key as SigPadTarget);
                      }}
                      className="shrink-0 px-3 py-2 bg-zinc-700 hover:bg-zinc-800 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                    >
                      {sig ? "Alterar" : "Assinar"}
                    </button>
                  </div>
                );
              })}
            </div>

            <input type="hidden" name="assinatura_mecanico" value={JSON.stringify({ mecanicos: assinaturas, cargos: sigCargos })} />
          </div>

          {/* Sistema / Subsistema / Componente em cascata */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Sistema / Sub-Sistema / Componente</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="Sistema">
                <select value={sistema} onChange={e => { setSistema(e.target.value); setSubSistema(""); setComponente(""); }} className={I}>
                  <option value="">Selecione...</option>
                  {sistemasUnicos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Sub-Sistema">
                <select value={subSistema} onChange={e => { setSubSistema(e.target.value); setComponente(""); }} disabled={!sistema} className={`${I} disabled:opacity-50`}>
                  <option value="">Selecione...</option>
                  {subsistemasFiltrados.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Componente">
                <select value={componente} onChange={e => setComponente(e.target.value)} disabled={!subSistema} className={`${I} disabled:opacity-50`}>
                  <option value="">Selecione...</option>
                  {componentesFiltrados.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
            </div>
          </div>

          {/* Observações */}
          <Field label="Observações">
            <textarea name="observacoes" rows={2}
              defaultValue={initialData?.observacoes || ""}
              className={`${I} resize-none`} />
          </Field>

          {/* Fotos do Serviço */}
          <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  📸 Fotos do Serviço Feito ({fotos.length}/5)
                </p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  Adicione até 5 fotos para incluir na ordem de serviço
                </p>
              </div>
              {fotos.length < 5 && (
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="fotos-galeria"
                    onClick={saveDraft}
                    className="cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors"
                  >
                    <span className="text-base leading-none font-bold">+</span> Galeria
                  </label>
                  <span className="text-zinc-350 dark:text-zinc-650 text-xs">|</span>
                  {/* 
                    No APK: chama a ponte nativa (sem sair da página).
                    No browser: abre câmera in-page com getUserMedia (sem reload).
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      saveDraft();
                      if (typeof window !== "undefined" && (window as any).EunamanCamera) {
                        // APK: usa ponte nativa Java
                        (window as any).EunamanCamera.openCamera();
                      } else {
                        // Browser: abre câmera in-page (sem sair da página)
                        setShowCameraModal(true);
                      }
                    }}
                    className="cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors bg-transparent border-0 p-0"
                  >
                    📷 Tirar Foto
                  </button>
                </div>
              )}
            </div>

            {fotos.length > 0 ? (
              <div className="grid grid-cols-5 gap-2 mt-2">
                {fotos.map((foto, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black">
                    <img src={foto} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600 hover:bg-red-700 text-white rounded-full transition-colors shadow"
                      title="Remover Foto"
                    >
                      <X size={10} className="stroke-[3]" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 bg-white dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-900 rounded-lg">
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Nenhuma foto adicionada ainda.</p>
              </div>
            )}
          </div>

          {/* Tempo total */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300 font-medium">
            Tempo Total de Manutenção: <span className="font-bold">{tempoFmt}</span>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button type="button" onClick={handleCancel}
              className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
              {loading ? "Salvando..." : initialData ? "Salvar Alterações" : "Criar OS"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Modal de Câmera In-Page ── */}
      {showCameraModal && (
        <CameraModal
          onCapture={(dataUrl) => {
            if (fotos.length >= 5) {
              alert("Você pode lançar no máximo 5 fotos.");
              return;
            }
            setFotos((prev) => {
              if (prev.includes(dataUrl)) return prev;
              return [...prev, dataUrl];
            });
          }}
          onClose={() => setShowCameraModal(false)}
        />
      )}

      {/* ── Modal de Assinatura Digital (Signature Pad) ── */}
      {showSigPad !== false && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-lg">
                Assinatura Digital
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Assine com o dedo ou mouse no quadro abaixo
              </p>
            </div>

            {/* Canvas Area */}
            <div className="relative border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 rounded-xl overflow-hidden h-[180px] flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={340}
                height={176}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={(e) => {
                  if (e.cancelable) e.preventDefault();
                  draw(e);
                }}
                onTouchEnd={stopDrawing}
                className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
              />
            </div>

            {/* Actions */}
            {showSigPad !== false && (
              <p className="text-[11px] text-center font-semibold -mt-1"
                style={{ color: typeof showSigPad === 'string' ? '#1e40af' : '#1a5c1a' }}
              >
                {typeof showSigPad === 'string'
                  ? `✍️ ${CARGOS_LABELS[showSigPad] || showSigPad}`
                  : `🔧 ${mecanicos[showSigPad] || `Mecânico ${showSigPad + 1}`}`
                }
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowSigPad(false);
                  setIsDrawing(false);
                }}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={clearCanvas}
                className="px-4 py-2 text-xs font-bold rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={saveSignature}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const I = "w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</label>
      {children}
    </div>
  );
}
