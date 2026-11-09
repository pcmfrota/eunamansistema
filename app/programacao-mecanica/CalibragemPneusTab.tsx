"use client";

import CalendarioProgramacao from "./CalendarioProgramacao";
import { ExecucaoProgramacao, VeiculoFrotaPesada } from "./types";

// Mesma convenção de posições de pneu já usada em Checklist Mecânicos/Boletim de Pneus.
const POSICOES_PNEU = [
  { id: "DD", label: "Dianteiro Direito" },
  { id: "DE", label: "Dianteiro Esquerdo" },
  { id: "TD1E", label: "Traseiro Eixo 1 Direito Ext." },
  { id: "TD1I", label: "Traseiro Eixo 1 Direito Int." },
  { id: "TD2E", label: "Traseiro Eixo 2 Direito Ext." },
  { id: "TD2I", label: "Traseiro Eixo 2 Direito Int." },
  { id: "TE1E", label: "Traseiro Eixo 1 Esquerdo Ext." },
  { id: "TE1I", label: "Traseiro Eixo 1 Esquerdo Int." },
  { id: "TE2E", label: "Traseiro Eixo 2 Esquerdo Ext." },
  { id: "TE2I", label: "Traseiro Eixo 2 Esquerdo Int." },
];

interface Props {
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
  onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function renderCampos(dadosExtra: Record<string, any>, setDadosExtra: (d: Record<string, any>) => void) {
  const pneus: Record<string, { lida?: string; recomendada?: string; obs?: string }> = dadosExtra.pneus || {};

  function setCampo(id: string, campo: "lida" | "recomendada" | "obs", valor: string) {
    setDadosExtra({ ...dadosExtra, pneus: { ...pneus, [id]: { ...(pneus[id] || {}), [campo]: valor } } });
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-400">
        A pressão recomendada não é fixa — informe conforme a especificação do veículo/pneu.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-900">
              <th className="text-left px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300">Posição</th>
              <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300 w-24">Pressão Verificada (psi)</th>
              <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300 w-24">Pressão Recomendada (psi)</th>
              <th className="text-left px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300">Observação</th>
            </tr>
          </thead>
          <tbody>
            {POSICOES_PNEU.map(pos => {
              const atual = pneus[pos.id] || {};
              const lida = Number(atual.lida);
              const recomendada = Number(atual.recomendada);
              const fora = atual.lida && atual.recomendada && (lida < recomendada * 0.9 || lida > recomendada * 1.1);
              return (
                <tr key={pos.id}>
                  <td className="px-2 py-1 border border-zinc-200 dark:border-zinc-800 dark:text-zinc-300 whitespace-nowrap">
                    <span className="font-mono font-bold">{pos.id}</span> <span className="text-zinc-400">{pos.label}</span>
                  </td>
                  <td className="px-1 py-1 border border-zinc-200 dark:border-zinc-800">
                    <input
                      type="number"
                      value={atual.lida || ""}
                      onChange={e => setCampo(pos.id, "lida", e.target.value)}
                      placeholder="-"
                      className={`w-full border rounded px-1.5 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-green-500 dark:text-white ${fora ? "border-red-400 bg-red-50 dark:bg-red-900/20" : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"}`}
                    />
                  </td>
                  <td className="px-1 py-1 border border-zinc-200 dark:border-zinc-800">
                    <input
                      type="number"
                      value={atual.recomendada || ""}
                      onChange={e => setCampo(pos.id, "recomendada", e.target.value)}
                      placeholder="-"
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-center text-xs dark:text-white outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </td>
                  <td className="px-1 py-1 border border-zinc-200 dark:border-zinc-800">
                    <input
                      type="text"
                      value={atual.obs || ""}
                      onChange={e => setCampo(pos.id, "obs", e.target.value)}
                      placeholder="Condição do pneu..."
                      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-xs dark:text-white outline-none focus:ring-1 focus:ring-green-500"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CalibragemPneusTab({ frota, execucoes, onExecucoesChange, canEdit, canDelete }: Props) {
  return (
    <CalendarioProgramacao
      tipo_programacao="calibragem"
      tipoLabel="Calibragem de Pneus"
      periodicidade="semanal"
      frota={frota}
      execucoes={execucoes}
      onExecucoesChange={onExecucoesChange}
      canEdit={canEdit}
      canDelete={canDelete}
      camposExtrasTitulo="Pressões por Posição de Pneu"
      renderCamposExtras={renderCampos}
    />
  );
}
