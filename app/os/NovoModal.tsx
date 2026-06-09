"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { X, CheckCircle2, AlertTriangle, ListChecks, Check } from "lucide-react";
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
  const [showSigPad, setShowSigPad] = useState(false);
  const [assinaturaDataUrl, setAssinaturaDataUrl] = useState(initialData?.assinatura_mecanico || "");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [resolvedBacklogs, setResolvedBacklogs] = useState<Set<string>>(new Set());
  const [fotos, setFotos] = useState<string[]>(initialData?.fotos || []);

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

  useEffect(() => {
    if (initialData?.equipamento_id) {
      const eq = equipamentos.find(e => e.id === initialData.equipamento_id) || null;
      setEquip(eq);
      if (!initialData.operacao_tipo && eq) {
        setOperacaoTipo(eq.tipo || "");
      }
    }
  }, []);

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
    
    // Validar se o canvas não está em branco
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      alert("Por favor, faça a assinatura antes de salvar.");
      return;
    }

    setAssinaturaDataUrl(canvas.toDataURL());
    setShowSigPad(false);
  };

  const handleFotosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    
    if (fotos.length + files.length > 5) {
      alert("Você pode lançar no máximo 5 fotos.");
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setFotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
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
      fd.set("assinatura_mecanico", assinaturaDataUrl);

      // Mecânicos: envia cada nome individualmente
      mecanicos.forEach((nome, idx) => {
        fd.set(`mecanico_${idx + 1}`, nome.trim());
      });

      // Fotos do serviço: envia as fotos
      fotos.forEach((foto) => {
        fd.append("fotos", foto);
      });

      if (isOnline) {
        const res = initialData
          ? await atualizarOrdemServico(initialData.id, fd)
          : await criarOrdemServico(fd);

        if (res && typeof res === "object" && "error" in res) {
          // Erro real vindo do servidor
          alert("Erro ao salvar: " + res.error);
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
        onClose();
      } else {
        // Cenário offline
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
            assinatura_mecanico: assinaturaDataUrl,
            fotos: fotos,
            _isPendingSync: true
          };
          await localDb.put("ordens_servico", newOS);
          await localDb.addToQueue("os", "create", serialized);
        }

        // Notifica as tabelas e fecha o modal
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
        onClose();
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
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

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
              <select name="equipamento_id" required
                defaultValue={initialData?.equipamento_id || ""}
                onChange={e => handleEquipChange(e.target.value)}
                className={I}>
                <option value="">Selecione a placa...</option>
                {filteredEquipamentos.map(eq => (
                  <option key={eq.id} value={eq.id}>{eq.placa}</option>
                ))}
              </select>
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
                  <select
                    value={nome}
                    onChange={e => {
                      const copia = [...mecanicos];
                      copia[idx] = e.target.value;
                      setMecanicos(copia);
                    }}
                    className={`${I} flex-1`}
                  >
                    <option value="">Selecione o mecânico {idx + 1}...</option>
                    {colaboradores.map(colab => (
                      <option key={colab.id} value={colab.nome}>
                        {colab.nome}
                      </option>
                    ))}
                  </select>
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

            {mecanicos.some(m => m.trim() !== "") && (
              <div className="mt-4 pt-4 border-t border-emerald-200 dark:border-emerald-800/40 flex flex-col xs:flex-row xs:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wide">
                    Assinatura Digital do Mecânico
                  </p>
                  {assinaturaDataUrl ? (
                    <div className="mt-1.5 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg max-w-[200px] shadow-sm flex items-center justify-center">
                      <img src={assinaturaDataUrl} alt="Assinatura" className="h-10 object-contain max-w-full" />
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-400 mt-0.5">Nenhuma assinatura registrada para esta OS</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowSigPad(true)}
                  className="shrink-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm self-start xs:self-center"
                >
                  {assinaturaDataUrl ? "Alterar Assinatura" : "Assinar Digitalmente"}
                </button>
              </div>
            )}
            <input type="hidden" name="assinatura_mecanico" value={assinaturaDataUrl} />
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
                  <label htmlFor="fotos-galeria" className="cursor-pointer text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition-colors">
                    <span className="text-base leading-none font-bold">+</span> Galeria
                  </label>
                  <input
                    id="fotos-galeria"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFotosChange}
                    className="hidden"
                  />
                  <span className="text-zinc-350 dark:text-zinc-650 text-xs">|</span>
                  <label htmlFor="fotos-camera" className="cursor-pointer text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 transition-colors">
                    📷 Tirar Foto
                  </label>
                  <input
                    id="fotos-camera"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFotosChange}
                    className="hidden"
                  />
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
            <button type="button" onClick={onClose}
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

      {/* ── Modal de Assinatura Digital (Signature Pad) ── */}
      {showSigPad && (
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
