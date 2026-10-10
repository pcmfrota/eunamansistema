"use client";

import { ChevronLeft, Printer, FileDown } from "lucide-react";
import { RecargaCompleta } from "./recargaActions";
import { gerarPDFFichaRecarga, imprimirFichaRecarga } from "./InsumosPDF";

function formatarData(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

const ORIGEM_LABEL: Record<string, string> = {
  SKID: "Skid Móvel", ALMOXARIFADO: "Almoxarifado Suzano", FORNECEDOR: "Fornecedor Externo", OUTRO: "Outro",
};

export default function RecargaDetalhe({
  recarga, placaComboio, placaOrigem, moduloNome, onVoltar,
}: { recarga: RecargaCompleta; placaComboio: string; placaOrigem: string | null; moduloNome: string | null; onVoltar: () => void }) {
  const r = recarga.recarga;

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-zinc-950">
      <div className="sticky top-0 z-10 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 flex-wrap">
        <button onClick={onVoltar} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="text-sm font-black text-zinc-900 dark:text-zinc-50 font-mono">{placaComboio}</div>
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Recarga Nº {r.numero_sequencial}</div>
        </div>
        <button onClick={() => imprimirFichaRecarga(recarga, placaComboio, placaOrigem, moduloNome)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <Printer size={14} /> Imprimir
        </button>
        <button onClick={() => gerarPDFFichaRecarga(recarga, placaComboio, placaOrigem, moduloNome)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl">
          <FileDown size={14} /> PDF
        </button>
      </div>

      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Data</div><div className="font-bold">{formatarData(r.data)} {r.hora || ""}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Turno</div><div className="font-bold">{r.turno ? `${r.turno}º` : "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Módulo</div><div className="font-bold">{moduloNome || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Origem</div><div className="font-bold">{ORIGEM_LABEL[r.origem_tipo]}{placaOrigem ? ` (${placaOrigem})` : r.origem_deposito ? ` (${r.origem_deposito})` : ""}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Local</div><div className="font-bold">{r.local_recarga || "-"}</div></div>
          <div><div className="text-[10px] text-zinc-400 uppercase font-bold">Motorista</div><div className="font-bold">{r.motorista_nome || "-"}</div></div>
          {r.observacao && <div className="col-span-full"><div className="text-[10px] text-zinc-400 uppercase font-bold">Observação</div><div>{r.observacao}</div></div>}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
          <div className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Itens</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-zinc-400 uppercase text-[10px] font-black">
                <th className="text-left pb-2">Item</th><th className="text-right pb-2">Quantidade</th><th className="text-left pb-2">REQ/NF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {recarga.itensDetalhados.map((i) => (
                <tr key={i.material_id}>
                  <td className="py-2 font-semibold text-zinc-600 dark:text-zinc-300">{i.material_nome}{i.tanque_diesel ? ` (Tanque ${i.tanque_diesel}°)` : ""}</td>
                  <td className="py-2 text-right font-bold">{i.quantidade.toLocaleString("pt-BR")} {i.unidade}</td>
                  <td className="py-2">{i.req_nf || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-xs">
          <div className="text-[10px] text-zinc-400 uppercase font-bold mb-1">Responsável pelo Estoque (Cliente)</div>
          <div className="font-bold">{r.responsavel_nome || "-"} {r.responsavel_matricula ? `(${r.responsavel_matricula})` : ""}</div>
          {r.responsavel_assinatura_url && <img src={r.responsavel_assinatura_url} alt="Assinatura" className="mt-2 h-16 border border-zinc-100 dark:border-zinc-800 rounded-lg bg-white" />}
        </div>
      </div>
    </div>
  );
}
