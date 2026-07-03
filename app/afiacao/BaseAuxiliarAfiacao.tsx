"use client";

import React, { useState, useTransition } from "react";
import { salvarAuxiliarAfiacao, excluirAuxiliarAfiacao } from "./actions";
import { Plus, Trash2, Database, AlertCircle } from "lucide-react";

interface AuxItem {
  id: string;
  category: string;
  modulo?: string | null;
  value: string;
}

interface Props {
  auxiliares: AuxItem[];
  onAdd: () => void; // Recarregar dados
  onDelete: () => void;
}

const MODULOS = ["MA02", "MA04", "MA05", "MA06", "MA07"];

export default function BaseAuxiliarAfiacao({ auxiliares, onAdd, onDelete }: Props) {
  const [category, setCategory] = useState<"afiador" | "maquina">("afiador");
  const [modulo, setModulo] = useState("MA02");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const val = value.trim().toUpperCase();
    if (!val) {
      setError("O valor não pode ser vazio.");
      return;
    }

    // Verificar duplicatas no estado local
    const existe = auxiliares.some(
      (item) =>
        item.category === category &&
        item.value === val &&
        (category === "maquina" ? item.modulo === modulo : true)
    );

    if (existe) {
      setError(`Este ${category === "afiador" ? "afiador" : "equipamento"} já está cadastrado.`);
      return;
    }

    startTransition(async () => {
      const res = await salvarAuxiliarAfiacao(category, val, category === "maquina" ? modulo : undefined);
      if (res.success) {
        setValue("");
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
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Dado</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setCategory("afiador"); setError(""); }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all border ${
                  category === "afiador"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                👷 Afiador
              </button>
              <button
                type="button"
                onClick={() => { setCategory("maquina"); setError(""); }}
                className={`py-2 rounded-lg text-sm font-semibold transition-all border ${
                  category === "maquina"
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                }`}
              >
                🚜 Máquina
              </button>
            </div>
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

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
              {category === "afiador" ? "Nome do Afiador*" : "Código da Máquina*"}
            </label>
            <input
              type="text"
              required
              placeholder={category === "afiador" ? "Ex: JOÃO DA SILVA" : "Ex: HVE-0546"}
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

      {/* Listas Cadastradas */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lista Afiadores */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center pb-2 border-b mb-3 shrink-0">
            <h3 className="font-bold text-gray-800 text-base">👷 Afiadores Cadastrados</h3>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {afiadores.length}
            </span>
          </div>

          <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
            {afiadores.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhum afiador cadastrado.</p>
            ) : (
              afiadores.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-gray-100 hover:bg-slate-50 transition group"
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
        </div>

        {/* Lista Máquinas */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col h-[400px]">
          <div className="flex justify-between items-center pb-2 border-b mb-3 shrink-0">
            <h3 className="font-bold text-gray-800 text-base">🚜 Máquinas Cadastradas</h3>
            <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {maquinas.length}
            </span>
          </div>

          <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
            {maquinas.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Nenhuma máquina cadastrada.</p>
            ) : (
              MODULOS.map((mod) => {
                const maqsDoModulo = maquinas.filter((m) => m.modulo === mod);
                if (maqsDoModulo.length === 0) return null;
                return (
                  <div key={mod} className="space-y-1 pt-1.5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                      {mod}
                    </p>
                    {maqsDoModulo.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-slate-50 transition group ml-1"
                      >
                        <span className="text-sm font-mono text-gray-700">
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
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
