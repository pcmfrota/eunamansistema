"use client";

import React, { useState, useTransition, useMemo } from "react";
import { salvarAuxiliarAfiacao, excluirAuxiliarAfiacao, importarPadroesAuxiliares } from "./actions";
import { MATERIAIS_DB, ESTADO_RECEBIMENTO, TIPO_DESCARTE } from "./materiaisDB";
import { Plus, Trash2, Pencil, Database, AlertCircle, Download, X, Save } from "lucide-react";

interface AuxItem {
  id: string;
  category: string;
  modulo?: string | null;
  value: string;
  metadata?: any;
}

interface Props {
  auxiliares: AuxItem[];
  onAdd: () => void;
  onDelete: () => void;
}

const MODULOS = ["MA02", "MA04", "MA05", "MA06", "MA07"];

export default function BaseAuxiliarAfiacao({ auxiliares, onAdd, onDelete }: Props) {
  const [category, setCategory] = useState<"afiador" | "maquina" | "material" | "estado_recebimento" | "tipo_descarte">("afiador");
  const [modulo, setModulo] = useState("MA02");
  const [value, setValue] = useState("");
  
  const [metaCodigo, setMetaCodigo] = useState("");
  const [metaNi, setMetaNi] = useState("");
  const [metaCusto, setMetaCusto] = useState("");
  const [metaTipo, setMetaTipo] = useState("");

  const [activeListTab, setActiveListTab] = useState<"afiador" | "maquina" | "material" | "estado_recebimento" | "tipo_descarte">("material");

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const [editingItem, setEditingItem] = useState<{
    id: string;
    category: string;
    value: string;
    modulo?: string | null;
    metaCodigo?: string;
    metaNi?: string;
    metaCusto?: string;
    metaTipo?: string;
  } | null>(null);

  const handleCategoryChange = (cat: typeof category) => {
    setCategory(cat);
    setError("");
    setValue("");
    setMetaCodigo("");
    setMetaNi("");
    setMetaCusto("");
    setMetaTipo("");
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const val = value.trim().toUpperCase();
    if (!val) {
      setError("A descrição/valor não pode ser vazio.");
      return;
    }

    const metadata: any = {};
    if (category === "material") {
      if (!metaCodigo || !metaNi) {
        setError("Preencha o código e NI do material.");
        return;
      }
      metadata.codigo = metaCodigo.trim().toUpperCase();
      metadata.ni = metaNi.trim();
      metadata.custo = parseFloat(metaCusto) || 0;
      metadata.tipo = metaTipo.trim();
    } else if (category === "estado_recebimento" || category === "tipo_descarte") {
      if (!metaCodigo) {
        setError("O código (letra) é obrigatório.");
        return;
      }
      metadata.codigo = metaCodigo.trim().toUpperCase();
    }

    startTransition(async () => {
      const res = await salvarAuxiliarAfiacao(
        category, 
        val, 
        category === "maquina" ? modulo : undefined,
        metadata
      );
      if (res.success) {
        setValue("");
        setMetaCodigo("");
        setMetaNi("");
        setMetaCusto("");
        setMetaTipo("");
        onAdd();
      } else {
        setError(res.error || "Erro ao salvar auxiliar.");
      }
    });
  };

  const handleExcluir = async (id: string, label: string) => {
    if (id.startsWith("default-")) {
      alert("Para excluir ou personalizar um item padrão, utilize o botão Editar (✏️) ou clique em 'Importar Materiais Padrão' no topo.");
      return;
    }
    if (!confirm(`Deseja realmente excluir "${label}" permanentemente?`)) return;
    const res = await excluirAuxiliarAfiacao(id);
    if (res.success) {
      onDelete();
    } else {
      alert("Erro ao excluir: " + res.error);
    }
  };

  const handleImportarMateriaisPadrao = () => {
    if (!confirm("Deseja importar todos os 17 materiais padrão (com Cód, NI e Custo) para o banco de dados?")) return;
    startTransition(async () => {
      const res = await importarPadroesAuxiliares();
      if (res.success) {
        alert("Materiais padrão importados com sucesso!");
        onAdd();
      } else {
        alert("Erro ao importar materiais: " + res.error);
      }
    });
  };

  const openEditModal = (item: AuxItem) => {
    setEditingItem({
      id: item.id,
      category: item.category,
      value: item.value,
      modulo: item.modulo || "MA02",
      metaCodigo: item.metadata?.codigo || "",
      metaNi: item.metadata?.ni || "",
      metaCusto: item.metadata?.custo !== undefined ? String(item.metadata.custo) : "",
      metaTipo: item.metadata?.tipo || "",
    });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    const val = editingItem.value.trim().toUpperCase();
    if (!val) {
      alert("O nome/descrição não pode ser vazio.");
      return;
    }

    const metadata: any = {};
    if (editingItem.category === "material") {
      metadata.codigo = editingItem.metaCodigo?.trim().toUpperCase() || "";
      metadata.ni = editingItem.metaNi?.trim() || "";
      metadata.custo = parseFloat(editingItem.metaCusto || "0") || 0;
      metadata.tipo = editingItem.metaTipo?.trim() || "";
    } else if (editingItem.category === "estado_recebimento" || editingItem.category === "tipo_descarte") {
      metadata.codigo = editingItem.metaCodigo?.trim().toUpperCase() || "";
    }

    startTransition(async () => {
      const res = await salvarAuxiliarAfiacao(
        editingItem.category,
        val,
        editingItem.category === "maquina" ? editingItem.modulo || undefined : undefined,
        metadata,
        editingItem.id
      );
      if (res.success) {
        setEditingItem(null);
        onAdd();
      } else {
        alert("Erro ao salvar alteração: " + res.error);
      }
    });
  };

  const afiadores = (auxiliares || []).filter((a) => a.category === "afiador");
  const maquinas = (auxiliares || []).filter((a) => a.category === "maquina");
  const materiaisDB = (auxiliares || []).filter((a) => a.category === "material");
  const estadosDB = (auxiliares || []).filter((a) => a.category === "estado_recebimento");
  const descartesDB = (auxiliares || []).filter((a) => a.category === "tipo_descarte");

  const materiaisExibição = useMemo(() => {
    if (materiaisDB.length > 0) return materiaisDB;
    return MATERIAIS_DB.map((m) => ({
      id: `default-${m.cod}`,
      category: "material",
      value: m.material,
      metadata: { codigo: m.cod, ni: m.ni, custo: m.custo, tipo: m.tipo }
    }));
  }, [materiaisDB]);

  const estadosExibicao = useMemo(() => {
    if (estadosDB.length > 0) return estadosDB;
    return Object.entries(ESTADO_RECEBIMENTO).map(([letra, desc]) => ({
      id: `default-est-${letra}`,
      category: "estado_recebimento",
      value: desc,
      metadata: { codigo: letra }
    }));
  }, [estadosDB]);

  const descartesExibicao = useMemo(() => {
    if (descartesDB.length > 0) return descartesDB;
    return Object.entries(TIPO_DESCARTE).map(([letra, desc]) => ({
      id: `default-desc-${letra}`,
      category: "tipo_descarte",
      value: desc,
      metadata: { codigo: letra }
    }));
  }, [descartesDB]);

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4 lg:col-span-1 h-fit">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Database className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-gray-800 text-base">Cadastrar Informação</h3>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria</label>
            <select
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as any)}
            >
              <option value="afiador">👷 Afiador</option>
              <option value="maquina">🚜 Máquina</option>
              <option value="material">📦 Material / Peça</option>
              <option value="estado_recebimento">⚠️ Estado de Recebimento</option>
              <option value="tipo_descarte">🗑️ Tipo de Descarte</option>
            </select>
          </div>

          {category === "maquina" && (
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Módulo*</label>
              <select
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                value={modulo}
                onChange={(e) => setModulo(e.target.value)}
              >
                {MODULOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}

          {category === "material" && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3 mt-1">
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Metadados</p>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código*</label>
                <input
                  type="text" required
                  placeholder="Ex: 12"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                  value={metaCodigo}
                  onChange={(e) => setMetaCodigo(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">NI*</label>
                <input
                  type="text" required
                  placeholder="Ex: 25301352"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={metaNi}
                  onChange={(e) => setMetaNi(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Custo unitário (R$)</label>
                <input
                  type="number" step="0.01"
                  placeholder="Ex: 1612.35"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={metaCusto}
                  onChange={(e) => setMetaCusto(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo</label>
                <input
                  type="text"
                  placeholder="Ex: Corrente"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={metaTipo}
                  onChange={(e) => setMetaTipo(e.target.value)}
                />
              </div>
            </div>
          )}

          {(category === "estado_recebimento" || category === "tipo_descarte") && (
            <div className="border-t pt-3 mt-1">
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Código (Letra)*</label>
              <input
                type="text" required maxLength={3}
                placeholder="Ex: A"
                className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500 uppercase font-bold"
                value={metaCodigo}
                onChange={(e) => setMetaCodigo(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição*</label>
            <input
              type="text"
              required
              placeholder={
                category === "afiador" ? "Ex: JOÃO DA SILVA" :
                category === "maquina" ? "Ex: HVE-0546" :
                category === "material" ? "Ex: CORRENTE OREGON/18HX V132" : "Ex: QUEIMADA (O)"
              }
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase transition"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-2.5 px-4 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isPending ? "Salvando..." : "Cadastrar no Banco"}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 flex flex-col bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-[580px]">
        <div className="flex border-b pb-1 overflow-x-auto gap-1 shrink-0 justify-between items-center">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { key: "afiador", label: "👷 Afiadores", count: afiadores.length },
              { key: "maquina", label: "🚜 Máquinas", count: maquinas.length },
              { key: "material", label: "📦 Materiais", count: materiaisExibição.length },
              { key: "estado_recebimento", label: "⚠️ Estados Rec.", count: estadosExibicao.length },
              { key: "tipo_descarte", label: "🗑️ Descartes", count: descartesExibicao.length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveListTab(tab.key as any)}
                className={`py-2 px-3 text-xs font-bold rounded-lg border transition whitespace-nowrap flex items-center gap-1.5 ${
                  activeListTab === tab.key
                    ? "bg-slate-100 border-slate-300 text-slate-800"
                    : "bg-white border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span>{tab.label}</span>
                <span className="bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded-full">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {activeListTab === "material" && materiaisDB.length === 0 && (
            <button
              onClick={handleImportarMateriaisPadrao}
              disabled={isPending}
              className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
              title="Salvar todos os 17 materiais padrão no banco de dados"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Importar Materiais Padrão</span>
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 mt-4 pr-1">
          {activeListTab === "afiador" && (
            <div className="space-y-1.5">
              {afiadores.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition">
                  <span className="text-sm font-semibold text-gray-700 uppercase tracking-tight">{item.value}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEditModal(item)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Editar"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleExcluir(item.id, item.value)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeListTab === "maquina" && (
            <div className="space-y-3">
              {MODULOS.map((mod) => {
                const maqsDoModulo = maquinas.filter((m) => m.modulo === mod);
                if (maqsDoModulo.length === 0) return null;
                return (
                  <div key={mod} className="space-y-1">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">{mod}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1">
                      {maqsDoModulo.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-slate-50 transition">
                          <span className="text-sm font-mono text-gray-700 font-bold">{item.value}</span>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditModal(item)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => handleExcluir(item.id, `${mod} - ${item.value}`)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeListTab === "material" && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border text-xs">
                <thead className="bg-slate-100 text-gray-700 font-extrabold uppercase">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-14">Cód</th>
                    <th className="px-3 py-2.5 text-left">Material / Descrição</th>
                    <th className="px-3 py-2.5 text-center w-24">NI</th>
                    <th className="px-3 py-2.5 text-right w-24">Custo</th>
                    <th className="px-3 py-2.5 text-left w-24">Tipo</th>
                    <th className="px-3 py-2.5 text-center w-20">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {materiaisExibição.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-3 py-2 text-center font-mono font-bold text-blue-600 bg-blue-50/50">{item.metadata?.codigo || "—"}</td>
                      <td className="px-3 py-2 font-bold text-gray-800 uppercase" title={item.value}>{item.value}</td>
                      <td className="px-3 py-2 text-center font-mono font-semibold text-gray-700 bg-slate-50">{item.metadata?.ni || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(item.metadata?.custo)}</td>
                      <td className="px-3 py-2 text-gray-600 font-medium">{item.metadata?.tipo || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditModal(item as AuxItem)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Editar Material"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleExcluir(item.id, item.value)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {(activeListTab === "estado_recebimento" || activeListTab === "tipo_descarte") && (() => {
            const list = activeListTab === "estado_recebimento" ? estadosExibicao : descartesExibicao;
            return (
              <div className="space-y-1.5">
                {list.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-mono font-black text-xs text-slate-700 border">{item.metadata?.codigo || "—"}</span>
                      <span className="text-sm font-semibold text-gray-700 uppercase tracking-tight">{item.value}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditModal(item as AuxItem)} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleExcluir(item.id, item.value)} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-2xl max-w-lg w-full space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-blue-600 font-bold text-base">
                <Pencil className="w-5 h-5" />
                <span>Editar Item ({editingItem.category.toUpperCase()})</span>
              </div>
              <button onClick={() => setEditingItem(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome / Descrição*</label>
                <input type="text" className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 uppercase" value={editingItem.value} onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })} />
              </div>

              {editingItem.category === "maquina" && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Módulo*</label>
                  <select className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.modulo || "MA02"} onChange={(e) => setEditingItem({ ...editingItem, modulo: e.target.value })}>{MODULOS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                </div>
              )}

              {editingItem.category === "material" && (
                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código (Cód)*</label>
                    <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.metaCodigo} onChange={(e) => setEditingItem({ ...editingItem, metaCodigo: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">NI*</label>
                    <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.metaNi} onChange={(e) => setEditingItem({ ...editingItem, metaNi: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Custo (R$)*</label>
                    <input type="number" step="0.01" className="w-full p-2 border border-gray-300 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.metaCusto} onChange={(e) => setEditingItem({ ...editingItem, metaCusto: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Peça</label>
                    <input type="text" className="w-full p-2 border border-gray-300 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.metaTipo} onChange={(e) => setEditingItem({ ...editingItem, metaTipo: e.target.value })} />
                  </div>
                </div>
              )}

              {(editingItem.category === "estado_recebimento" || editingItem.category === "tipo_descarte") && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Código (Letra)*</label>
                  <input type="text" maxLength={3} className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500" value={editingItem.metaCodigo} onChange={(e) => setEditingItem({ ...editingItem, metaCodigo: e.target.value })} />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-3 mt-4">
              <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition">Cancelar</button>
              <button type="button" onClick={handleSaveEdit} disabled={isPending} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"><Save className="w-4 h-4" />{isPending ? "Salvando..." : "Salvar Alterações"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
