"use client";

import React, { useState } from "react";
import { Edit2, Save, X, Calendar as CalendarIcon, ShieldAlert } from "lucide-react";
import { saveCalendario, importarCronograma2026 } from "./actions";
import { useAuth } from "@/components/auth-context";

const MESES_NOME = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarioClient({ initialData }: { initialData: any[] }) {
  const { profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [data, setData] = useState(initialData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport() {
    if (!confirm("Isso irá importar todos os meses de 2026. Deseja continuar?")) return;
    setIsImporting(true);
    try {
      await importarCronograma2026();
      window.location.reload();
    } catch (error) {
      alert("Erro ao importar!");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSave() {
    if (!editForm) return;
    try {
      await saveCalendario(editForm);
      setEditingId(null);
      window.location.reload(); 
    } catch (error) {
      alert("Erro ao salvar!");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        {isVisitante ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <ShieldAlert size={16} />
            <span>Somente Leitura</span>
          </div>
        ) : (
          <button
            onClick={handleImport}
            disabled={isImporting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
          >
            {isImporting ? "Importando..." : "Importar Cronograma 2026"}
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Mês/Ano</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Data Inicial</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Data Final</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Qtd. Dias</th>
              {!isVisitante && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg text-blue-600">
                      <CalendarIcon size={16} />
                    </div>
                    <div>
                      <div className="font-bold dark:text-white">{MESES_NOME[item.mes] || item.mes}</div>
                      <div className="text-xs text-zinc-500">{item.ano}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingId === item.id ? (
                    <input
                      type="date"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white"
                      value={editForm.data_inicio}
                      onChange={(e) => setEditForm({ ...editForm, data_inicio: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm dark:text-zinc-300">
                      {new Date(item.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                   {editingId === item.id ? (
                    <input
                      type="date"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white"
                      value={editForm.data_fim}
                      onChange={(e) => setEditForm({ ...editForm, data_fim: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm dark:text-zinc-300">
                      {new Date(item.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                   {editingId === item.id ? (
                    <input
                      type="number"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white w-20"
                      value={editForm.total_dias}
                      onChange={(e) => setEditForm({ ...editForm, total_dias: e.target.value })}
                    />
                  ) : (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-xs dark:text-zinc-400">
                     {item.total_dias} dias
                    </span>
                  )}
                </td>
                {!isVisitante && (
                  <td className="px-6 py-4 text-right">
                    {editingId === item.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-zinc-500 hover:bg-zinc-500/10 rounded-lg">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditForm({ ...item });
                        }}
                        className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  Nenhuma data cadastrada. Clique no botão acima para importar o cronograma 2026.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
