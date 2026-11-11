"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Droplets,
  FileText,
  BarChart2,
  Plus,
  Camera,
  Trash2,
  Pencil,
  Eye,
  Check,
  Truck,
  Car,
  Search,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { useAuth } from "@/components/auth-context";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { useNativeCamera } from "../../lib/nativeCamera";
import { ListRow, Card } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { StatTile } from "../../ui/primitives/StatTile";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import { saveLavagem, deleteLavagem, getLavagemImagens, Lavagem } from "./actions";
import { getCurrentLocalDate } from "@/src/utils/dateUtils";

// Checklist do que foi lavado — igual ao app principal (app/lavagens/LavagensClient.tsx),
// diferente pra caminhão (frota pesada) e carro (frota leve).
const ITENS_LAVAGEM_PESADO = [
  "Cabine (Externa)",
  "Cabine (Interna)",
  "Carroceria / Caçamba",
  "Chassi / Parte de Baixo",
  "Rodas e Pneus",
  "Motor",
  "Para-brisa e Vidros",
  "Tanque de Combustível",
];

const ITENS_LAVAGEM_LEVE = ["Lavagem Externa", "Lavagem Interna", "Rodas e Pneus", "Vidros e Retrovisores"];

const STATUS_BADGE: Record<string, string> = {
  Lavado: "bg-emerald-500/15 text-emerald-400",
  Pendente: "bg-amber-500/15 text-amber-400",
  "Não realizado": "bg-red-500/15 text-red-400",
};

function hoje() {
  return getCurrentLocalDate();
}

const BLANK_FORM = {
  id: "",
  placa: "",
  data: hoje(),
  tipo_frota: "" as "" | "pesado" | "leve",
  horimetro: "",
  km: "",
  lavagem_realizada: true,
  observacoes: "",
  itens_lavados: [] as string[],
  imagem_1_url: "",
  imagem_2_url: "",
  imagem_3_url: "",
  imagem_horimetro_url: "",
  assinatura_url: "",
};

type View = "menu" | "historico" | "painel";

export default function LavagensClient({
  equipamentos,
  lavagensIniciais,
}: {
  equipamentos: any[];
  lavagensIniciais: Lavagem[];
}) {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const toast = useToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [view, setView] = useState<View>("menu");
  const [lavagens, setLavagens] = useState<Lavagem[]>(lavagensIniciais);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"Todos" | "Lavado" | "Pendente" | "Não realizado">("Todos");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<typeof BLANK_FORM>(BLANK_FORM);
  const [salvando, setSalvando] = useState(false);

  const [actionItem, setActionItem] = useState<Lavagem | null>(null);
  const [previewItem, setPreviewItem] = useState<Lavagem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Lavagem | null>(null);

  useEffect(() => setLavagens(lavagensIniciais), [lavagensIniciais]);

  const isPesado = (eq: any) => {
    const cat = String(eq?.categoria || "PESADA").toUpperCase().trim();
    return cat === "PESADA" || cat === "FROTA PESADA" || cat.includes("PESADA");
  };
  const isLeve = (eq: any) => {
    const cat = String(eq?.categoria || "").toUpperCase().trim();
    return cat === "LEVE" || cat === "FROTA LEVE" || cat.includes("LEVE");
  };

  const placasOptions = useMemo(() => {
    const filtradas = equipamentos.filter((eq) => (form.tipo_frota === "leve" ? isLeve(eq) : isPesado(eq)));
    return filtradas.map((eq) => ({ value: eq.placa, label: eq.placa }));
  }, [equipamentos, form.tipo_frota]);

  const listaFiltrada = useMemo(() => {
    return [...lavagens]
      .filter((l) => {
        const matchBusca = !busca || l.placa.toLowerCase().includes(busca.toLowerCase());
        const matchStatus = filtroStatus === "Todos" || l.status === filtroStatus;
        return matchBusca && matchStatus;
      })
      .sort((a, b) => {
        if (a.data !== b.data) return b.data.localeCompare(a.data);
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [lavagens, busca, filtroStatus]);

  // Resumo do mês atual — versão simplificada do "Painel" do app principal (que calcula
  // meta semanal por veículo, um relatório de PCM). Aqui é só contagem de status do mês,
  // separado por frota, suficiente pro uso de campo.
  const resumoMes = useMemo(() => {
    const mesAtual = hoje().slice(0, 7);
    const doMes = lavagens.filter((l) => (l.data || "").startsWith(mesAtual));
    const porFrota = (pred: (eq: any) => boolean) => {
      const placasDoTipo = new Set(equipamentos.filter(pred).map((e) => e.placa));
      const itens = doMes.filter((l) => placasDoTipo.has(l.placa));
      return {
        lavado: itens.filter((l) => l.status === "Lavado").length,
        pendente: itens.filter((l) => l.status === "Pendente").length,
        naoRealizado: itens.filter((l) => l.status === "Não realizado").length,
      };
    };
    return { pesados: porFrota(isPesado), leves: porFrota(isLeve) };
  }, [lavagens, equipamentos]);

  // ── Ponte nativa da câmera (EunamanCamera) — serviço único em lib/nativeCamera.ts ──
  const { openCamera: abrirCameraNativa } = useNativeCamera("eunaman_lavagens_active_field", (activeField, compressed) => {
    setForm((prev) => ({ ...prev, [activeField]: compressed }));
  });

  // ── Rascunho do formulário (sobrevive ao reload que o Android dá na Activity
  // enquanto o app de Câmera nativo está em primeiro plano, pra liberar memória) —
  // mesmo padrão de CaptacaoClient.tsx/OSClient.tsx. form.id já distingue edição de
  // criação aqui, então não precisa de um editingId separado.
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (!mounted || !hasRestoredRef.current) return;
    try {
      if (sheetOpen) {
        localStorage.setItem("eunaman_lavagens_form_draft", JSON.stringify(form));
        localStorage.setItem("eunaman_lavagens_sheet_open", "true");
      } else {
        localStorage.removeItem("eunaman_lavagens_form_draft");
        localStorage.setItem("eunaman_lavagens_sheet_open", "false");
      }
    } catch (e) {
      console.error("Erro ao salvar rascunho de lavagem:", e);
    }
  }, [form, sheetOpen, mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const sheetWasOpen = localStorage.getItem("eunaman_lavagens_sheet_open");
      const draft = localStorage.getItem("eunaman_lavagens_form_draft");
      if (sheetWasOpen === "true" && draft) {
        const parsed = JSON.parse(draft);
        if (parsed && typeof parsed === "object") {
          setForm(parsed);
          setSheetOpen(true);
        }
      }
    } catch (e) {
      console.error("Erro ao restaurar rascunho de lavagem:", e);
    } finally {
      hasRestoredRef.current = true;
    }
  }, [mounted]);

  const abrirNovo = () => {
    setForm({ ...BLANK_FORM, data: hoje() });
    setSheetOpen(true);
  };

  const abrirEdicao = async (l: Lavagem) => {
    setForm({
      ...BLANK_FORM,
      ...l,
      horimetro: String(l.horimetro || ""),
      km: String(l.km || ""),
      itens_lavados: l.itens_lavados || [],
      tipo_frota: l.tipo_frota || "pesado",
    } as any);
    setSheetOpen(true);
    // Fotos/assinatura não vêm na sincronização em massa — busca sob demanda ao editar.
    if (isOnline) {
      const res = await getLavagemImagens(l.id);
      if (res?.data) setForm((prev) => (prev.id === l.id ? { ...prev, ...res.data } : prev));
    }
  };

  const toggleItem = (item: string) => {
    setForm((prev) => {
      const atual = prev.itens_lavados || [];
      return { ...prev, itens_lavados: atual.includes(item) ? atual.filter((i) => i !== item) : [...atual, item] };
    });
  };

  const handleCapture = (field: string) => {
    abrirCameraNativa(field, () => toast.show("Câmera nativa disponível apenas no aplicativo instalado.", "info"));
  };

  const handleSalvar = async () => {
    if (!form.placa) { toast.show("Selecione a placa.", "error"); return; }
    if (!form.tipo_frota) { toast.show("Selecione o tipo de frota.", "error"); return; }
    setSalvando(true);
    try {
      const id = form.id || (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const horimetro = Number(form.horimetro) || 0;
      const km = Number(form.km) || 0;
      const status: Lavagem["status"] = !form.lavagem_realizada
        ? "Não realizado"
        : !km || (form.tipo_frota !== "leve" && !horimetro)
        ? "Pendente"
        : "Lavado";
      const dataToSave = { ...form, id, horimetro, km, status };
      const nomeLocal = (profile as any)?.full_name || null;

      if (isOnline) {
        const res = await saveLavagem(dataToSave);
        if (!res.success) { toast.show("Erro ao salvar: " + res.error, "error"); setSalvando(false); return; }
        const saved = (res as any).data || { ...dataToSave, colaborador: nomeLocal };
        await localDb.put("lavagens", saved);
        window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"));
        toast.show("Lavagem registrada!", "success");
      } else {
        const localData = { ...dataToSave, colaborador: nomeLocal, registrado_por_nome: nomeLocal, _isPendingSync: true };
        await localDb.put("lavagens", localData);
        await localDb.addToQueue("lavagem", form.id ? "update" : "create", { ...dataToSave, itens_lavados: JSON.stringify(dataToSave.itens_lavados || []) });
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"));
        toast.show("Salvo offline — sincroniza quando voltar a conexão.", "success");
      }
      setSheetOpen(false);
      localStorage.removeItem("eunaman_lavagens_active_field");
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (l: Lavagem) => {
    if (isOnline) {
      await deleteLavagem(l.id);
      await localDb.delete("lavagens", l.id);
    } else {
      await localDb.delete("lavagens", l.id);
      await localDb.addToQueue("lavagem", "delete", { id: l.id });
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    window.dispatchEvent(new CustomEvent("offline-db-updated-lavagens"));
    toast.show("Lavagem excluída.", "success");
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const subTelaTitulo = view === "historico" ? "Histórico de Lavagens" : view === "painel" ? "Painel do Mês" : "";

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
          <ListRow
            icon={<Droplets size={18} />}
            title="Registrar Lavagem"
            subtitle="Lançar uma lavagem agora"
            onClick={abrirNovo}
          />
          <ListRow
            icon={<FileText size={18} />}
            title={`Histórico (${lavagens.length})`}
            subtitle="Ver, editar ou excluir lançamentos"
            onClick={() => setView("historico")}
          />
          <ListRow
            icon={<BarChart2 size={18} />}
            title="Painel"
            subtitle="Resumo do mês por frota"
            onClick={() => setView("painel")}
          />
        </div>
      )}

      {view !== "menu" && (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
            <button
              onClick={() => setView("menu")}
              aria-label="Voltar ao menu de Lavagens"
              className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="flex-1 text-sm font-black text-zinc-50">{subTelaTitulo}</h2>
          </div>

          <div className="p-4 space-y-3 pb-24">
            {view === "historico" && (
              <>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900">
                    <Search size={16} className="text-zinc-500" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar placa..."
                      className="flex-1 bg-transparent text-sm font-semibold text-zinc-100 outline-none placeholder:text-zinc-600"
                    />
                  </div>
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {(["Todos", "Lavado", "Pendente", "Não realizado"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setFiltroStatus(s)}
                      className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${
                        filtroStatus === s ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {listaFiltrada.length === 0 ? (
                  <EmptyState icon={Droplets} title="Nenhuma lavagem encontrada" />
                ) : (
                  <div className="space-y-2">
                    {listaFiltrada.map((l) => (
                      <ListRow
                        key={l.id}
                        title={l.placa}
                        subtitle={`${l.data?.split("-").reverse().join("/")} · ${(l.itens_lavados || []).length} itens`}
                        badge={
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_BADGE[l.status] || "bg-zinc-800 text-zinc-400"}`}>
                            {l.status}
                          </span>
                        }
                        onClick={() => setActionItem(l)}
                        rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {view === "painel" && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5">
                  <Truck size={12} /> Frota Pesada — mês atual
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <StatTile icon={Check} label="Lavado" value={resumoMes.pesados.lavado} accent="emerald" />
                  <StatTile icon={Droplets} label="Pendente" value={resumoMes.pesados.pendente} accent="amber" />
                  <StatTile icon={Trash2} label="Não feito" value={resumoMes.pesados.naoRealizado} accent="red" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500 flex items-center gap-1.5 pt-2">
                  <Car size={12} /> Frota Leve — mês atual
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  <StatTile icon={Check} label="Lavado" value={resumoMes.leves.lavado} accent="emerald" />
                  <StatTile icon={Droplets} label="Pendente" value={resumoMes.leves.pendente} accent="amber" />
                  <StatTile icon={Trash2} label="Não feito" value={resumoMes.leves.naoRealizado} accent="red" />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {view === "menu" && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Registrar" />}

      {/* ─── FORMULÁRIO DE LANÇAMENTO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={form.id ? "Editar Lavagem" : "Registrar Lavagem"} fullHeight>
        {!form.tipo_frota ? (
          <div className="space-y-3 pb-4">
            <p className="text-xs text-zinc-400">Qual tipo de equipamento foi lavado?</p>
            <button
              onClick={() => setForm((p) => ({ ...p, tipo_frota: "pesado" }))}
              className="w-full flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl active:border-amber-600/50"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Truck size={20} /></div>
              <span className="font-bold text-sm text-zinc-50">Caminhão (Frota Pesada)</span>
            </button>
            <button
              onClick={() => setForm((p) => ({ ...p, tipo_frota: "leve" }))}
              className="w-full flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl active:border-amber-600/50"
              style={{ minHeight: "var(--tap-min)" }}
            >
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Car size={20} /></div>
              <span className="font-bold text-sm text-zinc-50">Carro (Frota Leve)</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            <div>
              <label className={labelCls}>Placa *</label>
              <SearchableSelect value={form.placa} onChange={(v) => setForm((p) => ({ ...p, placa: v }))} options={placasOptions} placeholder="Selecione a placa..." />
            </div>

            <div>
              <label className={labelCls}>Data</label>
              <input type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>KM *</label>
                <input
                  inputMode="numeric"
                  value={form.km}
                  onChange={(e) => setForm((p) => ({ ...p, km: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Ex: 125000"
                  className={inputCls}
                />
              </div>
              {form.tipo_frota === "pesado" && (
                <div>
                  <label className={labelCls}>Horímetro *</label>
                  <input
                    inputMode="numeric"
                    value={form.horimetro}
                    onChange={(e) => setForm((p) => ({ ...p, horimetro: e.target.value.replace(/\D/g, "") }))}
                    placeholder="Ex: 4500"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            <div>
              <label className={labelCls}>Lavagem realizada?</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setForm((p) => ({ ...p, lavagem_realizada: true }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${form.lavagem_realizada ? "bg-emerald-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}
                >
                  Sim
                </button>
                <button
                  onClick={() => setForm((p) => ({ ...p, lavagem_realizada: false }))}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold ${!form.lavagem_realizada ? "bg-red-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"}`}
                >
                  Não
                </button>
              </div>
            </div>

            <div>
              <label className={labelCls}>Itens lavados</label>
              <div className="flex flex-wrap gap-1.5">
                {(form.tipo_frota === "leve" ? ITENS_LAVAGEM_LEVE : ITENS_LAVAGEM_PESADO).map((item) => {
                  const marcado = (form.itens_lavados || []).includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleItem(item)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                        marcado ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                      }`}
                    >
                      {marcado && <Check size={12} />}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Observações</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
                rows={3}
                className={inputCls}
                placeholder="Detalhe extra (opcional)"
              />
            </div>

            <div>
              <label className={labelCls}>Fotos</label>
              <div className="grid grid-cols-4 gap-2">
                <FotoSlot label="Horímetro" url={form.imagem_horimetro_url} onCapture={() => handleCapture("imagem_horimetro_url")} onClear={() => setForm((p) => ({ ...p, imagem_horimetro_url: "" }))} />
                <FotoSlot label="Foto 1" url={form.imagem_1_url} onCapture={() => handleCapture("imagem_1_url")} onClear={() => setForm((p) => ({ ...p, imagem_1_url: "" }))} />
                <FotoSlot label="Foto 2" url={form.imagem_2_url} onCapture={() => handleCapture("imagem_2_url")} onClear={() => setForm((p) => ({ ...p, imagem_2_url: "" }))} />
                <FotoSlot label="Foto 3" url={form.imagem_3_url} onCapture={() => handleCapture("imagem_3_url")} onClear={() => setForm((p) => ({ ...p, imagem_3_url: "" }))} />
              </div>
            </div>

            <SignaturePad value={form.assinatura_url} onChange={(dataUrl) => setForm((p) => ({ ...p, assinatura_url: dataUrl }))} />

            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar Lavagem"}
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ─── PREVIEW SIMPLES DO DETALHE ─── */}
      <BottomSheet open={!!previewItem} onClose={() => setPreviewItem(null)} title={previewItem ? `Lavagem · ${previewItem.placa}` : undefined}>
        {previewItem && (
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon={Droplets} label="Status" value={previewItem.status} accent={previewItem.status === "Lavado" ? "emerald" : previewItem.status === "Pendente" ? "amber" : "red"} />
              <StatTile icon={Truck} label="KM" value={previewItem.km || "-"} accent="zinc" />
            </div>
            {(previewItem.itens_lavados || []).length > 0 && (
              <div>
                <p className={labelCls}>Itens lavados</p>
                <div className="flex flex-wrap gap-1.5">
                  {(previewItem.itens_lavados || []).map((item) => (
                    <span key={item} className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-300">{item}</span>
                  ))}
                </div>
              </div>
            )}
            {previewItem.observacoes && (
              <div>
                <p className={labelCls}>Observações</p>
                <p className="text-sm text-zinc-300">{previewItem.observacoes}</p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ActionSheet open={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? `Lavagem · ${actionItem.placa}` : undefined} items={actionSheetItems} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir lavagem"
        description="Deseja realmente excluir este lançamento?"
        destructive
      />
    </div>
  );
}

// Slot de foto simples — toque abre a câmera nativa (EunamanCamera); fallback de input
// de arquivo só existe no SearchableSelect/outros módulos quando fora do APK, mas a
// captura de foto é um recurso exclusivo do app instalado (igual ao app principal).
function FotoSlot({ label, url, onCapture, onClear }: { label: string; url?: string; onCapture: () => void; onClear: () => void }) {
  return (
    <button
      onClick={url ? onClear : onCapture}
      className="aspect-square rounded-xl border border-dashed border-zinc-700 bg-zinc-900 flex flex-col items-center justify-center gap-1 overflow-hidden relative"
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

// Assinatura por toque/mouse num canvas — mesmo componente do app principal
// (app/lavagens/LavagensClient.tsx), sem biblioteca externa.
function SignaturePad({ value, onChange }: { value: string; onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

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
        <label className="text-xs font-bold text-zinc-400">Assinatura (opcional)</label>
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
