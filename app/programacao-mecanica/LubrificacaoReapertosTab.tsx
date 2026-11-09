"use client";

import { Check, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import CalendarioProgramacao from "./CalendarioProgramacao";
import { ExecucaoProgramacao, VeiculoFrotaPesada } from "./types";

// Ficha física "LUBRIFICAÇÃO + REAPERTO DOS GRAMPOS + LIMPEZA DO FILTRO DE AR (SEMANAL)"
// usada pelos mecânicos — mesmos pontos e quantidades de graxeiro de referência.
const PONTOS_LUBRIFICACAO = [
  { id: "feixes_molas_dianteira", label: "Pino dos feixes de molas dianteira", qtdGraxeiro: 8 },
  { id: "manga_eixo_direcao", label: "Pinos da manga de eixo da direção (lado direito e esquerdo)", qtdGraxeiro: 4 },
  { id: "cruzetas_transmissao", label: "Cruzetas da transmissão", qtdGraxeiro: 4 },
  { id: "cruzetas_tomada_forca", label: "Cruzetas da transmissão da tomada de força", qtdGraxeiro: 2 },
  { id: "rolamento_central", label: "Rolamento central (caso tenha)", qtdGraxeiro: 1 },
  { id: "catracas_freio", label: "Catracas de freios (dianteira e traseira)", qtdGraxeiro: 6 },
  { id: "articulacoes_munck", label: "Pinos das articulações do Munck (implemento)", qtdGraxeiro: 10 },
];

const ITENS_EXECUCAO = [
  { id: "regular_catracas", label: "Regular catracas de freios" },
  { id: "esgotar_racor", label: "Esgotar água do racor" },
  { id: "drenagem_compressor", label: "Realizar drenagem da água do compressor de ar" },
  { id: "limpeza_filtro_ar", label: "Limpeza do filtro de ar" },
  { id: "reaperto_grampos", label: "Reaperto dos grampos de chassi do implemento" },
];

interface Props {
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
  onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => void;
  canEdit: boolean;
  canDelete: boolean;
}

function renderCampos(dadosExtra: Record<string, any>, setDadosExtra: (d: Record<string, any>) => void) {
  const pontos: Record<string, number | ""> = dadosExtra.pontos_lubrificacao || {};
  const itens: Record<string, boolean> = dadosExtra.itens_execucao || {};
  const matricula: string = dadosExtra.matricula || "";
  const horaInicio: string = dadosExtra.hora_inicio || "";
  const horaFim: string = dadosExtra.hora_fim || "";

  function setPonto(id: string, qtd: string) {
    setDadosExtra({ ...dadosExtra, pontos_lubrificacao: { ...pontos, [id]: qtd === "" ? "" : Number(qtd) } });
  }
  function toggleItem(id: string) {
    setDadosExtra({ ...dadosExtra, itens_execucao: { ...itens, [id]: !itens[id] } });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">Matrícula</label>
          <input
            type="text"
            value={matricula}
            onChange={e => setDadosExtra({ ...dadosExtra, matricula: e.target.value })}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-xs dark:text-white outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">Hora Início</label>
          <input
            type="time"
            value={horaInicio}
            onChange={e => setDadosExtra({ ...dadosExtra, hora_inicio: e.target.value })}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-xs dark:text-white outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mb-1">Hora Fim</label>
          <input
            type="time"
            value={horaFim}
            onChange={e => setDadosExtra({ ...dadosExtra, hora_fim: e.target.value })}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-xs dark:text-white outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div>
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-zinc-100 dark:bg-zinc-900">
              <th className="text-left px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300">Pontos de Lubrificação</th>
              <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300 w-20">Qtd. Graxeiro</th>
              <th className="px-2 py-1.5 border border-zinc-200 dark:border-zinc-800 font-bold text-zinc-600 dark:text-zinc-300 w-24">Qtd. Lubrificado</th>
            </tr>
          </thead>
          <tbody>
            {PONTOS_LUBRIFICACAO.map(p => (
              <tr key={p.id}>
                <td className="px-2 py-1 border border-zinc-200 dark:border-zinc-800 dark:text-zinc-300">{p.label}</td>
                <td className="px-2 py-1 border border-zinc-200 dark:border-zinc-800 text-center text-zinc-400">{p.qtdGraxeiro}</td>
                <td className="px-1 py-1 border border-zinc-200 dark:border-zinc-800">
                  <input
                    type="number"
                    value={pontos[p.id] ?? ""}
                    onChange={e => setPonto(p.id, e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded px-1.5 py-1 text-center text-xs dark:text-white outline-none focus:ring-1 focus:ring-green-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1.5">
        {ITENS_EXECUCAO.map(item => {
          const marcado = !!itens[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleItem(item.id)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-left"
            >
              <span className="text-[11px] text-zinc-700 dark:text-zinc-300">{item.label}</span>
              <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded", marcado ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
                {marcado ? <><Check size={11} /> Executado</> : <><XIcon size={11} /> Não executado</>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LubrificacaoReapertosTab({ frota, execucoes, onExecucoesChange, canEdit, canDelete }: Props) {
  return (
    <CalendarioProgramacao
      tipo_programacao="lubrificacao"
      tipoLabel="Lubrificação de Chassi e Reapertos"
      periodicidade="semanal"
      frota={frota}
      execucoes={execucoes}
      onExecucoesChange={onExecucoesChange}
      canEdit={canEdit}
      canDelete={canDelete}
      camposExtrasTitulo="Ficha de Lubrificação + Reaperto dos Grampos + Limpeza do Filtro de Ar"
      renderCamposExtras={renderCampos}
    />
  );
}
