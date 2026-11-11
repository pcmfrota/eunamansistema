"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Wrench, ChevronRight, Plus, Trash2, Eye, Search, Pencil, CheckCircle2, Camera } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb, deserializeToFormData } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ListRow } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { SegmentedTabs } from "../../ui/primitives/SegmentedTabs";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import { getCurrentLocalDatetime } from "@/src/utils/dateUtils";
import { useNativeCamera } from "../../lib/nativeCamera";
import {
  criarOrdemServico,
  atualizarOrdemServico,
  excluirOrdemServico,
  aprovarOrdemServico,
  getOSImagensClient,
} from "./actions";

const STATUS_OPTIONS = ["Aberta", "Programado", "Fechada"] as const;
const MOTIVOS_FALLBACK = ["Desgaste Natural", "Quebra Operacional", "Falha Elétrica"];

// Forma "de formulário" de DescricaoAtividade (campos sempre string, nunca null/undefined,
// pra ligar direto em inputs controlados) — convertida pra DescricaoAtividade de verdade só
// na hora de montar o payload (buildFields).
type DescricaoAtividadeForm = { descricao: string; hora_inicio: string; hora_fim: string; foto: string };
const blankDescricaoAtividade = (): DescricaoAtividadeForm => ({ descricao: "", hora_inicio: "", hora_fim: "", foto: "" });

function FotoSlot({ label, url, onCapture, onClear }: { label: string; url?: string; onCapture: () => void; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={url ? onClear : onCapture}
      className="aspect-video rounded-xl border border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 overflow-hidden relative"
    >
      {url ? (
        <img src={url} className="w-full h-full object-cover" />
      ) : (
        <>
          <Camera size={18} className="text-zinc-500" />
          <span className="text-[9px] font-bold text-zinc-500 text-center px-1">{label}</span>
        </>
      )}
    </button>
  );
}

// Assinatura por toque/mouse num canvas — mesmo padrão já usado em Lubrificação/Lavagens.
function SignaturePad({ label, value, onChange }: { label: string; value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const drawingRef = React.useRef(false);
  const hasDrawnRef = React.useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    if (!value && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      hasDrawnRef.current = false;
    }
  }, [value]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnRef.current = true;
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (hasDrawnRef.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  };

  const limpar = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasDrawnRef.current = false;
    onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-zinc-400">{label}</label>
        {value && (
          <button type="button" onClick={limpar} className="text-[10px] font-black text-red-400 uppercase tracking-widest">
            Limpar
          </button>
        )}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-white overflow-hidden">
        <canvas
          ref={canvasRef}
          width={600}
          height={160}
          className="w-full h-[120px] touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
    </div>
  );
}

function blankForm() {
  return {
    horario_parada: "",
    data_abertura: getCurrentLocalDatetime(),
    data_fechamento: "",
    status: "Aberta",
    equipamento_id: "",
    placa: "",
    modulo: "",
    horimetro: "",
    km: "",
    operacao_tipo: "",
    local: "",
    foto_horimetro: "",
    foto_km: "",
    descricoes_atividade: [blankDescricaoAtividade()] as DescricaoAtividadeForm[],
    motivo: "",
    observacoes: "",
    mecanicos: [""] as string[],
    assinaturas: [""] as string[],
    fotos: [] as string[],
  };
}

export default function OSClient({
  equipamentos,
  colaboradores,
  ordensIniciais,
}: {
  equipamentos: any[];
  colaboradores: any[];
  ordensIniciais: any[];
}) {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const toast = useToast();

  const role = (profile?.role || "").toLowerCase().trim();
  const podeAprovar = role === "admin" || role === "pcm";
  const podeCriar = role !== "visitante";
  const podeExcluir = role === "admin" || role === "pcm" || role === "gestao";

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [ordens, setOrdens] = useState<any[]>(ordensIniciais);
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<"lista" | "validacao">("lista");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [salvando, setSalvando] = useState(false);

  const [actionItem, setActionItem] = useState<any>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  useEffect(() => setOrdens(ordensIniciais), [ordensIniciais]);

  const placasOptions = useMemo(() => equipamentos.map((e) => ({ value: e.id, label: e.placa })), [equipamentos]);
  const colaboradoresOptions = useMemo(() => colaboradores.map((c) => ({ value: c.nome, label: c.nome })), [colaboradores]);

  const pendentesValidacao = useMemo(() => ordens.filter((o) => o.aprovado === false), [ordens]);

  const listaFiltrada = useMemo(() => {
    const base = aba === "validacao" ? pendentesValidacao : ordens;
    return [...base]
      .filter((o) => !busca || (o.placa || "").toLowerCase().includes(busca.toLowerCase()) || (o.numero_os || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => (b.data_abertura || "").localeCompare(a.data_abertura || ""));
  }, [ordens, pendentesValidacao, aba, busca]);

  // ── Ponte nativa da câmera (EunamanCamera) — serviço único em lib/nativeCamera.ts ──
  const { openCamera: abrirCameraNativa } = useNativeCamera("eunaman_os_active_photo_field", (alvo, compressed) => {
    if (alvo === "foto_horimetro" || alvo === "foto_km") {
      setForm((p) => ({ ...p, [alvo]: compressed }));
    } else if (alvo.startsWith("fotos:")) {
      const idx = Number(alvo.split(":")[1]);
      setForm((p) => {
        const arr = [...p.fotos];
        arr[idx] = compressed;
        return { ...p, fotos: arr };
      });
    } else if (alvo.startsWith("descricao:")) {
      const idx = Number(alvo.split(":")[1]);
      setForm((p) => {
        const arr = [...p.descricoes_atividade];
        if (arr[idx]) arr[idx] = { ...arr[idx], foto: compressed };
        return { ...p, descricoes_atividade: arr };
      });
    }
  });

  // ── Rascunho do formulário (sobrevive ao reload que o Android dá na Activity
  // enquanto o app de Câmera nativo está em primeiro plano, pra liberar memória —
  // comum em aparelhos com pouca RAM) — mesmo padrão de CaptacaoClient.tsx. Sem isso,
  // a foto tirada volta certinho (via EunamanCamera.getPendingPhoto acima) mas fica
  // anexada a um formulário em branco atrás de uma folha fechada: pro usuário parece
  // que "o app recarregou e perdeu tudo".
  const hasRestoredRef = React.useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (sheetOpen) {
        localStorage.setItem("eunaman_os_form_draft", JSON.stringify({ form, editingId }));
        localStorage.setItem("eunaman_os_sheet_open", "true");
      } else {
        localStorage.removeItem("eunaman_os_form_draft");
        localStorage.setItem("eunaman_os_sheet_open", "false");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho da OS:", e);
    }
  }, [form, editingId, sheetOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const sheetWasOpen = localStorage.getItem("eunaman_os_sheet_open");
      const draft = localStorage.getItem("eunaman_os_form_draft");
      if (sheetWasOpen === "true" && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object" && parsed.form) {
          setForm(parsed.form);
          setEditingId(parsed.editingId ?? null);
          setSheetOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho da OS:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  const abrirCamera = (alvo: string) => {
    abrirCameraNativa(alvo, () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"));
  };

  const abrirNovo = () => {
    setEditingId(null);
    setForm(blankForm());
    setSheetOpen(true);
  };

  const abrirEdicao = async (o: any) => {
    setEditingId(o.id);
    let fotosExtra: any = {};
    if (isOnline && !String(o.id).startsWith("temp_")) {
      const res = await getOSImagensClient(o.id);
      if (res && "data" in res && res.data) fotosExtra = res.data;
    }
    let assinaturasSalvas: string[] = [];
    try {
      const parsed = JSON.parse(o.assinatura_mecanico || fotosExtra.assinatura_mecanico || "{}");
      assinaturasSalvas = Array.isArray(parsed.mecanicos) ? parsed.mecanicos : [];
    } catch {}
    const mecanicosSalvos = Array.isArray(o.mecanicos) && o.mecanicos.length > 0 ? o.mecanicos : [""];
    // descricoes_atividade (como fotos/foto_horimetro/foto_km) fica de fora da listagem em
    // massa por ter fotos — só vem em fotosExtra, buscado sob demanda acima. OS antigas
    // (gravadas antes desse campo existir) continuam editáveis: monta um único bloco a
    // partir do texto legado de `descricao`, sem perder nada.
    const descricoesOrigem = Array.isArray(fotosExtra.descricoes_atividade) && fotosExtra.descricoes_atividade.length > 0
      ? fotosExtra.descricoes_atividade
      : o.descricoes_atividade;
    const descricoesSalvas: DescricaoAtividadeForm[] =
      Array.isArray(descricoesOrigem) && descricoesOrigem.length > 0
        ? descricoesOrigem.map((d: any) => ({
            descricao: d?.descricao || "",
            hora_inicio: d?.hora_inicio || "",
            hora_fim: d?.hora_fim || "",
            foto: d?.foto || "",
          }))
        : [{ ...blankDescricaoAtividade(), descricao: o.descricao || "" }];
    setForm({
      horario_parada: (o.horario_parada || "").slice(0, 16),
      data_abertura: (o.data_abertura || "").slice(0, 16),
      data_fechamento: (o.data_fechamento || "").slice(0, 16),
      status: o.status || "Aberta",
      equipamento_id: o.equipamento_id || "",
      placa: o.placa || "",
      modulo: o.modulo || "",
      horimetro: o.horimetro != null ? String(o.horimetro) : "",
      km: o.km != null ? String(o.km) : "",
      operacao_tipo: o.operacao_tipo || "",
      local: o.local || "",
      foto_horimetro: fotosExtra.foto_horimetro || o.foto_horimetro || "",
      foto_km: fotosExtra.foto_km || o.foto_km || "",
      descricoes_atividade: descricoesSalvas,
      motivo: o.motivo || "",
      observacoes: o.observacoes || "",
      mecanicos: mecanicosSalvos,
      assinaturas: mecanicosSalvos.map((_: string, i: number) => assinaturasSalvas[i] || ""),
      fotos: fotosExtra.fotos || o.fotos || [],
    });
    setSheetOpen(true);
  };

  // "Ver Detalhes" também precisa buscar sob demanda (mesmo motivo de abrirEdicao acima):
  // fotos/foto_horimetro/foto_km/descricoes_atividade ficam fora da listagem em massa.
  const abrirVisualizacao = async (o: any) => {
    let fotosExtra: any = {};
    if (isOnline && !String(o.id).startsWith("temp_")) {
      const res = await getOSImagensClient(o.id);
      if (res && "data" in res && res.data) fotosExtra = res.data;
    }
    setViewItem({ ...o, ...fotosExtra });
  };

  const onSelecionarPlaca = (equipamentoId: string) => {
    const eq = equipamentos.find((e) => e.id === equipamentoId);
    setForm((p) => ({ ...p, equipamento_id: equipamentoId, placa: eq?.placa || "", modulo: eq?.modulo || "", operacao_tipo: eq?.categoria || "" }));
  };

  const horasManutencao = useMemo(() => {
    if (!form.data_abertura || !form.data_fechamento) return 0;
    const diffMin = Math.floor((new Date(form.data_fechamento).getTime() - new Date(form.data_abertura).getTime()) / 60000);
    return diffMin > 0 ? Number((diffMin / 60).toFixed(2)) : 0;
  }, [form.data_abertura, form.data_fechamento]);

  // Monta o mapa de campos "achatado" (mesma convenção de app/os/actions.ts: mecanico_1..5,
  // fotos como múltiplos valores) usado tanto pro FormData (caminho online) quanto pro
  // payload da fila offline — nunca via fd.entries()/Object.fromEntries, que colapsa
  // chaves repetidas (perderia todas as fotos além da última).
  const buildFields = () => {
    const fields: Record<string, any> = {
      equipamento_id: form.equipamento_id,
      placa: form.placa,
      modulo: form.modulo,
      status: form.data_fechamento ? "Fechada" : form.status,
      data_abertura: form.data_abertura,
      data_fechamento: form.data_fechamento || null,
      horimetro: form.horimetro || null,
      km: form.km || null,
      foto_horimetro: form.foto_horimetro || null,
      foto_km: form.foto_km || null,
      operacao_tipo: form.operacao_tipo,
      local: form.local,
      descricao: form.descricoes_atividade
        .map((d) => d.descricao.trim())
        .filter(Boolean)
        .map((texto, i) => `${i + 1}) ${texto}`)
        .join("\n\n"),
      descricoes_atividade: JSON.stringify(
        form.descricoes_atividade.filter((d) => d.descricao.trim() || d.hora_inicio || d.hora_fim || d.foto)
      ),
      motivo: form.motivo,
      observacoes: form.observacoes,
      horario_parada: form.horario_parada,
      horas_manutencao: horasManutencao,
      assinatura_mecanico: JSON.stringify({ mecanicos: form.assinaturas, cargos: {} }),
      fotos: form.fotos.filter(Boolean),
    };
    form.mecanicos.forEach((nome, idx) => {
      if (nome.trim()) fields[`mecanico_${idx + 1}`] = nome.trim();
    });
    return fields;
  };

  const temDescricaoPreenchida = useMemo(
    () => form.descricoes_atividade.some((d) => d.descricao.trim()),
    [form.descricoes_atividade]
  );

  const handleSalvar = async () => {
    if (!form.equipamento_id || !form.horario_parada || !form.data_abertura || !temDescricaoPreenchida) {
      toast.show("Preencha Placa, Horário da Parada, Início da Manutenção e ao menos uma Descrição.", "error");
      return;
    }
    setSalvando(true);
    try {
      const fields = buildFields();
      const mecanicosArray = form.mecanicos.map((m) => m.trim()).filter(Boolean);

      if (isOnline) {
        const fd = deserializeToFormData(fields);
        const res = editingId ? await atualizarOrdemServico(editingId, fd) : await criarOrdemServico(fd);
        if (res && "error" in res) {
          toast.show("Erro ao salvar: " + res.error, "error");
          setSalvando(false);
          return;
        }
        const saved = res as any;
        await localDb.put("ordens_servico", saved);
        setOrdens((prev) => (editingId ? prev.map((o) => (o.id === editingId ? saved : o)) : [saved, ...prev]));
        toast.show(editingId ? "OS atualizada!" : "OS criada!", "success");
      } else if (editingId) {
        const current = ordens.find((o) => o.id === editingId);
        const updated = { ...current, ...fields, mecanicos: mecanicosArray, _isPendingSync: true };
        await localDb.put("ordens_servico", updated);
        await localDb.addToQueue("os", "update", { id: editingId, ...fields });
        setOrdens((prev) => prev.map((o) => (o.id === editingId ? updated : o)));
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        toast.show("OS atualizada offline — sincroniza quando a conexão voltar.", "success");
      } else {
        const tempId = `temp_os_${Date.now()}`;
        const tempNum = `OS-OFF-${Math.floor(Math.random() * 9000) + 1000}`;
        const optimistic = {
          id: tempId,
          numero_os: tempNum,
          ...fields,
          classe: "CORRETIVA",
          foi_enviado_reserva: false,
          mecanicos: mecanicosArray,
          aprovado: false,
          _isPendingSync: true,
        };
        await localDb.put("ordens_servico", optimistic);
        await localDb.addToQueue("os", "create", { ...fields, temp_numero_os: tempNum });
        setOrdens((prev) => [optimistic, ...prev]);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        toast.show("OS criada offline — sincroniza quando a conexão voltar.", "success");
      }
      window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
      setSheetOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  const handleAprovar = async (o: any) => {
    if (isOnline) {
      const res = await aprovarOrdemServico(o.id);
      if (res && "error" in res) {
        toast.show("Erro ao aprovar: " + res.error, "error");
        return;
      }
      const saved = res as any;
      await localDb.put("ordens_servico", saved);
      setOrdens((prev) => prev.map((x) => (x.id === o.id ? saved : x)));
    } else {
      const updated = { ...o, aprovado: true, _isPendingSync: true };
      await localDb.put("ordens_servico", updated);
      await localDb.addToQueue("os", "approve", { id: o.id });
      setOrdens((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
    toast.show("OS aprovada.", "success");
  };

  const handleExcluir = async (o: any) => {
    const isTempLocal = String(o.id).startsWith("temp_os_");
    if (isTempLocal) {
      const queue = await localDb.getQueue();
      const queueItem = queue.find((q: any) => q.entity === "os" && q.action === "create" && q.payload?.temp_numero_os === o.numero_os);
      if (queueItem?.id !== undefined) await localDb.removeFromQueue(queueItem.id);
    } else if (isOnline) {
      const res = await excluirOrdemServico(o.id);
      if (res && "error" in res) {
        toast.show("Erro ao excluir: " + res.error, "error");
        return;
      }
    } else {
      await localDb.addToQueue("os", "delete", o.id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    await localDb.delete("ordens_servico", o.id);
    setOrdens((prev) => prev.filter((x) => x.id !== o.id));
    window.dispatchEvent(new CustomEvent("offline-db-updated-ordens_servico"));
    toast.show("OS excluída.", "success");
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const statusColor = (status: string) =>
    status === "Fechada" ? "text-emerald-400" : status === "Programado" ? "text-blue-400" : status === "Cancelada" ? "text-zinc-500" : "text-amber-400";

  const actionSheetItems: ActionSheetItem[] = actionItem
    ? [
        { key: "ver", label: "Ver Detalhes", icon: Eye, onSelect: () => abrirVisualizacao(actionItem) },
        ...(podeCriar ? [{ key: "editar", label: "Editar", icon: Pencil, onSelect: () => abrirEdicao(actionItem) } as ActionSheetItem] : []),
        ...(podeAprovar && actionItem.aprovado === false
          ? [{ key: "aprovar", label: "Aprovar", icon: CheckCircle2, onSelect: () => handleAprovar(actionItem) } as ActionSheetItem]
          : []),
        ...(podeExcluir
          ? [{ key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(actionItem) } as ActionSheetItem]
          : []),
      ]
    : [];

  return (
    <div className="min-h-full p-4 space-y-3 pb-24">
      <SegmentedTabs
        items={[
          { key: "lista", label: "Lista" },
          ...(podeAprovar ? [{ key: "validacao", label: `Validação${pendentesValidacao.length > 0 ? ` (${pendentesValidacao.length})` : ""}` }] : []),
        ]}
        value={aba}
        onChange={(v) => setAba(v as "lista" | "validacao")}
      />

      <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
        <Search size={16} className="text-zinc-500" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar placa ou nº da OS..."
          className="flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </div>

      {listaFiltrada.length === 0 ? (
        <EmptyState icon={Wrench} title="Nenhuma OS encontrada" description="Toque em Nova OS para abrir uma ordem de serviço." />
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((o) => (
            <ListRow
              key={o.id}
              icon={<Wrench size={18} />}
              title={`${o.numero_os || "—"} · ${o.placa}`}
              subtitle={(o.data_abertura || "").slice(0, 10).split("-").reverse().join("/")}
              badge={
                <span className={`text-[9px] font-black uppercase tracking-wide ${statusColor(o.status)}`}>
                  {o.status || "Aberta"}{o.aprovado === false ? " · Pendente" : ""}
                </span>
              }
              onClick={() => setActionItem(o)}
              rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
            />
          ))}
        </div>
      )}

      {podeCriar && aba === "lista" && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Nova OS" />}

      {/* ─── FORMULÁRIO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={editingId ? "Editar OS" : "Nova OS"} fullHeight>
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelCls}>Horário Real da Parada *</label>
            <input
              type="datetime-local"
              value={form.horario_parada}
              onChange={(e) => setForm((p) => ({ ...p, horario_parada: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Início Manutenção *</label>
              <input
                type="datetime-local"
                value={form.data_abertura}
                onChange={(e) => setForm((p) => ({ ...p, data_abertura: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Fechamento</label>
              <input
                type="datetime-local"
                value={form.data_fechamento}
                onChange={(e) => setForm((p) => ({ ...p, data_fechamento: e.target.value, status: e.target.value ? "Fechada" : p.status }))}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Status *</label>
              <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Placa *</label>
              <SearchableSelect value={form.equipamento_id} onChange={onSelecionarPlaca} options={placasOptions} placeholder="Selecione o equipamento..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Horímetro</label>
              <input type="number" step="0.1" value={form.horimetro} onChange={(e) => setForm((p) => ({ ...p, horimetro: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>KM</label>
              <input type="number" step="0.1" value={form.km} onChange={(e) => setForm((p) => ({ ...p, km: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Operação (Tipo)</label>
              <input value={form.operacao_tipo} onChange={(e) => setForm((p) => ({ ...p, operacao_tipo: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Local da Atividade</label>
              <input value={form.local} onChange={(e) => setForm((p) => ({ ...p, local: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FotoSlot label="Foto Horímetro" url={form.foto_horimetro} onCapture={() => abrirCamera("foto_horimetro")} onClear={() => setForm((p) => ({ ...p, foto_horimetro: "" }))} />
            <FotoSlot label="Foto KM" url={form.foto_km} onCapture={() => abrirCamera("foto_km")} onClear={() => setForm((p) => ({ ...p, foto_km: "" }))} />
          </div>

          {/* Descrições da atividade — lista repetível, cada bloco com horário inicial/final
              e foto própria (sem limite de quantidade) */}
          <div className="p-3.5 rounded-xl bg-amber-950/10 border border-amber-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-amber-500 uppercase tracking-wide">Descrições da Atividade *</p>
              <button
                type="button"
                onClick={() =>
                  setForm((p) => ({ ...p, descricoes_atividade: [...p.descricoes_atividade, blankDescricaoAtividade()] }))
                }
                className="text-[10px] font-black text-amber-500 uppercase"
              >
                + Adicionar Descrição
              </button>
            </div>
            {form.descricoes_atividade.map((bloco, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-zinc-500 uppercase">Descrição {idx + 1}</span>
                  {form.descricoes_atividade.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({ ...p, descricoes_atividade: p.descricoes_atividade.filter((_, i) => i !== idx) }))
                      }
                      className="text-red-400 text-lg leading-none px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
                <textarea
                  value={bloco.descricao}
                  onChange={(e) =>
                    setForm((p) => {
                      const arr = [...p.descricoes_atividade];
                      arr[idx] = { ...arr[idx], descricao: e.target.value };
                      return { ...p, descricoes_atividade: arr };
                    })
                  }
                  rows={2}
                  placeholder="Descreva a falha ou manutenção..."
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">Horário Inicial</label>
                    <input
                      type="time"
                      value={bloco.hora_inicio}
                      onChange={(e) =>
                        setForm((p) => {
                          const arr = [...p.descricoes_atividade];
                          arr[idx] = { ...arr[idx], hora_inicio: e.target.value };
                          return { ...p, descricoes_atividade: arr };
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-1">Horário Final</label>
                    <input
                      type="time"
                      value={bloco.hora_fim}
                      onChange={(e) =>
                        setForm((p) => {
                          const arr = [...p.descricoes_atividade];
                          arr[idx] = { ...arr[idx], hora_fim: e.target.value };
                          return { ...p, descricoes_atividade: arr };
                        })
                      }
                      className={inputCls}
                    />
                  </div>
                </div>
                <FotoSlot
                  label="Foto desta descrição"
                  url={bloco.foto}
                  onCapture={() => abrirCamera(`descricao:${idx}`)}
                  onClear={() =>
                    setForm((p) => {
                      const arr = [...p.descricoes_atividade];
                      arr[idx] = { ...arr[idx], foto: "" };
                      return { ...p, descricoes_atividade: arr };
                    })
                  }
                />
              </div>
            ))}
          </div>

          <div>
            <label className={labelCls}>Motivo</label>
            <select value={form.motivo} onChange={(e) => setForm((p) => ({ ...p, motivo: e.target.value }))} className={inputCls}>
              <option value="">Selecione...</option>
              {MOTIVOS_FALLBACK.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {/* Mecânicos + assinaturas */}
          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black text-emerald-400 uppercase tracking-wide">Mecânicos Executores</p>
              {form.mecanicos.length < 5 && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, mecanicos: [...p.mecanicos, ""], assinaturas: [...p.assinaturas, ""] }))}
                  className="text-[10px] font-black text-emerald-400 uppercase"
                >
                  + Adicionar
                </button>
              )}
            </div>
            {form.mecanicos.map((nome, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      value={nome}
                      onChange={(v) => setForm((p) => { const arr = [...p.mecanicos]; arr[idx] = v; return { ...p, mecanicos: arr }; })}
                      options={colaboradoresOptions}
                      placeholder={`Mecânico ${idx + 1}...`}
                    />
                  </div>
                  {form.mecanicos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setForm((p) => ({
                        ...p,
                        mecanicos: p.mecanicos.filter((_, i) => i !== idx),
                        assinaturas: p.assinaturas.filter((_, i) => i !== idx),
                      }))}
                      className="text-red-400 text-lg leading-none px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
                {nome.trim() && (
                  <SignaturePad
                    label={`Assinatura — ${nome}`}
                    value={form.assinaturas[idx] || ""}
                    onChange={(v) => setForm((p) => { const arr = [...p.assinaturas]; arr[idx] = v; return { ...p, assinaturas: arr }; })}
                  />
                )}
              </div>
            ))}
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} rows={3} className={inputCls} />
          </div>

          {/* Fotos do serviço */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Fotos do Serviço ({form.fotos.filter(Boolean).length}/5)</label>
              {form.fotos.filter(Boolean).length < 5 && (
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, fotos: [...p.fotos, ""] }))}
                  className="text-[10px] font-black text-amber-500 uppercase"
                >
                  + Adicionar
                </button>
              )}
            </div>
            {form.fotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.fotos.map((url, idx) => (
                  <FotoSlot
                    key={idx}
                    label={`Foto ${idx + 1}`}
                    url={url}
                    onCapture={() => abrirCamera(`fotos:${idx}`)}
                    onClear={() => setForm((p) => ({ ...p, fotos: p.fotos.filter((_, i) => i !== idx) }))}
                  />
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleSalvar}
            disabled={salvando || !form.equipamento_id || !temDescricaoPreenchida}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : editingId ? "Salvar Alterações" : "Abrir OS"}
          </button>
        </div>
      </BottomSheet>

      {/* ─── VISUALIZAÇÃO (SOMENTE LEITURA) ─── */}
      <BottomSheet open={!!viewItem} onClose={() => setViewItem(null)} title={viewItem ? `OS ${viewItem.numero_os}` : undefined} fullHeight>
        {viewItem && (
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Placa</p>
                <p className="font-black text-zinc-100">{viewItem.placa}</p>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Status</p>
                <p className={`font-black ${statusColor(viewItem.status)}`}>{viewItem.status}{viewItem.aprovado === false ? " · Pendente de validação" : ""}</p>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Abertura</p>
                <p className="font-black text-zinc-100">{(viewItem.data_abertura || "").slice(0, 16).replace("T", " ")}</p>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Fechamento</p>
                <p className="font-black text-zinc-100">{viewItem.data_fechamento ? viewItem.data_fechamento.slice(0, 16).replace("T", " ") : "—"}</p>
              </div>
            </div>
            {Array.isArray(viewItem.descricoes_atividade) && viewItem.descricoes_atividade.length > 0 ? (
              <div className="space-y-2">
                {viewItem.descricoes_atividade.map((bloco: any, idx: number) => (
                  <div key={idx} className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl space-y-2">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">Descrição {idx + 1}</p>
                    <p className="text-sm text-zinc-200 whitespace-pre-wrap">{bloco.descricao}</p>
                    {(bloco.hora_inicio || bloco.hora_fim) && (
                      <p className="text-[11px] text-zinc-400 font-bold">
                        {bloco.hora_inicio || "—"} às {bloco.hora_fim || "—"}
                      </p>
                    )}
                    {bloco.foto && <img src={bloco.foto} className="w-full rounded-lg object-cover max-h-40" />}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Descrição</p>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{viewItem.descricao}</p>
              </div>
            )}
            {Array.isArray(viewItem.mecanicos) && viewItem.mecanicos.length > 0 && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Mecânicos</p>
                <p className="text-sm text-zinc-200">{viewItem.mecanicos.join(", ")}</p>
              </div>
            )}
            {viewItem.observacoes && (
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">Observações</p>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap">{viewItem.observacoes}</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ActionSheet open={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? `OS ${actionItem.numero_os}` : undefined} items={actionSheetItems} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir OS"
        description="Esta ação não pode ser desfeita. Backlogs vinculados a esta OS não serão excluídos."
        destructive
      />
    </div>
  );
}
