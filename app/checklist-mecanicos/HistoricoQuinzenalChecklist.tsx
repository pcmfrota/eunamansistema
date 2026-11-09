"use client";

import { useMemo, useState } from "react";
import { Search, Trash2, Loader2 } from "lucide-react";
import { excluirRegistroQuinzenal, RegistroQuinzenal } from "./actions";

function fmtFullBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Props {
  registros: RegistroQuinzenal[];
  onRegistrosChange: (updater: (prev: RegistroQuinzenal[]) => RegistroQuinzenal[]) => void;
  canDelete: boolean;
}

export default function HistoricoQuinzenalChecklist({ registros, onRegistrosChange, canDelete }: Props) {
  const [busca, setBusca] = useState("");
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const linhas = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    let lista = [...(registros || [])];
    if (termo) {
      lista = lista.filter(r =>
        (r.placa || "").toLowerCase().includes(termo) ||
        (r.colaborador || "").toLowerCase().includes(termo)
      );
    }
    return lista.sort((a, b) => (b.data_checklist || "").localeCompare(a.data_checklist || ""));
  }, [registros, busca]);

  async function handleExcluir(id: string) {
    if (!confirm("Excluir este registro do histórico?")) return;
    setExcluindoId(id);
    const result = await excluirRegistroQuinzenal(id);
    setExcluindoId(null);
    if (result?.error) {
      alert(result.error);
      return;
    }
    onRegistrosChange(prev => prev.filter(r => r.id !== id));
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por placa ou colaborador..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-green-500 dark:text-white"
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
          <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Colaborador</th>
              <th className="px-4 py-3">Horímetro</th>
              <th className="px-4 py-3">Km</th>
              <th className="px-4 py-3">Lançado por</th>
              {canDelete && <th className="px-4 py-3 text-center">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map(r => (
              <tr key={r.id} className="border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 whitespace-nowrap">{fmtFullBR(r.data_checklist)}</td>
                <td className="px-4 py-3 font-mono font-bold text-zinc-900 dark:text-zinc-100">{r.placa}</td>
                <td className="px-4 py-3">{r.tipo_caminhao || "-"}</td>
                <td className="px-4 py-3">{r.colaborador}</td>
                <td className="px-4 py-3">{r.horimetro ?? "-"}</td>
                <td className="px-4 py-3">{r.km ?? "-"}</td>
                <td className="px-4 py-3 text-xs">{r.criado_por_nome || "-"}</td>
                {canDelete && (
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleExcluir(r.id)}
                      disabled={excluindoId === r.id}
                      className="p-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-60 inline-flex"
                      title="Excluir"
                    >
                      {excluindoId === r.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={canDelete ? 8 : 7} className="text-center py-8 text-zinc-500">Nenhum registro encontrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
