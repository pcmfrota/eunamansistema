"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Clock, LayoutGrid, CalendarDays, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CheckboxMultiSelect } from "@/components/checkbox-multi-select";
import ExecucaoModal, { ModalContexto } from "./ExecucaoModal";
import { CICLO_DIAS, ExecucaoProgramacao, Periodicidade, StatusExecucao, TipoProgramacao, VeiculoFrotaPesada } from "./types";

const MESES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}
function fmtBR(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}
function fmtFullBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function diasDoMes(ref: Date): Date[] {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const total = new Date(ano, mes + 1, 0).getDate();
  return Array.from({ length: total }, (_, i) => new Date(ano, mes, i + 1));
}
function diasDaSemana(ref: Date): Date[] {
  const dow = ref.getDay();
  const diffSegunda = dow === 0 ? -6 : 1 - dow;
  const segunda = addDays(ref, diffSegunda);
  return Array.from({ length: 7 }, (_, i) => addDays(segunda, i));
}

type StatusVisual = "no_prazo" | "atencao" | "atrasado" | "nunca";

const STATUS_CONFIG: Record<StatusVisual, { label: string; iconColor: string; Icon: typeof CheckCircle2 }> = {
  no_prazo: { label: "No prazo", iconColor: "text-green-600", Icon: CheckCircle2 },
  atencao: { label: "Atenção", iconColor: "text-amber-600", Icon: AlertTriangle },
  atrasado: { label: "Atrasado", iconColor: "text-red-600", Icon: XCircle },
  nunca: { label: "Nunca feito", iconColor: "text-red-600", Icon: XCircle },
};

interface Props {
  tipo_programacao: TipoProgramacao;
  tipoLabel: string;
  periodicidade: Periodicidade;
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
  onExecucoesChange: (updater: (prev: ExecucaoProgramacao[]) => ExecucaoProgramacao[]) => void;
  canEdit: boolean;
  canDelete: boolean;
  camposExtrasTitulo?: string;
  renderCamposExtras?: (dadosExtra: Record<string, any>, setDadosExtra: (d: Record<string, any>) => void) => React.ReactNode;
}

export default function CalendarioProgramacao({
  tipo_programacao, tipoLabel, periodicidade, frota, execucoes, onExecucoesChange, canEdit, canDelete, camposExtrasTitulo, renderCamposExtras,
}: Props) {
  const hoje = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const hojeISO = useMemo(() => toISODate(hoje), [hoje]);
  const cicloDias = CICLO_DIAS[periodicidade];

  const [view, setView] = useState<"mes" | "semana" | "lista">("mes");
  const [refDate, setRefDate] = useState<Date>(hoje);
  const [modalCtx, setModalCtx] = useState<ModalContexto | null>(null);
  const [filtroPlaca, setFiltroPlaca] = useState<string[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string[]>([]);
  const [buscaResponsavel, setBuscaResponsavel] = useState("");

  const dias = useMemo(() => (view === "semana" ? diasDaSemana(refDate) : diasDoMes(refDate)), [view, refDate]);

  function navegar(delta: number) {
    setRefDate(prev => (view === "semana" ? addDays(prev, delta * 7) : new Date(prev.getFullYear(), prev.getMonth() + delta, 1)));
  }

  // Execuções indexadas por "placa|data_programada"
  const execPorCelula = useMemo(() => {
    const map = new Map<string, ExecucaoProgramacao>();
    for (const e of execucoes || []) {
      const placaNorm = String(e.placa || "").toUpperCase().trim();
      if (!placaNorm || !e.data_programada) continue;
      map.set(`${placaNorm}|${e.data_programada}`, e);
    }
    return map;
  }, [execucoes]);

  // Última execução concluída (status executado) por placa, pra calcular o próximo vencimento do ciclo.
  const ultimaExecucaoPorPlaca = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of execucoes || []) {
      if (e.status !== "executado") continue;
      const placaNorm = String(e.placa || "").toUpperCase().trim();
      const data = e.data_programada;
      if (!placaNorm || !data) continue;
      const atual = map.get(placaNorm);
      if (!atual || data > atual) map.set(placaNorm, data);
    }
    return map;
  }, [execucoes]);

  function statusDoVeiculo(placaNorm: string) {
    const ultima = ultimaExecucaoPorPlaca.get(placaNorm) || null;
    if (!ultima) {
      return { status: "nunca" as StatusVisual, ultima: null as string | null, proxima: null as string | null, diasRestantes: null as number | null };
    }
    const proximaDate = addDays(parseLocalDate(ultima), cicloDias);
    const diasRestantes = diffDays(proximaDate, hoje);
    const status: StatusVisual = diasRestantes < 0 ? "atrasado" : diasRestantes <= Math.min(3, Math.floor(cicloDias / 4)) ? "atencao" : "no_prazo";
    return { status, ultima, proxima: toISODate(proximaDate), diasRestantes };
  }

  const frotaFiltrada = useMemo(() => {
    let lista = frota;
    if (filtroPlaca.length > 0) lista = lista.filter(v => filtroPlaca.includes(v.placa));
    return lista;
  }, [frota, filtroPlaca]);

  function abrirCelula(v: VeiculoFrotaPesada, iso: string) {
    if (!canEdit) return;
    const registroExistente = execPorCelula.get(`${v.placa}|${iso}`) || null;
    setModalCtx({
      tipo_programacao, tipoLabel, periodicidade,
      placa: v.placa, modelo: v.modelo, equipamentoId: v.id,
      dataProgramada: iso, registroExistente,
    });
  }

  function handleSaved(exec: ExecucaoProgramacao) {
    onExecucoesChange(prev => [exec, ...prev.filter(e => e.id !== exec.id)]);
    setModalCtx(null);
  }
  function handleDeleted(id: string) {
    onExecucoesChange(prev => prev.filter(e => e.id !== id));
    setModalCtx(null);
  }

  // Lista flat para a view "Lista" — todas execuções já lançadas (qualquer status), mais filtros.
  const linhasLista = useMemo(() => {
    let lista = [...(execucoes || [])];
    if (filtroPlaca.length > 0) lista = lista.filter(e => filtroPlaca.includes(String(e.placa || "").toUpperCase().trim()));
    if (filtroStatus.length > 0) lista = lista.filter(e => filtroStatus.includes(e.status));
    const termo = buscaResponsavel.toLowerCase().trim();
    if (termo) lista = lista.filter(e => (e.responsavel_execucao || "").toLowerCase().includes(termo) || (e.responsavel_acompanhamento || "").toLowerCase().includes(termo));
    return lista.sort((a, b) => (b.data_programada || "").localeCompare(a.data_programada || ""));
  }, [execucoes, filtroPlaca, filtroStatus, buscaResponsavel]);

  const placaOptions = useMemo(() => frota.map(v => ({ value: v.placa, label: v.placa })), [frota]);

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-bold dark:text-white">{tipoLabel}</h3>
          <p className="text-xs text-zinc-500">
            {canEdit ? "Clique na data da placa para lançar" : "Acompanhamento"} — ciclo de {cicloDias} dias ({periodicidade}).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <button onClick={() => setView("mes")} className={cn("px-2.5 py-1.5 text-xs font-bold flex items-center gap-1", view === "mes" ? "bg-green-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500")}>
              <LayoutGrid size={13} /> Mês
            </button>
            <button onClick={() => setView("semana")} className={cn("px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800", view === "semana" ? "bg-green-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500")}>
              <CalendarDays size={13} /> Semana
            </button>
            <button onClick={() => setView("lista")} className={cn("px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 border-l border-zinc-200 dark:border-zinc-800", view === "lista" ? "bg-green-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-500")}>
              <List size={13} /> Lista
            </button>
          </div>
          {view !== "lista" && (
            <div className="flex items-center gap-2">
              <button onClick={() => navegar(-1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold w-36 text-center dark:text-white">
                {view === "semana"
                  ? `${fmtBR(toISODate(dias[0]))} a ${fmtBR(toISODate(dias[6]))}`
                  : `${MESES_NOME[refDate.getMonth()]}/${refDate.getFullYear()}`}
              </span>
              <button onClick={() => navegar(1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-zinc-100 dark:border-zinc-900">
        <CheckboxMultiSelect values={filtroPlaca} onChange={setFiltroPlaca} options={placaOptions} placeholder="Todas as Placas" />
        {view === "lista" && (
          <>
            <CheckboxMultiSelect
              values={filtroStatus}
              onChange={setFiltroStatus}
              options={[{ value: "programado", label: "Programado" }, { value: "em_andamento", label: "Em andamento" }, { value: "executado", label: "Executado" }]}
              placeholder="Todos os Status"
            />
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={buscaResponsavel}
                onChange={e => setBuscaResponsavel(e.target.value)}
                placeholder="Buscar responsável..."
                className="pl-7 pr-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-green-500 dark:text-white min-w-[180px]"
              />
            </div>
          </>
        )}
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-600 dark:text-zinc-400 ml-auto">
          <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-600" /> Executado</span>
          <span className="flex items-center gap-1"><Clock size={12} className="text-blue-600" /> Em andamento</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" /> Vencimento do ciclo</span>
        </div>
      </div>

      {view === "lista" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-3 py-2">Data Prog.</th>
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">KM</th>
                <th className="px-3 py-2">Horímetro</th>
                <th className="px-3 py-2">Resp. Execução</th>
                <th className="px-3 py-2">Resp. Acompanh.</th>
              </tr>
            </thead>
            <tbody>
              {linhasLista.map(e => {
                const veiculo = frota.find(v => v.placa === String(e.placa || "").toUpperCase().trim());
                return (
                  <tr
                    key={e.id}
                    onClick={() => canEdit && veiculo && abrirCelula(veiculo, e.data_programada)}
                    className={cn("border-b dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50", canEdit && "cursor-pointer")}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{fmtFullBR(e.data_programada)}</td>
                    <td className="px-3 py-2 font-mono font-bold text-zinc-900 dark:text-zinc-100">{e.placa}</td>
                    <td className="px-3 py-2">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                        e.status === "executado" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : e.status === "em_andamento" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400")}>
                        {e.status === "executado" ? "Executado" : e.status === "em_andamento" ? "Em andamento" : "Programado"}
                      </span>
                    </td>
                    <td className="px-3 py-2">{e.km ?? "-"}</td>
                    <td className="px-3 py-2">{e.horimetro ?? "-"}</td>
                    <td className="px-3 py-2">{e.responsavel_execucao || "-"}</td>
                    <td className="px-3 py-2">{e.responsavel_acompanhamento || "-"}</td>
                  </tr>
                );
              })}
              {linhasLista.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum lançamento encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
          <table className="border-collapse text-xs w-full">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-left font-bold text-zinc-600 dark:text-zinc-300 w-[150px] min-w-[150px]">
                  Placa
                </th>
                {dias.map(dia => {
                  const iso = toISODate(dia);
                  const isWeekend = dia.getDay() === 0 || dia.getDay() === 6;
                  const isHoje = iso === hojeISO;
                  return (
                    <th
                      key={iso}
                      className={cn(
                        "sticky top-0 z-10 border border-zinc-200 dark:border-zinc-800 px-1 py-1.5 text-center font-semibold",
                        view === "semana" ? "w-20" : "w-9",
                        isWeekend ? "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300",
                        isHoje && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                      )}
                    >
                      {view === "semana" ? `${DIAS_SEMANA[dia.getDay()]} ${dia.getDate()}` : dia.getDate()}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {frotaFiltrada.map((v, idx) => {
                const { status, ultima, proxima, diasRestantes } = statusDoVeiculo(v.placa);
                const cfg = STATUS_CONFIG[status];
                const rowBg = idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950";
                const diasLabel = diasRestantes === null ? "" : diasRestantes >= 0 ? `${diasRestantes}d` : `-${Math.abs(diasRestantes)}d`;
                const tituloStatus = `${cfg.label} — ${ultima ? `Últ.: ${fmtBR(ultima)}` : "Sem registro"}${diasRestantes !== null ? ` · ${diasRestantes >= 0 ? `vence em ${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrasado`}` : ""}`;
                return (
                  <tr key={v.id || v.placa}>
                    <td className={cn("sticky left-0 z-10 border border-zinc-200 dark:border-zinc-800 px-3 py-1 w-[150px] min-w-[150px]", rowBg)} title={tituloStatus}>
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="min-w-0 truncate">
                          <span className="font-mono font-bold dark:text-white">{v.placa}</span>
                          <span className="text-[9px] text-zinc-400 ml-1 uppercase">{v.tipo}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <cfg.Icon size={13} className={cfg.iconColor} />
                          {diasLabel && <span className="text-[9px] font-bold text-zinc-400">{diasLabel}</span>}
                        </div>
                      </div>
                    </td>
                    {dias.map(dia => {
                      const iso = toISODate(dia);
                      const exec = execPorCelula.get(`${v.placa}|${iso}`);
                      const isVencimento = !exec && proxima === iso;
                      const titulo = exec
                        ? `${exec.responsavel_execucao || "?"} — ${fmtFullBR(iso)}${exec.km != null ? ` · KM: ${exec.km}` : ""}${exec.horimetro != null ? ` · Horím.: ${exec.horimetro}` : ""}`
                        : isVencimento
                        ? "Vencimento do ciclo"
                        : canEdit ? "Clique para lançar" : undefined;
                      return (
                        <td
                          key={iso}
                          onClick={() => abrirCelula(v, iso)}
                          className={cn("border border-zinc-200 dark:border-zinc-800 text-center p-0.5 h-8", rowBg, canEdit && "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20")}
                          title={titulo}
                        >
                          {exec?.status === "executado" ? (
                            <div className="flex items-center justify-center"><CheckCircle2 size={14} className="text-green-600" /></div>
                          ) : exec?.status === "em_andamento" ? (
                            <div className="flex items-center justify-center"><Clock size={14} className="text-blue-600" /></div>
                          ) : exec?.status === "programado" ? (
                            <div className="flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /></div>
                          ) : isVencimento ? (
                            <div className="flex items-center justify-center"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" /></div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {frotaFiltrada.length === 0 && (
                <tr><td colSpan={1 + dias.length} className="text-center py-8 text-zinc-500">Nenhum veículo encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalCtx && (
        <ExecucaoModal
          contexto={modalCtx}
          onClose={() => setModalCtx(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          canDelete={canDelete}
          camposExtrasTitulo={camposExtrasTitulo}
          renderCamposExtras={renderCamposExtras}
        />
      )}
    </div>
  );
}
