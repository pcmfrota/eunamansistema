"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, ChevronRight, Plus, Trash2, Eye, Search } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ListRow } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { SegmentedTabs } from "../../ui/primitives/SegmentedTabs";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import {
  getComboioConfig,
  getPipaConfig,
  getMultifuncionalConfig,
  getMunckConfig,
  ChecklistGroup,
  ChecklistItem,
} from "@/app/checklist-mecanicos/checklistConfig";
import { salvarChecklistMecanico, excluirChecklistMecanico } from "./actions";

const TIPOS = ["Comboio", "Pipa", "Multifuncional", "Munck"] as const;

function getConfigPorTipo(tipo: string): ChecklistGroup[] {
  switch (tipo) {
    case "Comboio": return getComboioConfig();
    case "Pipa": return getPipaConfig();
    case "Multifuncional": return getMultifuncionalConfig();
    case "Munck": return getMunckConfig();
    default: return [];
  }
}

const CNC_OPTIONS = [
  { key: "C", activeClass: "bg-emerald-600 text-white" },
  { key: "NC", activeClass: "bg-red-600 text-white" },
  { key: "NA", activeClass: "bg-zinc-600 text-white" },
];
const PNEU_OPTIONS = [
  { key: "N", activeClass: "bg-emerald-600 text-white" },
  { key: "M", activeClass: "bg-amber-600 text-white" },
  { key: "F", activeClass: "bg-red-600 text-white" },
];

function AnswerButtons({
  value,
  onChange,
  options,
  disabled,
}: {
  value?: string;
  onChange: (v: string) => void;
  options: { key: string; activeClass: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.key}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.key)}
          className={`flex-1 py-2 rounded-lg text-[11px] font-black uppercase ${
            value === opt.key ? opt.activeClass : "bg-zinc-800 text-zinc-500"
          }`}
        >
          {opt.key}
        </button>
      ))}
    </div>
  );
}

function ObsInput({ value, onChange, disabled }: { value?: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      placeholder="Obs..."
      className="mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-60"
    />
  );
}

// Renderiza 1 item do checklist — mesma lógica/chaves de app/checklist-mecanicos/
// ChecklistClient.tsx (ver renderItem lá). Só o layout mudou pra primitivas nativas; as
// chaves gravadas em `respostas` são IDÊNTICAS de propósito (mesma tabela/coluna do site).
function ChecklistItemCard({
  item,
  respostas,
  onAnswer,
  disabled,
}: {
  item: ChecklistItem;
  respostas: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  if (item.type === "pneus") {
    const posicoes = ["DD", "DE", "TD1E", "TD1I", "TD2E", "TD2I", "TE1E", "TE1I", "TE2E", "TE2I"];
    return (
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2.5">
        <p className="text-xs font-black text-zinc-300">{item.label}</p>
        <div className="grid grid-cols-2 gap-2">
          {posicoes.map((pos) => (
            <div key={pos} className="p-2 bg-zinc-950 border border-zinc-800 rounded-xl">
              <p className="text-[10px] font-black text-zinc-400 mb-1.5 text-center">{pos}</p>
              <AnswerButtons
                value={respostas[`pneu_${pos}`]}
                onChange={(v) => onAnswer(`pneu_${pos}`, v)}
                options={PNEU_OPTIONS}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
        <ObsInput value={respostas[`${item.id}_obs`]} onChange={(v) => onAnswer(`${item.id}_obs`, v)} disabled={disabled} />
      </div>
    );
  }

  if (item.type === "barras" || item.type === "cinto" || item.type === "iluminacao") {
    const subs =
      item.type === "barras"
        ? ["Lateral Direita", "Lateral Esquerda", "Traseira"]
        : item.type === "cinto"
        ? ["Motorista", "Passageiro"]
        : ["Lado Direito Dianteiro", "Lado Esquerdo Dianteiro", "Lado Direito Traseiro", "Lado Esquerdo Traseiro"];
    const keyFor = (s: string) =>
      item.type === "barras"
        ? `barras_${s.replace(" ", "_").toLowerCase()}`
        : item.type === "cinto"
        ? `cinto_${s.toLowerCase()}`
        : `luz_${s.replace(/ /g, "_").toLowerCase()}`;
    return (
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2">
        <p className="text-xs font-black text-zinc-300">{item.label}</p>
        <div className="space-y-2">
          {subs.map((s) => {
            const key = keyFor(s);
            return (
              <div key={s} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400 flex-1">{s}</span>
                <div className="w-36 shrink-0">
                  <AnswerButtons value={respostas[key]} onChange={(v) => onAnswer(key, v)} options={CNC_OPTIONS} disabled={disabled} />
                </div>
              </div>
            );
          })}
        </div>
        <ObsInput value={respostas[`${item.id}_obs`]} onChange={(v) => onAnswer(`${item.id}_obs`, v)} disabled={disabled} />
      </div>
    );
  }

  if (item.type === "multi" && item.subItems) {
    return (
      <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2">
        <p className="text-xs font-black text-zinc-300">{item.label}</p>
        <div className="space-y-2">
          {item.subItems.map((sub) => {
            const key = `${item.id}_${sub.id}`;
            return (
              <div key={sub.id} className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-zinc-400 flex-1 uppercase">{sub.label}</span>
                <div className="w-36 shrink-0">
                  <AnswerButtons value={respostas[key]} onChange={(v) => onAnswer(key, v)} options={CNC_OPTIONS} disabled={disabled} />
                </div>
              </div>
            );
          })}
        </div>
        <ObsInput value={respostas[`${item.id}_obs`]} onChange={(v) => onAnswer(`${item.id}_obs`, v)} disabled={disabled} />
      </div>
    );
  }

  // standard
  return (
    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-2">
      <p className="text-xs font-bold text-zinc-300">{item.label}</p>
      <AnswerButtons value={respostas[item.id]} onChange={(v) => onAnswer(item.id, v)} options={CNC_OPTIONS} disabled={disabled} />
      <ObsInput value={respostas[`${item.id}_obs`]} onChange={(v) => onAnswer(`${item.id}_obs`, v)} disabled={disabled} />
    </div>
  );
}

function blankForm() {
  return { tipo: "", placa: "", co: "", local: "", respostas: {} as Record<string, string>, pendencias: "" };
}

export default function ChecklistMecanicosClient({
  equipamentos,
  checklistsIniciais,
}: {
  equipamentos: any[];
  checklistsIniciais: any[];
}) {
  const { isOnline } = useOffline();
  const { profile } = useAuth();
  const toast = useToast();

  const role = (profile?.role || "").toLowerCase().trim();
  const podeCriar = role === "mecanico" || role === "admin" || role === "administrador" || role === "gestao";
  const podeExcluir = role === "admin" || role === "administrador" || role === "gestao";

  const [checklists, setChecklists] = useState<any[]>(checklistsIniciais);
  const [busca, setBusca] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(blankForm());
  const [activeGroup, setActiveGroup] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  const [actionItem, setActionItem] = useState<any>(null);
  const [viewItem, setViewItem] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);

  useEffect(() => setChecklists(checklistsIniciais), [checklistsIniciais]);

  const placasOptions = useMemo(() => equipamentos.map((e) => ({ value: e.placa, label: e.placa })), [equipamentos]);

  const grupos = useMemo(() => getConfigPorTipo(form.tipo), [form.tipo]);
  // Mantém o prefixo numérico ("1.", "2."...) no label da aba — removê-lo gerava abas com
  // texto idêntico de verdade (grupos 1 e 2 de todo tipo de caminhão se chamam, ambos,
  // "EQUIPAMENTO INTERDITADO" no checklistConfig.ts original), impossível de distinguir.
  const tabs = useMemo(
    () => [...grupos.map((g) => ({ key: g.id, label: g.title })), { key: "pendencias", label: "Pendências" }],
    [grupos]
  );

  const listaFiltrada = useMemo(() => {
    return [...checklists]
      .filter((c) => !busca || (c.placa || "").toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => (b.criado_em || "").localeCompare(a.criado_em || ""));
  }, [checklists, busca]);

  const abrirNovo = () => {
    setForm(blankForm());
    setActiveGroup("");
    setSheetOpen(true);
  };

  const onSelecionarTipo = (tipo: string) => {
    setForm((p) => ({ ...p, tipo, respostas: {} }));
    const novosGrupos = getConfigPorTipo(tipo);
    setActiveGroup(novosGrupos[0]?.id || "pendencias");
  };

  const onSelecionarPlaca = (placa: string) => {
    const eq = equipamentos.find((e) => e.placa === placa);
    setForm((p) => ({ ...p, placa, co: eq?.categoria || eq?.co || "", local: eq?.local || eq?.area || "" }));
  };

  const onAnswer = (key: string, value: string) => {
    setForm((p) => ({ ...p, respostas: { ...p.respostas, [key]: value } }));
  };

  const handleSalvar = async () => {
    if (!form.tipo || !form.placa) {
      toast.show("Preencha o Tipo e a Placa.", "error");
      return;
    }
    setSalvando(true);
    try {
      const labelsMap: Record<string, string> = {};
      grupos.forEach((g) =>
        g.items.forEach((i) => {
          labelsMap[i.id] = i.label;
          i.subItems?.forEach((si) => {
            labelsMap[`${i.id}_${si.id}`] = `${i.label} - ${si.label}`;
          });
        })
      );

      const fd = new FormData();
      fd.append("tipo_caminhao", form.tipo);
      fd.append("placa", form.placa);
      fd.append("co", form.co);
      fd.append("local", form.local);
      fd.append("respostas", JSON.stringify(form.respostas));
      fd.append("pendencias_adicionais", form.pendencias);
      fd.append("questionsLabels", JSON.stringify(labelsMap));

      if (isOnline) {
        const res = await salvarChecklistMecanico(fd);
        if (res && "error" in res) {
          toast.show("Erro ao salvar: " + res.error, "error");
          setSalvando(false);
          return;
        }
        const saved = (res as any).data;
        await localDb.put("checklists_mecanicos", saved);
        setChecklists((prev) => [saved, ...prev]);
        toast.show("Checklist fechado! OS e Backlog gerados.", "success");
      } else {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const optimistic = {
          id: tempId,
          placa: form.placa,
          tipo_caminhao: form.tipo,
          local: form.local,
          co: form.co,
          data_checklist: new Date().toISOString().split("T")[0],
          status: "Fechado",
          respostas: form.respostas,
          pendencias_adicionais: form.pendencias,
          criado_em: new Date().toISOString(),
          _isPendingSync: true,
        };
        await localDb.put("checklists_mecanicos", optimistic);
        await localDb.addToQueue("checklists_mecanicos", "create", fd);
        setChecklists((prev) => [optimistic, ...prev]);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        toast.show("Salvo offline — OS e Backlog serão gerados quando sincronizar.", "success");
      }
      window.dispatchEvent(new CustomEvent("offline-db-updated-checklists_mecanicos"));
      setSheetOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (c: any) => {
    if (isOnline) {
      const res = await excluirChecklistMecanico(c.id);
      if (res && "error" in res) {
        toast.show("Erro ao excluir: " + res.error, "error");
        return;
      }
    } else {
      await localDb.addToQueue("checklists_mecanicos", "delete", c.id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    await localDb.delete("checklists_mecanicos", c.id);
    setChecklists((prev) => prev.filter((x) => x.id !== c.id));
    window.dispatchEvent(new CustomEvent("offline-db-updated-checklists_mecanicos"));
    toast.show("Checklist excluído.", "success");
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const actionSheetItems: ActionSheetItem[] = actionItem
    ? [
        { key: "ver", label: "Ver Detalhes", icon: Eye, onSelect: () => setViewItem(actionItem) },
        ...(podeExcluir
          ? [{ key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(actionItem) }]
          : []),
      ]
    : [];

  return (
    <div className="min-h-full p-4 space-y-3 pb-24">
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
        <EmptyState icon={ClipboardCheck} title="Nenhum checklist encontrado" description="Toque em Novo Checklist para começar uma inspeção." />
      ) : (
        <div className="space-y-2">
          {listaFiltrada.map((c) => (
            <ListRow
              key={c.id}
              icon={<ClipboardCheck size={18} />}
              title={`${c.tipo_caminhao} · ${c.placa}`}
              subtitle={`${(c.criado_em || "").slice(0, 10).split("-").reverse().join("/")} · ${c.status || "Fechado"}`}
              onClick={() => setActionItem(c)}
              rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
            />
          ))}
        </div>
      )}

      {podeCriar && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Novo Checklist" />}

      {/* ─── FORMULÁRIO DE INSPEÇÃO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Novo Checklist" fullHeight>
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelCls}>Tipo de Caminhão *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSelecionarTipo(t)}
                  className={`py-3 rounded-xl text-xs font-black uppercase ${
                    form.tipo === t ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>Placa *</label>
            <SearchableSelect value={form.placa} onChange={onSelecionarPlaca} options={placasOptions} placeholder="Selecione o equipamento..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>C.O. / Categoria</label>
              <input value={form.co} readOnly className={inputCls + " opacity-70"} />
            </div>
            <div>
              <label className={labelCls}>Local</label>
              <input value={form.local} readOnly className={inputCls + " opacity-70"} />
            </div>
          </div>

          {form.tipo && (
            <>
              <SegmentedTabs items={tabs} value={activeGroup} onChange={setActiveGroup} />

              {activeGroup === "pendencias" ? (
                <div>
                  <label className={labelCls}>Pendências Adicionais / Marcar Fotos</label>
                  <p className="text-[11px] text-zinc-500 mb-2">Cada linha gera um item no Backlog automático.</p>
                  <textarea
                    value={form.pendencias}
                    onChange={(e) => setForm((p) => ({ ...p, pendencias: e.target.value }))}
                    rows={5}
                    className={inputCls}
                    placeholder={"Ex: Parachoque arranhado lado esquerdo\nLogo da empresa rasgado"}
                  />
                </div>
              ) : (
                <div className="space-y-2.5">
                  {grupos
                    .find((g) => g.id === activeGroup)
                    ?.items.map((item) => (
                      <ChecklistItemCard key={item.id} item={item} respostas={form.respostas} onAnswer={onAnswer} />
                    ))}
                </div>
              )}
            </>
          )}

          <button
            onClick={handleSalvar}
            disabled={salvando || !form.tipo || !form.placa}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Salvar Inspeção e Gerar Backlog"}
          </button>
        </div>
      </BottomSheet>

      {/* ─── VISUALIZAÇÃO (SOMENTE LEITURA) ─── */}
      <BottomSheet open={!!viewItem} onClose={() => setViewItem(null)} title={viewItem ? `Checklist · ${viewItem.placa}` : undefined} fullHeight>
        {viewItem && (
          <div className="space-y-3 pb-4">
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Tipo</p>
                <p className="font-black text-zinc-100">{viewItem.tipo_caminhao}</p>
              </div>
              <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Data</p>
                <p className="font-black text-zinc-100">{(viewItem.criado_em || "").slice(0, 10).split("-").reverse().join("/")}</p>
              </div>
            </div>
            {getConfigPorTipo(viewItem.tipo_caminhao).map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-zinc-500 px-1">{g.title}</p>
                <div className="space-y-2">
                  {g.items.map((item) => (
                    <ChecklistItemCard key={item.id} item={item} respostas={viewItem.respostas || {}} onAnswer={() => {}} disabled />
                  ))}
                </div>
              </div>
            ))}
            {viewItem.pendencias_adicionais && (
              <div>
                <p className={labelCls}>Pendências Adicionais</p>
                <p className="text-xs text-zinc-300 whitespace-pre-wrap p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                  {viewItem.pendencias_adicionais}
                </p>
              </div>
            )}
          </div>
        )}
      </BottomSheet>

      <ActionSheet open={!!actionItem} onClose={() => setActionItem(null)} title={actionItem ? `Checklist · ${actionItem.placa}` : undefined} items={actionSheetItems} />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir checklist"
        description="As OS e Backlogs gerados por ele não serão excluídos automaticamente."
        destructive
      />
    </div>
  );
}
