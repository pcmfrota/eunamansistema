"use client";

import React, { useState, useTransition } from "react";
import { salvarAuxiliarAfiacao, excluirAuxiliarAfiacao } from "./actions";
import { Plus, Trash2, Database, AlertCircle, Wrench, FileText, CheckCircle } from "lucide-react";

interface AuxItem {
  id: string;
  category: string;
  modulo?: string | null;
  value: string;
  metadata?: any;
}

interface Props {
  auxiliares: AuxItem[];
  onAdd: () => void; // Recarregar dados
  onDelete: () => void;
}

const MODULOS = ["MA02", "MA04", "MA05", "MA06", "MA07"];

export default function BaseAuxiliarAfiacao({ auxiliares, onAdd, onDelete }: Props) {
  const [category, setCategory] = useState<"afiador" | "maquina" | "material" | "estado_recebimento" | "tipo_descarte">("afiador");
  const [modulo, setModulo] = useState("MA02");
  const [value, setValue] = useState("");
  
  // Metadados
  const [metaCodigo, setMetaCodigo] = useState("");
  const [metaNi, setMetaNi] = useState("");
  const [metaCusto, setMetaCusto] = useState("");
  const [metaTipo, setMetaTipo] = useState("");

  const [activeListTab, setActiveListTab] = useState<"afiador" | "maquina" | "material" | "estado_recebimento" | "tipo_descarte">("afiador");

  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

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

    // Validar duplicatas locais
    const existe = auxiliares.some(
      (item) =>
        item.category === category &&
        item.value === val &&
        (category === "maquina" ? item.modulo === modulo : true)
    );

    if (existe) {
      setError("Este item já está cadastrado nesta categoria.");
      return;
    }

    // Montar metadados
    const metadata: any = {};
    if (category === "material") {
      if (!metaCodigo || !metaNi || !metaCusto) {
        setError("Preencha todos os campos do material.");
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
    if (!confirm(`Deseja realmente excluir "${label}" permanentemente?`)) return;
    const res = await excluirAuxiliarAfiacao(id);
    if (res.success) {
      onDelete();
    } else {
      alert("Erro ao excluir: " + res.error);
    }
  };

  const afiadores = auxiliares.filter((a) => a.category === "afiador");
  const maquinas = auxiliares.filter((a) => a.category === "maquina");
  const materiais = auxiliares.filter((a) => a.category === "material");
  const estados = auxiliares.filter((a) => a.category === "estado_recebimento");
  const descartes = auxiliares.filter((a) => a.category === "tipo_descarte");

  const formatCurrency = (val: any) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(num);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Formulário de Cadastro */}
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Categoria de Dado</label>
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
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition"
                value={modulo}
                onChange={(e) => setModulo(e.target.value)}
              >
                {MODULOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          {category === "material" && (
            <div className="grid grid-cols-2 gap-2 border-t pt-3 mt-1">
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1">Metadados do Material</p>
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Custo unitário (R$)*</label>
                <input
                  type="number" step="0.01" required
                  placeholder="Ex: 1612.35"
                  className="w-full p-2 border border-gray-300 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  value={metaCusto}
                  onChange={(e) => setMetaCusto(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Tipo de peça</label>
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              {category === "afiador" && "Nome do Afiador*"}
              {category === "maquina" && "Código da Máquina*"}
              {category === "material" && "Descrição do Material*"}
              {(category === "estado_recebimento" || category === "tipo_descarte") && "Descrição do Motivo*"}
            </label>
            <input
              type="text"
              required
              placeholder={
                category === "afiador" ? "Ex: JOÃO DA SILVA" :
                category === "maquina" ? "Ex: HVE-0546" :
                category === "material" ? "Ex: CORRENTE OREGON/18HX" :
                "Ex: QUEIMADA (O)"
              }
              className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 transition uppercase"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {isPending ? "Salvando..." : "Cadastrar no Banco"}
          </button>
        </form>
      </div>

      {/* Listas Cadastradas com Abas */}
      <div className="lg:col-span-2 flex flex-col bg-white border border-gray-200 rounded-xl p-5 shadow-sm h-[580px]">
        {/* Abas das listas */}
        <div className="flex border-b pb-1 overflow-x-auto gap-1 shrink-0">
          {[
            { key: "afiador", label: "👷 Afiadores", count: afiadores.length },
            { key: "maquina", label: "🚜 Máquinas", count: maquinas.length },
            { key: "material", label: "📦 Materiais", count: materiais.length },
            { key: "estado_recebimento", label: "⚠️ Estados Rec.", count: estados.length },
            { key: "tipo_descarte", label: "🗑️ Descartes", count: descartes.length }
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

        {/* Conteúdo da lista ativa */}
        <div className="overflow-y-auto flex-1 mt-4 pr-1">
          {activeListTab === "afiador" && (
            <div className="space-y-1.5">
              {afiadores.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum afiador cadastrado.</p>
              ) : (
                afiadores.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition"
                  >
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-tight">
                      {item.value}
                    </span>
                    <button
                      onClick={() => handleExcluir(item.id, item.value)}
                      className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {activeListTab === "maquina" && (
            <div className="space-y-3">
              {maquinas.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhuma máquina cadastrada.</p>
              ) : (
                MODULOS.map((mod) => {
                  const maqsDoModulo = maquinas.filter((m) => m.modulo === mod);
                  if (maqsDoModulo.length === 0) return null;
                  return (
                    <div key={mod} className="space-y-1">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-1">
                        {mod}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pl-1">
                        {maqsDoModulo.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-slate-50 transition"
                          >
                            <span className="text-sm font-mono text-gray-700 font-bold">
                              {item.value}
                            </span>
                            <button
                              onClick={() => handleExcluir(item.id, `${mod} - ${item.value}`)}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeListTab === "material" && (
            <div className="overflow-x-auto">
              {materiais.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Nenhum material cadastrado.</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 border text-xs">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase">
                    <tr>
                      <th className="px-3 py-2 text-center">Cód</th>
                      <th className="px-3 py-2 text-left">Material</th>
                      <th className="px-3 py-2 text-center">NI</th>
                      <th className="px-3 py-2 text-right">Custo</th>
                      <th className="px-3 py-2 text-left">Tipo</th>
                      <th className="px-3 py-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {materiais.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-center font-mono font-bold text-blue-600">{item.metadata?.codigo || "—"}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 uppercase max-w-[200px] truncate" title={item.value}>{item.value}</td>
                        <td className="px-3 py-2 text-center font-mono text-gray-500">{item.metadata?.ni || "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-700">{formatCurrency(item.metadata?.custo)}</td>
                        <td className="px-3 py-2 text-gray-500">{item.metadata?.tipo || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => handleExcluir(item.id, item.value)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Excluir"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {(activeListTab === "estado_recebimento" || activeListTab === "tipo_descarte") && (() => {
            const list = activeListTab === "estado_recebimento" ? estados : descartes;
            return (
              <div className="space-y-1.5">
                {list.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Nenhum registro cadastrado.</p>
                ) : (
                  list.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-mono font-black text-xs text-slate-700 border">
                          {item.metadata?.codigo || "—"}
                        </span>
                        <span className="text-sm font-semibold text-gray-700 uppercase tracking-tight">
                          {item.value}
                        </span>
                      </div>
                      <button
                        onClick={() => handleExcluir(item.id, item.value)}
                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
