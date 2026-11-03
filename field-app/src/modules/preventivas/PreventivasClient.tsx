"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  ListChecks,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { useOffline } from "@/components/offline-provider";
import { localDb, serializeFormData } from "@/lib/offline-db";
import { SearchableSelect } from "@/components/SearchableSelect";
import { ListRow } from "../../ui/primitives/ListRow";
import { BottomSheet } from "../../ui/primitives/BottomSheet";
import { ActionSheet, ActionSheetItem } from "../../ui/primitives/ActionSheet";
import { ConfirmDialog } from "../../ui/primitives/ConfirmDialog";
import { EmptyState } from "../../ui/primitives/EmptyState";
import { Fab } from "../../ui/primitives/Fab";
import { useToast } from "../../ui/primitives/Toast";
import { registrarHorimetro, atualizarPreventiva, excluirPreventiva } from "./actions";

type Equipamento = { id: string; placa: string; modelo?: string; tipo?: string; categoria?: string; modulo?: string };

type Preventiva = {
  id: string;
  equipamento_id: string;
  ultimo_horimetro: number;
  horimetro_atual: number;
  intervalo_horas: number;
  data_atualizacao: string | null;
  equipamentos?: { placa: string; modelo?: string; tipo?: string; categoria?: string; modulo?: string } | null;
  _isPendingSync?: boolean;
};

type Status = "ATRASADO" | "ATENÇÃO" | "NO PRAZO";

// Mesma regra do app principal (app/preventivas/ControleHorimetrosTabs.tsx) — não mude
// sem replicar lá também.
function getStatus(p: Preventiva): Status {
  const proxima = p.ultimo_horimetro + p.intervalo_horas;
  const falta = proxima - p.horimetro_atual;
  if (falta < 0) return "ATRASADO";
  if (falta <= Math.min(100, p.intervalo_horas * 0.15)) return "ATENÇÃO";
  return "NO PRAZO";
}

const STATUS_BADGE: Record<Status, string> = {
  ATRASADO: "bg-red-500/15 text-red-400",
  ATENÇÃO: "bg-amber-500/15 text-amber-400",
  "NO PRAZO": "bg-emerald-500/15 text-emerald-400",
};
const STATUS_ICON: Record<Status, React.ElementType> = {
  ATRASADO: AlertTriangle,
  ATENÇÃO: Clock,
  "NO PRAZO": CheckCircle2,
};

function isZocar(p: Preventiva) {
  const tipo = String(p.equipamentos?.tipo || "").toUpperCase();
  const mod = String(p.equipamentos?.modulo || "").toUpperCase();
  return tipo.includes("ZOCAR") || mod.includes("ZOCAR") || (p.intervalo_horas <= 100 && p.intervalo_horas > 0);
}
function isPesado(p: Preventiva) {
  if (isZocar(p)) return false;
  return String(p.equipamentos?.categoria || "").toUpperCase().includes("PESAD");
}
function isLeve(p: Preventiva) {
  if (isZocar(p)) return false;
  return String(p.equipamentos?.categoria || "").toUpperCase().includes("LEVE");
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

const BLANK_FORM = {
  equipamento_id: "",
  data_referencia: hoje(),
  horimetro_inicial: "",
  horimetro_final: "",
  observacoes: "",
};

const BLANK_EDIT = { ultimo_horimetro: "", horimetro_atual: "", intervalo_horas: "" };

type View = "menu" | "lista";

export default function PreventivasClient({
  equipamentos,
  preventivasIniciais,
}: {
  equipamentos: Equipamento[];
  preventivasIniciais: Preventiva[];
}) {
  const { isOnline } = useOffline();
  const toast = useToast();

  const [view, setView] = useState<View>("menu");
  const [preventivas, setPreventivas] = useState<Preventiva[]>(preventivasIniciais);
  const [busca, setBusca] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<"Todos" | "Pesados" | "Leves" | "Zocar">("Todos");
  const [statusFiltro, setStatusFiltro] = useState<"Todos" | Status>("Todos");

  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [salvando, setSalvando] = useState(false);

  const [editItem, setEditItem] = useState<Preventiva | null>(null);
  const [editForm, setEditForm] = useState(BLANK_EDIT);
  const [salvandoEdit, setSalvandoEdit] = useState(false);

  const [actionItem, setActionItem] = useState<Preventiva | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Preventiva | null>(null);

  React.useEffect(() => setPreventivas(preventivasIniciais), [preventivasIniciais]);

  const equipamentosOptions = useMemo(
    () => [...equipamentos].sort((a, b) => a.placa.localeCompare(b.placa)).map((eq) => ({ value: eq.id, label: `${eq.placa}${eq.modelo ? " - " + eq.modelo : ""}` })),
    [equipamentos]
  );

  const listaFiltrada = useMemo(() => {
    return [...preventivas]
      .filter((p) => {
        const matchBusca = !busca || (p.equipamentos?.placa || "").toLowerCase().includes(busca.toLowerCase());
        const matchCategoria =
          categoriaFiltro === "Todos" ||
          (categoriaFiltro === "Pesados" && isPesado(p)) ||
          (categoriaFiltro === "Leves" && isLeve(p)) ||
          (categoriaFiltro === "Zocar" && isZocar(p));
        const matchStatus = statusFiltro === "Todos" || getStatus(p) === statusFiltro;
        return matchBusca && matchCategoria && matchStatus;
      })
      .sort((a, b) => {
        const fa = a.ultimo_horimetro + a.intervalo_horas - a.horimetro_atual;
        const fb = b.ultimo_horimetro + b.intervalo_horas - b.horimetro_atual;
        return fa - fb; // mais atrasado primeiro
      });
  }, [preventivas, busca, categoriaFiltro, statusFiltro]);

  const abrirNovo = () => {
    setForm({ ...BLANK_FORM, data_referencia: hoje() });
    setSheetOpen(true);
  };

  const onSelectEquipamento = (id: string) => {
    const atual = preventivas.find((p) => p.equipamento_id === id);
    setForm((prev) => ({
      ...prev,
      equipamento_id: id,
      horimetro_inicial: atual ? String(atual.horimetro_atual) : prev.horimetro_inicial,
    }));
  };

  const handleSalvarApontamento = async () => {
    if (!form.equipamento_id) {
      toast.show("Selecione o equipamento.", "error");
      return;
    }
    const inicial = parseFloat(form.horimetro_inicial);
    const final = parseFloat(form.horimetro_final);
    if (isNaN(inicial) || isNaN(final)) {
      toast.show("Informe os valores inicial e final.", "error");
      return;
    }
    const atual = preventivas.find((p) => p.equipamento_id === form.equipamento_id);
    if (atual?.horimetro_atual != null && final < atual.horimetro_atual) {
      toast.show(`O valor não pode ser menor que o último registrado (${atual.horimetro_atual}).`, "error");
      return;
    }
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append("equipamento_id", form.equipamento_id);
      fd.append("data_referencia", form.data_referencia);
      fd.append("horimetro_inicial", form.horimetro_inicial);
      fd.append("horimetro_final", form.horimetro_final);
      fd.append("observacoes", form.observacoes);

      if (isOnline) {
        const res = await registrarHorimetro(fd);
        if (res && "error" in res) {
          toast.show("Erro: " + res.error, "error");
          setSalvando(false);
          return;
        }
      } else {
        await localDb.addToQueue("horimetro", "register", serializeFormData(fd));
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      }

      const eq = equipamentos.find((e) => e.id === form.equipamento_id);
      const atualizada: Preventiva = atual
        ? { ...atual, horimetro_atual: final, data_atualizacao: form.data_referencia, _isPendingSync: !isOnline }
        : {
            id: (crypto as any).randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            equipamento_id: form.equipamento_id,
            ultimo_horimetro: inicial,
            horimetro_atual: final,
            intervalo_horas: 500,
            data_atualizacao: form.data_referencia,
            equipamentos: eq ? { placa: eq.placa, modelo: eq.modelo, tipo: eq.tipo, categoria: eq.categoria, modulo: eq.modulo } : null,
            _isPendingSync: !isOnline,
          };
      await localDb.put("preventivas", atualizada);
      window.dispatchEvent(new CustomEvent("offline-db-updated-preventivas"));
      setPreventivas((prev) => {
        const idx = prev.findIndex((p) => p.equipamento_id === form.equipamento_id);
        if (idx === -1) return [...prev, atualizada];
        const copy = [...prev];
        copy[idx] = atualizada;
        return copy;
      });

      toast.show(isOnline ? "Apontamento registrado!" : "Salvo offline — sincroniza quando voltar a conexão.", "success");
      setSheetOpen(false);
    } finally {
      setSalvando(false);
    }
  };

  const abrirEdicao = (p: Preventiva) => {
    setEditItem(p);
    setEditForm({
      ultimo_horimetro: String(p.ultimo_horimetro ?? ""),
      horimetro_atual: String(p.horimetro_atual ?? ""),
      intervalo_horas: String(p.intervalo_horas ?? ""),
    });
  };

  const handleSalvarEdicao = async () => {
    if (!editItem) return;
    const dados = {
      ultimo_horimetro: parseFloat(editForm.ultimo_horimetro),
      horimetro_atual: parseFloat(editForm.horimetro_atual),
      intervalo_horas: parseFloat(editForm.intervalo_horas),
      data_atualizacao: hoje(),
    };
    if (Object.values(dados).slice(0, 3).some((v) => isNaN(v as number))) {
      toast.show("Preencha os três valores corretamente.", "error");
      return;
    }
    setSalvandoEdit(true);
    try {
      if (isOnline) {
        const res = await atualizarPreventiva(editItem.id, dados);
        if (res && "error" in res) {
          toast.show("Erro: " + res.error, "error");
          setSalvandoEdit(false);
          return;
        }
      } else {
        await localDb.addToQueue("preventiva", "update", { id: editItem.id, ...dados });
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      }
      const atualizada: Preventiva = { ...editItem, ...dados, _isPendingSync: !isOnline };
      await localDb.put("preventivas", atualizada);
      window.dispatchEvent(new CustomEvent("offline-db-updated-preventivas"));
      setPreventivas((prev) => prev.map((p) => (p.id === editItem.id ? atualizada : p)));
      toast.show("Preventiva atualizada.", "success");
      setEditItem(null);
    } finally {
      setSalvandoEdit(false);
    }
  };

  const handleExcluir = async (p: Preventiva) => {
    if (isOnline) {
      const res = await excluirPreventiva(p.id);
      if (res && "error" in res) {
        toast.show("Erro ao excluir: " + res.error, "error");
        return;
      }
    } else {
      await localDb.addToQueue("preventiva", "delete", p.id);
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    }
    await localDb.delete("preventivas", p.id);
    window.dispatchEvent(new CustomEvent("offline-db-updated-preventivas"));
    setPreventivas((prev) => prev.filter((x) => x.id !== p.id));
    toast.show("Preventiva excluída.", "success");
  };

  const inputCls =
    "w-full px-3.5 py-3 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-100 text-sm font-semibold focus:ring-2 focus:ring-amber-500 outline-none placeholder:text-zinc-600";
  const labelCls = "block text-xs font-bold text-zinc-400 mb-1.5";

  const actionSheetItems: ActionSheetItem[] = actionItem
    ? [
        { key: "editar", label: "Editar Valores", icon: Pencil, onSelect: () => abrirEdicao(actionItem) },
        { key: "excluir", label: "Excluir", icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(actionItem) },
      ]
    : [];

  return (
    <div className="min-h-full">
      {view === "menu" && (
        <div className="p-4 space-y-2.5">
          <ListRow icon={<Gauge size={18} />} title="Lançar Apontamento" subtitle="Registrar horímetro/km atual" onClick={abrirNovo} />
          <ListRow
            icon={<ListChecks size={18} />}
            title={`Status das Preventivas (${preventivas.length})`}
            subtitle="Ver o que está atrasado, em atenção ou no prazo"
            onClick={() => setView("lista")}
          />
        </div>
      )}

      {view === "lista" && (
        <>
          <div className="sticky top-0 z-10 flex items-center gap-1 px-2 py-2 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
            <button
              onClick={() => setView("menu")}
              aria-label="Voltar ao menu de Preventivas"
              className="flex items-center justify-center rounded-xl text-zinc-300 active:bg-zinc-800"
              style={{ minWidth: "var(--tap-min)", minHeight: "var(--tap-min)" }}
            >
              <ChevronLeft size={22} />
            </button>
            <h2 className="flex-1 text-sm font-black text-zinc-50">Status das Preventivas</h2>
          </div>

          <div className="p-4 space-y-3 pb-24">
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
              {(["Todos", "Pesados", "Leves", "Zocar"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoriaFiltro(c)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${
                    categoriaFiltro === c ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(["Todos", "ATRASADO", "ATENÇÃO", "NO PRAZO"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFiltro(s)}
                  className={`shrink-0 px-3 py-2 rounded-xl text-xs font-bold ${
                    statusFiltro === s ? "bg-amber-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-400"
                  }`}
                >
                  {s === "Todos" ? "Todos Status" : s}
                </button>
              ))}
            </div>

            {listaFiltrada.length === 0 ? (
              <EmptyState icon={Gauge} title="Nenhuma preventiva encontrada" />
            ) : (
              <div className="space-y-2">
                {listaFiltrada.map((p) => {
                  const status = getStatus(p);
                  const proxima = p.ultimo_horimetro + p.intervalo_horas;
                  const falta = proxima - p.horimetro_atual;
                  const Icon = STATUS_ICON[status];
                  return (
                    <ListRow
                      key={p.id}
                      title={p.equipamentos?.placa || p.equipamento_id}
                      subtitle={`Atual: ${p.horimetro_atual} · Próxima: ${proxima} · Falta: ${falta}`}
                      badge={
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${STATUS_BADGE[status]}`}>
                          <Icon size={10} /> {status}
                        </span>
                      }
                      onClick={() => setActionItem(p)}
                      rightSlot={<ChevronRight size={16} className="text-zinc-600" />}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {view === "menu" && <Fab onClick={abrirNovo} icon={<Plus size={20} />} label="Apontar" />}

      {/* ─── LANÇAR APONTAMENTO ─── */}
      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Lançar Apontamento" fullHeight>
        <div className="space-y-4 pb-4">
          <div>
            <label className={labelCls}>Equipamento *</label>
            <SearchableSelect value={form.equipamento_id} onChange={onSelectEquipamento} options={equipamentosOptions} placeholder="Selecione o equipamento..." />
          </div>

          <div>
            <label className={labelCls}>Data Referência</label>
            <input type="date" value={form.data_referencia} onChange={(e) => setForm((p) => ({ ...p, data_referencia: e.target.value }))} className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Horímetro/KM Inicial *</label>
              <input
                inputMode="decimal"
                value={form.horimetro_inicial}
                onChange={(e) => setForm((p) => ({ ...p, horimetro_inicial: e.target.value }))}
                placeholder="Ex: 1000.5"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Horímetro/KM Final *</label>
              <input
                inputMode="decimal"
                value={form.horimetro_final}
                onChange={(e) => setForm((p) => ({ ...p, horimetro_final: e.target.value }))}
                placeholder="Ex: 1010.5"
                className={inputCls}
              />
            </div>
          </div>

          {form.horimetro_inicial && form.horimetro_final && !isNaN(parseFloat(form.horimetro_final) - parseFloat(form.horimetro_inicial)) && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-800/50 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-emerald-300">Total no período:</span>
              <span className="text-base font-black text-emerald-400">{(parseFloat(form.horimetro_final) - parseFloat(form.horimetro_inicial)).toFixed(1)}</span>
            </div>
          )}

          <div>
            <label className={labelCls}>Observações</label>
            <textarea
              value={form.observacoes}
              onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))}
              rows={3}
              placeholder="Anomalias, ocorrências ou justificativas (opcional)"
              className={inputCls}
            />
          </div>

          <button
            onClick={handleSalvarApontamento}
            disabled={salvando}
            className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          >
            {salvando ? "Salvando..." : "Registrar Apontamento"}
          </button>
        </div>
      </BottomSheet>

      {/* ─── EDITAR VALORES DA PREVENTIVA ─── */}
      <BottomSheet open={!!editItem} onClose={() => setEditItem(null)} title={editItem ? `Editar · ${editItem.equipamentos?.placa}` : undefined}>
        {editItem && (
          <div className="space-y-4 pb-4">
            <div>
              <label className={labelCls}>Último (h/km)</label>
              <input inputMode="decimal" value={editForm.ultimo_horimetro} onChange={(e) => setEditForm((p) => ({ ...p, ultimo_horimetro: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Atual (h/km)</label>
              <input inputMode="decimal" value={editForm.horimetro_atual} onChange={(e) => setEditForm((p) => ({ ...p, horimetro_atual: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Intervalo (h/km)</label>
              <input inputMode="decimal" value={editForm.intervalo_horas} onChange={(e) => setEditForm((p) => ({ ...p, intervalo_horas: e.target.value }))} className={inputCls} />
            </div>
            <button
              onClick={handleSalvarEdicao}
              disabled={salvandoEdit}
              className="w-full py-3.5 rounded-xl text-sm font-black text-white bg-amber-600 active:bg-amber-700 disabled:opacity-60"
            >
              {salvandoEdit ? "Salvando..." : "Salvar"}
            </button>
          </div>
        )}
      </BottomSheet>

      <ActionSheet
        open={!!actionItem}
        onClose={() => setActionItem(null)}
        title={actionItem ? `Preventiva · ${actionItem.equipamentos?.placa}` : undefined}
        items={actionSheetItems}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleExcluir(confirmDelete)}
        title="Excluir preventiva"
        description="Deseja realmente excluir o controle de preventiva deste equipamento?"
        destructive
      />
    </div>
  );
}
