"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  FileText,
  Plus,
  Camera,
  Trash2,
  Pencil,
  Eye,
  Search,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useNativeCamera } from "../../lib/nativeCamera";
import { ListRow } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { StatTile } from "../../ui/primitives/StatTile";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import {
  registrarFichaLubrificacao,
  atualizarFichaLubrificacao,
  excluirFichaLubrificacao,
  obterImagensFichaLubrificacao,
  FichaLubrificacao,
  ChecklistItem,
} from "./actions";
import { getCurrentLocalDate } from "@/src/utils/dateUtils";

// Mesmos itens padrão do app principal (app/lubrificacao/LubrificacaoClient.tsx) — dado de
// negócio real, não layout, não reinventar.
const ITENS_LUBRIFICACAO_DEFAULT: ChecklistItem[] = [
  { item: "Pinos da manga de eixo da direção (lado direito)", status: "Executado" },
  { item: "Pinos da manga de eixo da direção (lado esquerdo)", status: "Executado" },
  { item: "Cruzetas da transmissão", status: "Executado" },
  { item: "Cruzetas da tomada de força (PIPA/Comboio)", status: "Executado" },
  { item: "Rolamento central", status: "Executado" },
  { item: "Catracas de freio dianteiras", status: "Executado" },
  { item: "Catracas de freio traseiras", status: "Executado" },
  { item: "Articulações do cilindro do deslizante e basculante", status: "Executado" },
];

const ITENS_GERAL_DEFAULT: ChecklistItem[] = [
  { item: "Limpeza do filtro de ar", status: "SIM" },
  { item: "Esgotar água do racoor", status: "SIM" },
  { item: "Drenagem do compressor de ar", status: "SIM" },
  { item: "Verificar nível do óleo do motor", status: "SIM" },
  { item: "Verificar nível do líquido de arrefecimento", status: "SIM" },
  { item: "Reapertar grampos do chassi", status: "SIM" },
  { item: "Reapertar grampos dos feixes de molas", status: "SIM" },
  { item: "Reapertar parafusos dos vasos de pressão", status: "SIM" },
  { item: "Verificar suspiro do diferencial", status: "SIM" },
  { item: "Regular catracas de freio", status: "SIM" },
];

const ITENS_REAPERTOS_DEFAULT: ChecklistItem[] = [
  { item: "Feixe de Molas", status: "Executado" },
  { item: "Grampos", status: "Executado" },
  { item: "Suspensão", status: "Executado" },
  { item: "Vasos de pressão", status: "Executado" },
  { item: "Cardan", status: "Executado" },
  { item: "Suportes", status: "Executado" },
  { item: "Caixa de direção", status: "Executado" },
  { item: "Diferencial", status: "Executado" },
  { item: "Cubos", status: "Executado" },
  { item: "Rodas", status: "Executado" },
  { item: "Outros", status: "Não Executado" },
];

function hoje() {
  return getCurrentLocalDate();
}

function blankForm() {
  return {
    id: "",
    data_registro: hoje(),
    hora_inicio: "07:00",
    hora_fim: "08:00",
    equipamento_id: "",
    placa: "",
    modulo: "BASE",
    local_servico: "OFICINA BASE",
    cliente: "SUZANO",
    horimetro_inicio: "",
    horimetro_fim: "",
    mecanico_responsavel: "",
    ajudante: "",
    checklist_lubrificacao: ITENS_LUBRIFICACAO_DEFAULT.map((i) => ({ ...i })),
    checklist_geral: ITENS_GERAL_DEFAULT.map((i) => ({ ...i })),
    reapertos: ITENS_REAPERTOS_DEFAULT.map((i) => ({ ...i })),
    observacoes: "",
    fotos_antes: ["", ""] as string[],
    fotos_depois: ["", ""] as string[],
    assinatura_mecanico: "",
    assinatura_lider: "",
  };
}

type View = "menu" | "historico";

export default function LubrificacaoClient({
  equipamentos,
  colaboradores,
  fichasIniciais,
}: {
  equipamentos: any[];
  colaboradores: any[];
  fichasIniciais: FichaLubrificacao[];
}) {
  const { isOnline } = useOffline();
  const toast = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [view, setView] = useState<View>("menu");
  const [fichas, setFichas] = useState<FichaLubrificacao[]>(fichasIniciais);
  const [busca, setBusca] = useState("");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [salvando, setSalvando] = useState(false);

  const [actionItem, setActionItem] = useState<FichaLubrificacao | null>(null);
  const [previewItem, setPreviewItem] = useState<FichaLubrificacao | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<FichaLubrificacao | null>(null);

  useEffect(() => setFichas(fichasIniciais), [fichasIniciais]);

  const placasOptions = useMemo(() => equipamentos.map((eq) => ({ value: eq.placa, label: eq.placa })), [equipamentos]);
  const colaboradoresOptions = useMemo(() => colaboradores.map((c) => ({ value: c.nome, label: c.nome })), [colaboradores]);

  const listaFiltrada = useMemo(() => {
    return [...fichas]
      .filter((f) => !busca || (f.placa || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => (b.data_registro || "").localeCompare(a.data_registro || ""));
  }, [fichas, busca]);

  // ── Ponte nativa da câmera (EunamanCamera) — serviço único em lib/nativeCamera.ts ──
  const { openCamera: abrirCameraNativa } = useNativeCamera("eunaman_lubrificacao_active_field", (activeField, compressed) => {
    const [grupo, idxStr] = activeField.split(":");
    const idx = Number(idxStr);
    setForm((prev) => {
      const arr = [...(prev as any)[grupo]];
      arr[idx] = compressed;
      return { ...prev, [grupo]: arr };
    });
  });

  // ── Rascunho do formulário (sobrevive ao reload que o Android dá na Activity
  // enquanto o app de Câmera nativo está em primeiro plano) — mesmo padrão de
  // CaptacaoClient.tsx/OSClient.tsx/LavagensClient.tsx. form.id já distingue edição de
  // criação aqui, então não precisa de um editingId separado.
  const hasRestoredRef = React.useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (sheetOpen) {
        localStorage.setItem("eunaman_lubrificacao_form_draft", JSON.stringify(form));
        localStorage.setItem("eunaman_lubrificacao_sheet_open", "true");
      } else {
        localStorage.removeItem("eunaman_lubrificacao_form_draft");
        localStorage.setItem("eunaman_lubrificacao_sheet_open", "false");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de lubrificação:", e);
    }
  }, [form, sheetOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const sheetWasOpen = localStorage.getItem("eunaman_lubrificacao_sheet_open");
      const draft = localStorage.getItem("eunaman_lubrificacao_form_draft");
      if (sheetWasOpen === "true" && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object") {
          setForm(parsed);
          setSheetOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de lubrificação:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  const handleCapture = (grupo: "fotos_antes" | "fotos_depois", idx: number) => {
    abrirCameraNativa(`${grupo}:${idx}`, () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"));
  };

  const abrirNovo = () => {
    setForm(blankForm());
    setSheetOpen(true);
  };

  const abrirEdicao = async (f: FichaLubrificacao) => {
    setForm({
      ...blankForm(),
      ...f,
      horimetro_inicio: String(f.horimetro_inicio ?? ""),
      horimetro_fim: String(f.horimetro_fim ?? ""),
      checklist_lubrificacao: f.checklist_lubrificacao?.length ? f.checklist_lubrificacao : ITENS_LUBRIFICACAO_DEFAULT.map((i) => ({ ...i })),
      checklist_geral: f.checklist_geral?.length ? f.checklist_geral : ITENS_GERAL_DEFAULT.map((i) => ({ ...i })),
      reapertos: f.reapertos?.length ? f.reapertos : ITENS_REAPERTOS_DEFAULT.map((i) => ({ ...i })),
      fotos_antes: f.fotos_antes?.length ? f.fotos_antes : ["", ""],
      fotos_depois: f.fotos_depois?.length ? f.fotos_depois : ["", ""],
    } as any);
    setSheetOpen(true);
    if (isOnline) {
      const res = await obterImagensFichaLubrificacao(f.id);
      if (res?.data) setForm((prev) => (prev.id === f.id ? { ...prev, ...(res.data as any) } : prev));
    }
  };

  const toggleChecklist = (grupo: "checklist_lubrificacao" | "checklist_geral" | "reapertos", idx: number, status: string) => {
    setForm((prev) => {
      const arr = [...(prev as any)[grupo]];
      arr[idx] = { ...arr[idx], status };
      return { ...prev, [grupo]: arr };
    });
  };

  const handleSalvar = async () => {
    if (!form.placa) { toast.show("Selecione o equipamento.", "error"); return; }
    if (!form.mecanico_responsavel) { toast.show("Selecione o mecânico responsável.", "error"); return; }
    setSalvando(true);
    try {
      const id = form.id || (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const dataToSave: any = {
        ...form,
        id,
        horimetro_inicio: form.horimetro_inicio ? Number(form.horimetro_inicio) : null,
        horimetro_fim: form.horimetro_fim ? Number(form.horimetro_fim) : null,
        fotos_antes: (form.fotos_antes || []).filter(Boolean),
        fotos_depois: (form.fotos_depois || []).filter(Boolean),
        status: "CONCLUÍDO",
      };

      if (isOnline) {
        const res = form.id
          ? await atualizarFichaLubrificacao(id, dataToSave)
          : await registrarFichaLubrificacao(dataToSave);
        if ("error" in res) { toast.show("Erro ao salvar: " + res.error, "error"); setSalvando(false); return; }
        const saved = (res as any).data || dataToSave;
        await localDb.put("fichas_lubrificacao", saved);
        window.dispatchEvent(new CustomEvent("offline-db-updated-fichas_lubrificacao"));
        toast.show("Ficha de lubrificação registrada!", "success");
      } else {
        await localDb.put("fichas_lubrificacao", { ...dataToSave, _isPendingSync: true });
        await localDb.addToQueue("ficha_lubrificacao", form.id ? "update" : "create", dataToSave);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-fichas_lubrificacao"));
        toast.show("Salvo offline — sincroniza quando voltar a conexão.", "success");
      }
      setSheetOpen(false);
      localStorage.removeItem("eunaman_lubrificacao_active_field");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (f: FichaLubrificacao) => {
    if (isOnline) {
      await excluirFichaLubrificacao(f.id);
      await localDb.delete("fichas_lubrificacao", f.id);
    } else {
      await localDb.delete("fichas_lubrificacao", f.id);
      await localDb.addToQueue("ficha_lubrificacao", "delete", { id: f.id });
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    window.dispatchEvent(new CustomEvent("offline-db-updated-fichas_lubrificacao"));
    toast.show("Ficha excluída.", "success");
  };

  const onSelecionarPlaca = (placa: string) => {
    const eq = equipamentos.find((e) => e.placa === placa);
    setForm((p) => ({ ...p, placa, equipamento_id: eq?.id || "", modulo: eq?.modulo || p.modulo }));
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const actionSheetItems: ActionSheetItem[] = actionItem
    ? [
        { key: "ver", label: "Ver Detalhes", icon: Eye, onSelect: () => setPreviewItem(actionItem) },
        { key: "editar", label: "Editar", icon: Pencil, onSelect: () => abrirEdicao(actionItem) },
        { key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(actionItem) },
      ]
    : [];

  return (
    <div className="min-h-full">
      {view === "menu" && (
        <div className="p-4 space-y-2.5">
          <ListRow icon={<Droplets size={18} />} title="Registrar Ficha" subtitle="Lançar lubrificação agora" onClick={abrirNovo} />
          <ListRow
            icon={<FileText size={18} />}
            title={`Histórico (${fichas.length})`}
            subtitle="Ver, editar ou excluir fichas"
            onClick={() => setView("historico")}
          />
        </div>
      )}

      {view === "historico" && (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
            <button
              onClick={() => setView("menu")}
              aria-label="Voltar ao menu de Lubrificação"
              className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="flex-1 text-sm font-black text-zinc-50">Histórico de Lubrificação</h2>
          </div>

          <div className="p-4 space-y-3 pb-24">
            <div className="flex items-center gap-2 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
              <Search size={16} className="text-zinc-500" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar placa..."
                className="flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </div>

            {listaFiltrada.length === 0 ? (
              <EmptyState icon={Droplets} title="Nenhuma ficha encontrada" />
            ) : (
              <div className="space-y-2">
                {listaFiltrada.map((f) => (
                  <ListRow
                    key={f.id}
                    title={f.placa}
                    subtitle={`${(f.data_registro || "").slice(0, 10).split("-").reverse().join("/")} · ${f.mecanico_responsavel || "-"}`}
                    onClick={() => setActionItem(f)}
                    rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {view === "menu" && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Registrar" />}

      {/* ─── FORMULÁRIO DE LANÇAMENTO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={form.id ? "Editar Ficha" : "Registrar Lubrificação"} fullHeight>
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelCls}>Equipamento (Placa) *</label>
            <SearchableSelect value={form.placa} onChange={onSelecionarPlaca} options={placasOptions} placeholder="Selecione o equipamento..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data</label>
              <input type="date" value={form.data_registro.slice(0, 10)} onChange={(e) => setForm((p) => ({ ...p, data_registro: e.target.value }))} className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Início</label>
                <input type="time" value={form.hora_inicio} onChange={(e) => setForm((p) => ({ ...p, hora_inicio: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fim</label>
                <input type="time" value={form.hora_fim} onChange={(e) => setForm((p) => ({ ...p, hora_fim: e.target.value }))} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Horímetro Início</label>
              <input inputMode="numeric" value={form.horimetro_inicio} onChange={(e) => setForm((p) => ({ ...p, horimetro_inicio: e.target.value.replace(/\D/g, "") }))} placeholder="Ex: 4500" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Horímetro Fim</label>
              <input inputMode="numeric" value={form.horimetro_fim} onChange={(e) => setForm((p) => ({ ...p, horimetro_fim: e.target.value.replace(/\D/g, "") }))} placeholder="Ex: 4502" className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Mecânico Responsável *</label>
            <SearchableSelect value={form.mecanico_responsavel} onChange={(v) => setForm((p) => ({ ...p, mecanico_responsavel: v }))} options={colaboradoresOptions} placeholder="Selecione o mecânico..." />
          </div>

          <div>
            <label className={labelCls}>Ajudante (opcional)</label>
            <SearchableSelect value={form.ajudante} onChange={(v) => setForm((p) => ({ ...p, ajudante: v }))} options={colaboradoresOptions} placeholder="Selecione o ajudante..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Local do Serviço</label>
              <input value={form.local_servico} onChange={(e) => setForm((p) => ({ ...p, local_servico: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Módulo</label>
              <input value={form.modulo} onChange={(e) => setForm((p) => ({ ...p, modulo: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <ChecklistSection title="Checklist de Lubrificação" items={form.checklist_lubrificacao} opcoes={["Executado", "Não Executado"]} onToggle={(idx, s) => toggleChecklist("checklist_lubrificacao", idx, s)} />
          <ChecklistSection title="Checklist Geral" items={form.checklist_geral} opcoes={["SIM", "NÃO"]} onToggle={(idx, s) => toggleChecklist("checklist_geral", idx, s)} />
          <ChecklistSection title="Reapertos" items={form.reapertos} opcoes={["Executado", "Não Executado"]} onToggle={(idx, s) => toggleChecklist("reapertos", idx, s)} />

          <div>
            <label className={labelCls}>Observações</label>
            <textarea value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} rows={3} className={inputCls} placeholder="Detalhe extra (opcional)" />
          </div>

          <div>
            <label className={labelCls}>Fotos — Antes</label>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((idx) => (
                <FotoSlot key={idx} label={`Antes ${idx + 1}`} url={form.fotos_antes[idx]} onCapture={() => handleCapture("fotos_antes", idx)} onClear={() => setForm((p) => { const arr = [...p.fotos_antes]; arr[idx] = ""; return { ...p, fotos_antes: arr }; })} />
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Fotos — Depois</label>
            <div className="grid grid-cols-2 gap-2">
              {[0, 1].map((idx) => (
                <FotoSlot key={idx} label={`Depois ${idx + 1}`} url={form.fotos_depois[idx]} onCapture={() => handleCapture("fotos_depois", idx)} onClear={() => setForm((p) => { const arr = [...p.fotos_depois]; arr[idx] = ""; return { ...p, fotos_depois: arr }; })} />
              ))}
            </div>
          </div>

          <SignaturePad label="Assinatura do Mecânico" value={form.assinatura_mecanico} onChange={(dataUrl) => setForm((p) => ({ ...p, assinatura_mecanico: dataUrl }))} />
          <SignaturePad label="Assinatura do Líder (opcional)" value={form.assinatura_lider || ""} onChange={(dataUrl) => setForm((p) => ({ ...p, assinatura_lider: dataUrl }))} />

          <button onClick={handleSalvar} disabled={salvando} className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60">
            {salvando ? "Salvando..." : "Salvar Ficha"}
          </button>
        </div>
      </BottomSheet>

      {/* ─── PREVIEW SIMPLES DO DETALHE ─── */}
      <BottomSheet open={!!previewItem} onClose={() => setPreviewItem(null)} title={previewItem ? `Lubrificação · ${previewItem.placa}` : undefined}>
        {previewItem && (
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon={Droplets} label="Mecânico" value={previewItem.mecanico_responsavel || "-"} accent="zinc" />
              <StatTile icon={FileText} label="Local" value={previewItem.local_servico || "-"} accent="zinc" />
            </div>
            {previewItem.observacoes && (
              <div>
                <p className={labelCls}>Observações</p>
                <p className="text-sm text-zinc-300">{previewItem.observacoes}</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ActionSheet open={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? `Ficha · ${actionItem.placa}` : undefined} items={actionSheetItems} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir ficha"
        description="Deseja realmente excluir esta ficha de lubrificação?"
        destructive
      />
    </div>
  );
}

function ChecklistSection({
  title,
  items,
  opcoes,
  onToggle,
}: {
  title: string;
  items: ChecklistItem[];
  opcoes: [string, string];
  onToggle: (idx: number, status: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-400 mb-1.5">{title}</label>
      <div className="space-y-1.5">
        {items.map((it, idx) => (
          <div key={it.item} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
            <span className="text-xs font-semibold text-zinc-300 flex-1">{it.item}</span>
            <div className="flex gap-1 shrink-0">
              {opcoes.map((op) => (
                <button
                  key={op}
                  onClick={() => onToggle(idx, op)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                    it.status === op ? (op === "Executado" || op === "SIM" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Slot de foto simples — reaproveita o mesmo padrão de field-app/src/modules/lavagens/LavagensClient.tsx.
function FotoSlot({ label, url, onCapture, onClear }: { label: string; url?: string; onCapture: () => void; onClear: () => void }) {
  return (
    <button onClick={url ? onClear : onCapture} className="aspect-video rounded-xl border border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 overflow-hidden relative">
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

// Assinatura por toque/mouse num canvas — mesmo componente usado em Lavagens, com label
// parametrizável pra reaproveitar duas vezes (mecânico + líder).
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

  // Redesenha a assinatura já salva ao montar/trocar `value` (e limpa quando apagada por
  // fora) — sem isso, reabrir uma seção que tinha recolhido (desmonta/remonta o componente)
  // sempre mostrava o canvas em branco mesmo com a assinatura intacta no estado.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    if (!value) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      return;
    }
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = true;
    };
    img.src = value;
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
          className="w-full h-[140px] touch-none cursor-crosshair"
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
