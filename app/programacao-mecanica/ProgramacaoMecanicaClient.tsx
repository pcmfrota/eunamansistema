"use client";

import { useMemo, useState } from "react";
import { Truck, CalendarClock, CheckCircle2, Clock, AlertTriangle, Percent, ClipboardCheck, Droplets, Gauge, SprayCan, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFrotaPesadaAtiva, ExecucaoProgramacao, TipoProgramacao } from "./types";
import InspecaoFrotaTab from "./InspecaoFrotaTab";
import LubrificacaoReapertosTab from "./LubrificacaoReapertosTab";
import CalibragemPneusTab from "./CalibragemPneusTab";
import LavagemTab from "./LavagemTab";
import AderenciaReportTab from "./AderenciaReportTab";

interface Props {
  initialEquipamentos: any[];
  initialExecucoes: ExecucaoProgramacao[];
  userRole: string;
}

type AbaPrincipal = TipoProgramacao | "aderencia";

const ABAS: { key: AbaPrincipal; label: string; Icon: typeof ClipboardCheck }[] = [
  { key: "inspecao", label: "Inspeção da Frota", Icon: ClipboardCheck },
  { key: "lubrificacao", label: "Lubrificação + Reapertos", Icon: Droplets },
  { key: "calibragem", label: "Calibragem de Pneus", Icon: Gauge },
  { key: "lavagem", label: "Lavagem dos Caminhões", Icon: SprayCan },
  { key: "aderencia", label: "Relatório de Aderência", Icon: BarChart3 },
];

function StatTile({ icon: Icon, label, value, accent }: { icon: typeof Truck; label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 flex items-center gap-3">
      <div className={cn("p-2 rounded-lg shrink-0", accent || "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300")}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold dark:text-white leading-tight">{value}</p>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide truncate">{label}</p>
      </div>
    </div>
  );
}

export default function ProgramacaoMecanicaClient({ initialEquipamentos, initialExecucoes, userRole }: Props) {
  const [execucoes, setExecucoes] = useState<ExecucaoProgramacao[]>(initialExecucoes || []);
  const [abaAtiva, setAbaAtiva] = useState<AbaPrincipal>("inspecao");

  const canEdit = (userRole === "admin" || userRole === "administrador") || userRole === "mecanico" || userRole === "gestao";
  const canDelete = (userRole === "admin" || userRole === "administrador") || userRole === "gestao";

  const frota = useMemo(() => getFrotaPesadaAtiva(initialEquipamentos), [initialEquipamentos]);

  const indicadores = useMemo(() => {
    const hojeISO = new Date().toISOString().slice(0, 10);
    const total = execucoes.length;
    const executadas = execucoes.filter(e => e.status === "executado").length;
    const emAndamento = execucoes.filter(e => e.status === "em_andamento").length;
    const pendentes = execucoes.filter(e => e.status === "programado" && e.data_programada >= hojeISO).length;
    const atrasadas = execucoes.filter(e => (e.status === "programado" || e.status === "em_andamento") && e.data_programada < hojeISO).length;
    const percentual = total > 0 ? Math.round((executadas / total) * 100) : 0;
    return { total, executadas, emAndamento, pendentes, atrasadas, percentual };
  }, [execucoes]);

  const abaProps = {
    frota,
    execucoes: execucoes.filter(e => e.tipo_programacao === abaAtiva),
    onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => setExecucoes(updater),
    canEdit,
    canDelete,
  };

  return (
    <div className="p-4 lg:p-6 w-full max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold dark:text-white">Programação Mecânica</h1>
        <p className="text-zinc-500 text-sm">Inspeção, lubrificação, calibragem e lavagem programadas para a frota pesada.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile icon={Truck} label="Frota Ativa" value={String(frota.length)} accent="bg-zinc-800 text-white" />
        <StatTile icon={CalendarClock} label="Atividades Totais" value={String(indicadores.total)} />
        <StatTile icon={CheckCircle2} label="Executadas" value={String(indicadores.executadas)} accent="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
        <StatTile icon={Clock} label="Pendentes" value={String(indicadores.pendentes)} accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
        <StatTile icon={AlertTriangle} label="Atrasadas" value={String(indicadores.atrasadas)} accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
        <StatTile icon={Percent} label="% Execução" value={`${indicadores.percentual}%`} accent="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-px">
        {ABAS.map(aba => (
          <button
            key={aba.key}
            onClick={() => setAbaAtiva(aba.key)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-colors",
              abaAtiva === aba.key ? "border-green-600 text-green-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-800"
            )}
          >
            <aba.Icon size={16} /> {aba.label}
          </button>
        ))}
      </div>

      {abaAtiva === "inspecao" && <InspecaoFrotaTab {...abaProps} />}
      {abaAtiva === "lubrificacao" && <LubrificacaoReapertosTab {...abaProps} />}
      {abaAtiva === "calibragem" && <CalibragemPneusTab {...abaProps} />}
      {abaAtiva === "lavagem" && <LavagemTab {...abaProps} />}
      {abaAtiva === "aderencia" && <AderenciaReportTab frota={frota} execucoes={execucoes} />}
    </div>
  );
}
