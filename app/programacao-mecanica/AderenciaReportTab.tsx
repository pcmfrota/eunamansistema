"use client";

import { useMemo, useRef, useState } from "react";
import {
  Truck, CalendarClock, CheckCircle2, AlertTriangle, Percent, Clock, XCircle,
  TrendingUp, TrendingDown, Minus, FileSpreadsheet, Download, History, X, Loader2,
  ChevronDown, GitCompareArrows,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { cn } from "@/lib/utils";
import { CheckboxMultiSelect } from "@/components/checkbox-multi-select";
import { baixarOuCompartilharPdf } from "@/lib/pdf-share";
import {
  CICLO_DIAS,
  ExecucaoProgramacao,
  TipoProgramacao,
  VeiculoFrotaPesada,
  TIPO_PROGRAMACAO_LABEL,
  TIPO_PROGRAMACAO_PERIODICIDADE,
} from "./types";

interface Props {
  frota: VeiculoFrotaPesada[];
  execucoes: ExecucaoProgramacao[];
}

const TIPOS: TipoProgramacao[] = ["inspecao", "lubrificacao", "calibragem", "lavagem"];

// Nomes de coluna EXATOS pedidos na seção 15.3 do pedido original (diferem dos labels
// "bonitos" de TIPO_PROGRAMACAO_LABEL usados no resto do módulo).
const COLUNA_TIPO_LABEL: Record<TipoProgramacao, string> = {
  inspecao: "Inspeção quinzenal (%)",
  lubrificacao: "Lubrificação e reapertos (%)",
  calibragem: "Calibragem de pneus (%)",
  lavagem: "Lavagem (%)",
};

const MESES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ---- Paleta de status (semáforo de aderência — skill dataviz: "status", não sequencial) ----
// Verde: 95% a 100% · Amarelo: 80% a 94,99% · Vermelho: abaixo de 80% (seção 15.4).
const COR_BOA = { bar: "#0ca30c", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#0ca30c" };
const COR_ATENCAO = { bar: "#d97706", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#d97706" };
const COR_CRITICA = { bar: "#dc2626", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "#dc2626" };

function corAderencia(pct: number) {
  if (pct >= 95) return COR_BOA;
  if (pct >= 80) return COR_ATENCAO;
  return COR_CRITICA;
}

// ---------------------------------------------------------------------------------------
// Datas — tudo em string ISO (YYYY-MM-DD), comparável lexicograficamente.
// ---------------------------------------------------------------------------------------
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function totalDiasDoMes(ano: number, mes: number): number {
  // mes é 1-based (1=Janeiro). new Date(ano, mes, 0) cai no último dia do mês `mes`.
  return new Date(ano, mes, 0).getDate();
}
function limitesMes(ano: number, mes: number) {
  const totalDias = totalDiasDoMes(ano, mes);
  return { inicio: `${ano}-${pad2(mes)}-01`, fim: `${ano}-${pad2(mes)}-${pad2(totalDias)}`, totalDias };
}
function dataOnly(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}
function fmtFullBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function diffDiasAteHoje(iso: string, hoje: string): number {
  return Math.round((parseLocalDate(iso).getTime() - parseLocalDate(hoje).getTime()) / 86400000);
}

// ---------------------------------------------------------------------------------------
// Regras de cálculo da seção 15 (definidas junto com quem pediu a tarefa — o sistema não
// pré-gera uma "vaga" de agendamento por ciclo futuro, os ciclos são computados dinamicamente
// a partir do histórico real de `execucoes`):
//
// - Previstas no mês (por veículo×tipo) = Math.floor(diasNoMes / CICLO_DIAS[tipo]).
// - "Dentro do prazo": status === 'executado' E data de data_execucao <= data_programada.
// - "Fora do prazo": status === 'executado' E data de data_execucao > data_programada
//   (lançado depois do dia programado, mas feito — NUNCA conta como cumprimento no prazo).
// - "Pendente": status === 'programado' E data_programada >= hoje (real, não o mês filtrado).
// - "Atrasada": status IN ('programado','em_andamento') E data_programada < hoje.
// - Aderência (%) = executadas dentro do prazo ÷ previstas no período × 100.
// ---------------------------------------------------------------------------------------
function isDentroDoPrazo(e: ExecucaoProgramacao): boolean {
  if (e.status !== "executado") return false;
  // Guarda: todo "executado" grava data_execucao (ver ExecucaoModal); se faltar por algum
  // motivo, não derruba o cálculo — assume no limite do dia programado.
  const dataExec = dataOnly(e.data_execucao) || e.data_programada;
  return dataExec <= e.data_programada;
}
function isForaDoPrazo(e: ExecucaoProgramacao): boolean {
  if (e.status !== "executado") return false;
  const dataExec = dataOnly(e.data_execucao) || e.data_programada;
  return dataExec > e.data_programada;
}
function isPendente(e: ExecucaoProgramacao, hoje: string): boolean {
  return e.status === "programado" && e.data_programada >= hoje;
}
function isAtrasada(e: ExecucaoProgramacao, hoje: string): boolean {
  return (e.status === "programado" || e.status === "em_andamento") && e.data_programada < hoje;
}

interface Stats {
  previstas: number;
  dentro: number;
  fora: number;
  pendentes: number;
  atrasadas: number;
  aderencia: number; // 0-100
}
function calcularStats(execs: ExecucaoProgramacao[], previstas: number, hoje: string): Stats {
  let dentro = 0, fora = 0, pendentes = 0, atrasadas = 0;
  for (const e of execs) {
    // Cada execução é contabilizada em exatamente um balde (nunca duas vezes).
    if (isDentroDoPrazo(e)) dentro++;
    else if (isForaDoPrazo(e)) fora++;
    else if (isPendente(e, hoje)) pendentes++;
    else if (isAtrasada(e, hoje)) atrasadas++;
  }
  const aderencia = previstas > 0 ? (dentro / previstas) * 100 : 0;
  return { previstas, dentro, fora, pendentes, atrasadas, aderencia };
}

function fmtPct(stats: Pick<Stats, "aderencia" | "previstas">): string {
  return stats.previstas > 0 ? `${stats.aderencia.toFixed(1)}%` : "–";
}

// =========================================================================================
// Subcomponentes de apresentação (mesmo esquema visual do resto do módulo: cartões brancos
// com borda zinc-200/zinc-800, dark:bg-zinc-900/950).
// =========================================================================================
function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Truck; label: string; value: string; accent?: string }) {
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

function PctBadge({ stats }: { stats: Pick<Stats, "aderencia" | "previstas"> }) {
  if (stats.previstas <= 0) return <span className="text-zinc-400 text-xs">–</span>;
  const cor = corAderencia(stats.aderencia);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold", cor.bg, cor.text)}>
      {stats.aderencia.toFixed(1)}%
    </span>
  );
}

function SelectSimples({ value, onChange, options, className }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("relative group flex-shrink-0", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none pr-8 pl-3 py-2 text-[13px] rounded-xl min-w-[120px] cursor-pointer transition-colors outline-none bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 font-medium"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400" size={14} />
    </div>
  );
}

// Figura "segmented bar" (ver skill dataviz: um todo dividido em partes, sem baseline) —
// visualiza a seção 15.2: Cumprimento dentro do prazo / fora do prazo / Não cumprimento,
// como fração das atividades previstas no período.
function BarraCumprimento({ dentro, fora, previstas }: { dentro: number; fora: number; previstas: number }) {
  const naoCumprimento = Math.max(0, previstas - dentro - fora);
  const base = Math.max(1, previstas, dentro + fora);
  const partes = [
    { label: "Dentro do prazo", valor: dentro, cor: COR_BOA.bar },
    { label: "Fora do prazo", valor: fora, cor: COR_ATENCAO.bar },
    { label: "Não cumprimento", valor: naoCumprimento, cor: COR_CRITICA.bar },
  ];
  if (previstas <= 0 && dentro === 0 && fora === 0) {
    return <p className="text-xs text-zinc-500 italic">Sem atividades previstas no período selecionado.</p>;
  }
  return (
    <div>
      <div className="flex w-full h-7 gap-[2px]">
        {partes.map((p, i) => {
          const pct = (p.valor / base) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              className="h-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ width: `${pct}%`, backgroundColor: p.cor, borderRadius: 4 }}
              title={`${p.label}: ${p.valor} (${pct.toFixed(1)}%)`}
            >
              {pct >= 9 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
        {partes.map((p, i) => (
          <span key={i} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block shrink-0" style={{ backgroundColor: p.cor }} />
            {p.label}: <strong className="dark:text-zinc-200">{p.valor}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const cor = corAderencia(d.pct);
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs shadow-lg">
      <p className="font-bold dark:text-white mb-1">{d.name}</p>
      <p className={cn("font-bold", cor.text)}>{d.pct.toFixed(1)}% de aderência</p>
      <p className="text-zinc-500 mt-1">Previstas: {d.previstas} · No prazo: {d.dentro} · Fora do prazo: {d.fora}</p>
    </div>
  );
}

function loadXLSX(): Promise<any> {
  // Mesmo padrão de app/calendario/CalendarioClient.tsx — carrega a lib via CDN em runtime,
  // sem instalar pacote novo no bundle.
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) return resolve((window as any).XLSX);
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Falha ao carregar biblioteca de exportação."));
    document.head.appendChild(script);
  });
}

// =========================================================================================
export default function AderenciaReportTab({ frota, execucoes }: Props) {
  const hoje = useMemo(() => hojeISO(), []);
  const agora = useMemo(() => new Date(), []);

  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [ano, setAno] = useState(agora.getFullYear());

  const [compararAtivo, setCompararAtivo] = useState(false);
  const mesAnteriorDefault = agora.getMonth() === 0 ? 12 : agora.getMonth();
  const anoAnteriorDefault = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
  const [mesComparacao, setMesComparacao] = useState(mesAnteriorDefault);
  const [anoComparacao, setAnoComparacao] = useState(anoAnteriorDefault);

  const [filtroPlaca, setFiltroPlaca] = useState<string[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string[]>([]);
  const [filtroResponsavel, setFiltroResponsavel] = useState<string[]>([]);

  const [placaHistorico, setPlacaHistorico] = useState<string | null>(null);
  const [exportando, setExportando] = useState<"excel" | "pdf" | null>(null);

  const relatorioRef = useRef<HTMLDivElement>(null);

  // ---- opções de filtro ----
  const placaOptions = useMemo(() => frota.map(v => ({ value: v.placa, label: v.placa })), [frota]);
  const tipoOptions = useMemo(() => TIPOS.map(t => ({ value: t, label: TIPO_PROGRAMACAO_LABEL[t] })), []);
  const responsavelOptions = useMemo(() => {
    // "Responsável" cobre tanto quem executou quanto quem acompanhou — não há como saber qual
    // o pedido original quis dizer, então a lista une as duas colunas e o filtro casa com
    // qualquer uma delas.
    const set = new Set<string>();
    for (const e of execucoes) {
      const a = (e.responsavel_execucao || "").trim();
      const b = (e.responsavel_acompanhamento || "").trim();
      if (a) set.add(a);
      if (b) set.add(b);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n }));
  }, [execucoes]);

  const mesOptions = useMemo(() => MESES_NOME.map((nome, idx) => ({ value: String(idx + 1), label: nome })), []);
  const anosDisponiveis = useMemo(() => {
    const anoAtual = agora.getFullYear();
    const anos = new Set<number>();
    for (let a = anoAtual - 3; a <= anoAtual + 1; a++) anos.add(a);
    for (const e of execucoes) {
      if (e.data_programada) anos.add(Number(e.data_programada.slice(0, 4)));
    }
    return Array.from(anos).sort((a, b) => b - a);
  }, [execucoes, agora]);
  const anoOptions = useMemo(() => anosDisponiveis.map(a => ({ value: String(a), label: String(a) })), [anosDisponiveis]);

  const tiposFiltrados = (filtroTipo.length > 0 ? filtroTipo : TIPOS) as TipoProgramacao[];
  const frotaFiltrada = useMemo(
    () => (filtroPlaca.length > 0 ? frota.filter(v => filtroPlaca.includes(v.placa)) : frota),
    [frota, filtroPlaca]
  );

  function responsavelCasa(e: ExecucaoProgramacao): boolean {
    if (filtroResponsavel.length === 0) return true;
    return filtroResponsavel.includes((e.responsavel_execucao || "").trim()) || filtroResponsavel.includes((e.responsavel_acompanhamento || "").trim());
  }

  function execucoesNoEscopo(mesAlvo: number, anoAlvo: number, tipos: TipoProgramacao[], veiculos: VeiculoFrotaPesada[]): ExecucaoProgramacao[] {
    const { inicio, fim } = limitesMes(anoAlvo, mesAlvo);
    const placas = new Set(veiculos.map(v => v.placa));
    return execucoes.filter(e => {
      if (!e.data_programada || e.data_programada < inicio || e.data_programada > fim) return false;
      if (!tipos.includes(e.tipo_programacao)) return false;
      const placaNorm = String(e.placa || "").toUpperCase().trim();
      if (!placas.has(placaNorm)) return false;
      if (!responsavelCasa(e)) return false;
      return true;
    });
  }

  function previstasNoEscopo(mesAlvo: number, anoAlvo: number, tipos: TipoProgramacao[], veiculos: VeiculoFrotaPesada[]): number {
    const totalDias = totalDiasDoMes(anoAlvo, mesAlvo);
    let total = 0;
    for (const _v of veiculos) {
      for (const t of tipos) {
        const ciclo = CICLO_DIAS[TIPO_PROGRAMACAO_PERIODICIDADE[t]];
        total += Math.floor(totalDias / ciclo);
      }
    }
    return total;
  }

  // ---- 15.1 / 15.2 — indicadores gerais do período selecionado ----
  const indicadores = useMemo(() => {
    const execs = execucoesNoEscopo(mes, ano, tiposFiltrados, frotaFiltrada);
    const previstas = previstasNoEscopo(mes, ano, tiposFiltrados, frotaFiltrada);
    return calcularStats(execs, previstas, hoje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucoes, mes, ano, tiposFiltrados, frotaFiltrada, filtroResponsavel, hoje]);

  const indicadoresComparacao = useMemo(() => {
    if (!compararAtivo) return null;
    const execs = execucoesNoEscopo(mesComparacao, anoComparacao, tiposFiltrados, frotaFiltrada);
    const previstas = previstasNoEscopo(mesComparacao, anoComparacao, tiposFiltrados, frotaFiltrada);
    return calcularStats(execs, previstas, hoje);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compararAtivo, execucoes, mesComparacao, anoComparacao, tiposFiltrados, frotaFiltrada, filtroResponsavel, hoje]);

  const deltaAderencia = indicadoresComparacao ? indicadores.aderencia - indicadoresComparacao.aderencia : 0;

  // ---- 15.4 — aderência por tipo de serviço (sempre os 4 tipos, pra comparar lado a lado;
  // respeita placa/responsável/mês mas ignora o filtro de Tipo — senão o gráfico perderia o
  // sentido de "comparar as 4 programações") ----
  const aderenciaPorTipo = useMemo(() => {
    return TIPOS.map(t => {
      const execs = execucoesNoEscopo(mes, ano, [t], frotaFiltrada);
      const previstas = previstasNoEscopo(mes, ano, [t], frotaFiltrada);
      const stats = calcularStats(execs, previstas, hoje);
      return { tipo: t, label: TIPO_PROGRAMACAO_LABEL[t], ...stats };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucoes, mes, ano, frotaFiltrada, filtroResponsavel, hoje]);

  const chartData = useMemo(() => aderenciaPorTipo.map(x => ({
    name: x.label, pct: Math.round(x.aderencia * 10) / 10, previstas: x.previstas, dentro: x.dentro, fora: x.fora,
  })), [aderenciaPorTipo]);

  // ---- 15.3 — relatório individual por caminhão (sempre os 4 tipos por veículo) ----
  const relatorioPorCaminhao = useMemo(() => {
    return frotaFiltrada.map(v => {
      const porTipo: Record<TipoProgramacao, Stats> = {} as Record<TipoProgramacao, Stats>;
      let previstasTotal = 0, dentroTotal = 0, foraTotal = 0, pendentesTotal = 0;
      for (const t of TIPOS) {
        const execs = execucoesNoEscopo(mes, ano, [t], [v]);
        const previstas = previstasNoEscopo(mes, ano, [t], [v]);
        const stats = calcularStats(execs, previstas, hoje);
        porTipo[t] = stats;
        previstasTotal += stats.previstas;
        dentroTotal += stats.dentro;
        foraTotal += stats.fora;
        pendentesTotal += stats.pendentes;
      }
      const aderenciaIndividual = previstasTotal > 0 ? (dentroTotal / previstasTotal) * 100 : 0;
      return { veiculo: v, porTipo, previstasTotal, dentroTotal, foraTotal, pendentesTotal, aderenciaIndividual };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frotaFiltrada, execucoes, mes, ano, filtroResponsavel, hoje]);

  // ---- Pendências identificadas (usado na seção de exportação 15.6) ----
  const pendenciasIdentificadas = useMemo(() => {
    const execs = execucoesNoEscopo(mes, ano, tiposFiltrados, frotaFiltrada);
    return execs
      .filter(e => isPendente(e, hoje) || isAtrasada(e, hoje))
      .sort((a, b) => a.data_programada.localeCompare(b.data_programada))
      .map(e => {
        const atrasada = isAtrasada(e, hoje);
        const dias = diffDiasAteHoje(e.data_programada, hoje);
        return {
          placa: e.placa,
          tipo: TIPO_PROGRAMACAO_LABEL[e.tipo_programacao],
          dataProgramada: e.data_programada,
          status: atrasada ? "Atrasada" : "Pendente",
          dias: atrasada ? Math.abs(dias) : dias,
          responsavelAcompanhamento: e.responsavel_acompanhamento || "-",
        };
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [execucoes, mes, ano, tiposFiltrados, frotaFiltrada, filtroResponsavel, hoje]);

  // ---- Histórico completo de uma placa (modal da seção 15.3), mais recente primeiro ----
  const historicoPlaca = useMemo(() => {
    if (!placaHistorico) return [];
    return execucoes
      .filter(e => String(e.placa || "").toUpperCase().trim() === placaHistorico)
      .slice()
      .sort((a, b) => {
        const da = dataOnly(a.data_execucao) || a.data_programada;
        const db = dataOnly(b.data_execucao) || b.data_programada;
        return db.localeCompare(da) || b.data_programada.localeCompare(a.data_programada);
      });
  }, [execucoes, placaHistorico]);

  const periodoLabel = `${MESES_NOME[mes - 1]}/${ano}`;

  // ---------------------------------------------------------------------------------------
  // Exportação (15.6)
  // ---------------------------------------------------------------------------------------
  async function handleExportarExcel() {
    setExportando("excel");
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.utils.book_new();

      const resumoRows = [
        { Campo: "Empresa", Valor: "EUNAMAN" },
        { Campo: "Período Analisado", Valor: periodoLabel },
        { Campo: "Quantidade Total da Frota", Valor: frota.length },
        { Campo: "Atividades Previstas no Mês", Valor: indicadores.previstas },
        { Campo: "Executadas Dentro do Prazo", Valor: indicadores.dentro },
        { Campo: "Executadas Fora do Prazo", Valor: indicadores.fora },
        { Campo: "Pendentes", Valor: indicadores.pendentes },
        { Campo: "Atrasadas", Valor: indicadores.atrasadas },
        { Campo: "Aderência Geral (%)", Valor: Number(indicadores.aderencia.toFixed(1)) },
        { Campo: "Data de Geração do Relatório", Valor: new Date().toLocaleString("pt-BR") },
      ];
      const wsResumo = XLSX.utils.json_to_sheet(resumoRows);
      wsResumo["!cols"] = [{ wch: 30 }, { wch: 24 }];
      XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

      const wsCaminhoes = XLSX.utils.json_to_sheet(relatorioPorCaminhao.map(r => ({
        Placa: r.veiculo.placa,
        [COLUNA_TIPO_LABEL.inspecao]: Number(r.porTipo.inspecao.aderencia.toFixed(1)),
        [COLUNA_TIPO_LABEL.lubrificacao]: Number(r.porTipo.lubrificacao.aderencia.toFixed(1)),
        [COLUNA_TIPO_LABEL.calibragem]: Number(r.porTipo.calibragem.aderencia.toFixed(1)),
        [COLUNA_TIPO_LABEL.lavagem]: Number(r.porTipo.lavagem.aderencia.toFixed(1)),
        "Total Previstas": r.previstasTotal,
        "Total Executado no Prazo": r.dentroTotal,
        "Total Executado Fora do Prazo": r.foraTotal,
        "Total Pendente": r.pendentesTotal,
        "Aderência Individual (%)": Number(r.aderenciaIndividual.toFixed(1)),
      })));
      XLSX.utils.book_append_sheet(wb, wsCaminhoes, "Aderencia por Caminhao");

      const wsTipo = XLSX.utils.json_to_sheet(aderenciaPorTipo.map(t => ({
        "Tipo de Programação": t.label,
        Previstas: t.previstas,
        "Executado no Prazo": t.dentro,
        "Executado Fora do Prazo": t.fora,
        Pendentes: t.pendentes,
        Atrasadas: t.atrasadas,
        "Aderência (%)": Number(t.aderencia.toFixed(1)),
      })));
      XLSX.utils.book_append_sheet(wb, wsTipo, "Aderencia por Tipo");

      const wsPendencias = XLSX.utils.json_to_sheet(pendenciasIdentificadas.map(p => ({
        Placa: p.placa,
        Tipo: p.tipo,
        "Data Programada": fmtFullBR(p.dataProgramada),
        Status: p.status,
        Dias: p.dias,
        "Responsável Acompanhamento": p.responsavelAcompanhamento,
      })));
      XLSX.utils.book_append_sheet(wb, wsPendencias, "Pendencias");

      XLSX.writeFile(wb, `Aderencia_Programacao_Mecanica_${pad2(mes)}_${ano}.xlsx`);
    } catch (err: any) {
      alert(err?.message || "Erro ao exportar Excel!");
    } finally {
      setExportando(null);
    }
  }

  async function handleExportarPdf() {
    setExportando("pdf");
    try {
      const element = relatorioRef.current;
      if (!element) {
        alert("Erro ao localizar a área do relatório para gerar o PDF.");
        return;
      }
      await baixarOuCompartilharPdf(
        element,
        `Aderencia_Programacao_Mecanica_${pad2(mes)}_${ano}.pdf`,
        `Relatório de Aderência — ${periodoLabel}`,
        `Aderência da programação mecânica EUNAMAN — ${periodoLabel}`,
        "download",
        { adaptPageToContent: true }
      );
    } finally {
      setExportando(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Filtros + exportação */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SelectSimples value={String(mes)} onChange={v => setMes(Number(v))} options={mesOptions} />
          <SelectSimples value={String(ano)} onChange={v => setAno(Number(v))} options={anoOptions} />
          <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-1" />
          <CheckboxMultiSelect values={filtroPlaca} onChange={setFiltroPlaca} options={placaOptions} placeholder="Todas as Placas" />
          <CheckboxMultiSelect values={filtroTipo} onChange={setFiltroTipo} options={tipoOptions} placeholder="Todos os Tipos" />
          <CheckboxMultiSelect values={filtroResponsavel} onChange={setFiltroResponsavel} options={responsavelOptions} placeholder="Todos os Responsáveis" />

          <button
            onClick={() => setCompararAtivo(p => !p)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-colors ml-auto",
              compararAtivo
                ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-900/50"
                : "bg-zinc-50 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700"
            )}
          >
            <GitCompareArrows size={14} /> Comparar meses
          </button>

          <button
            onClick={handleExportarExcel}
            disabled={!!exportando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {exportando === "excel" ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />} Excel
          </button>
          <button
            onClick={handleExportarPdf}
            disabled={!!exportando}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-zinc-800 text-white hover:bg-zinc-900 disabled:opacity-60"
          >
            {exportando === "pdf" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} PDF
          </button>
        </div>

        {compararAtivo && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs font-bold text-zinc-500 uppercase">Comparar com:</span>
            <SelectSimples value={String(mesComparacao)} onChange={v => setMesComparacao(Number(v))} options={mesOptions} />
            <SelectSimples value={String(anoComparacao)} onChange={v => setAnoComparacao(Number(v))} options={anoOptions} />
          </div>
        )}
      </div>

      <div ref={relatorioRef} className="bg-white dark:bg-zinc-950 space-y-6">
        {/* Cabeçalho do relatório (aparece no PDF/print) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold dark:text-white">Relatório de Aderência — Programação Mecânica</h2>
            <p className="text-xs text-zinc-500">EUNAMAN · Período analisado: {periodoLabel} · Frota: {frota.length} caminhões · Gerado em {new Date().toLocaleString("pt-BR")}</p>
          </div>
        </div>

        {/* 15.1 — Indicadores gerais */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          <StatCard icon={Truck} label="Total de Caminhões" value={String(frota.length)} accent="bg-zinc-800 text-white" />
          <StatCard icon={CalendarClock} label="Previstas no Mês" value={String(indicadores.previstas)} />
          <StatCard icon={CheckCircle2} label="No Prazo" value={String(indicadores.dentro)} accent="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" />
          <StatCard icon={AlertTriangle} label="Fora do Prazo" value={String(indicadores.fora)} accent="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" />
          <StatCard icon={Clock} label="Pendentes" value={String(indicadores.pendentes)} accent="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" />
          <StatCard icon={XCircle} label="Atrasadas" value={String(indicadores.atrasadas)} accent="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" />
          <StatCard icon={Percent} label="Aderência Geral" value={`${indicadores.aderencia.toFixed(1)}%`} accent={cn(corAderencia(indicadores.aderencia).bg, corAderencia(indicadores.aderencia).text)} />
        </div>

        {/* 15.2 — Cumprimento dentro do prazo / fora do prazo / não cumprimento */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold dark:text-white mb-3">Cumprimento das programações — {periodoLabel}</h3>
          <BarraCumprimento dentro={indicadores.dentro} fora={indicadores.fora} previstas={indicadores.previstas} />
        </div>

        {/* 15.5 — Comparação mensal */}
        {compararAtivo && indicadoresComparacao && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-bold dark:text-white mb-3">Comparação entre meses</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[160px] bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{MESES_NOME[mesComparacao - 1]}/{anoComparacao}</p>
                <p className="text-xl font-bold dark:text-white">{indicadoresComparacao.aderencia.toFixed(1)}%</p>
              </div>
              <div className="flex flex-col items-center gap-1 shrink-0">
                {Math.abs(deltaAderencia) < 0.05 ? (
                  <Minus size={20} className="text-zinc-400" />
                ) : deltaAderencia > 0 ? (
                  <TrendingUp size={20} className="text-green-600" />
                ) : (
                  <TrendingDown size={20} className="text-red-600" />
                )}
                <span className={cn(
                  "text-xs font-bold",
                  Math.abs(deltaAderencia) < 0.05 ? "text-zinc-400" : deltaAderencia > 0 ? "text-green-600" : "text-red-600"
                )}>
                  {Math.abs(deltaAderencia) < 0.05 ? "Estável" : `${deltaAderencia > 0 ? "+" : ""}${deltaAderencia.toFixed(1)} p.p.`}
                </span>
              </div>
              <div className="flex-1 min-w-[160px] bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-zinc-500 uppercase tracking-wide">{periodoLabel} (atual)</p>
                <p className="text-xl font-bold dark:text-white">{indicadores.aderencia.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        )}

        {/* 15.4 — Aderência por tipo de serviço */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold dark:text-white mb-1">Aderência por tipo de serviço — {periodoLabel}</h3>
          <p className="text-xs text-zinc-500 mb-3">Percentual de atividades executadas dentro do prazo em relação às previstas no mês.</p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 24, right: 16, left: -16, bottom: 4 }} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.12} />
                <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: "#a1a1aa", fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={56}>
                  {chartData.map((entry, idx) => <Cell key={idx} fill={corAderencia(entry.pct).bar} />)}
                  <LabelList dataKey="pct" position="top" formatter={(v: number) => `${v.toFixed(1)}%`} style={{ fill: "var(--chart-label, #52514e)", fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COR_BOA.bar }} /> Verde: 95% a 100%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COR_ATENCAO.bar }} /> Amarelo: 80% a 94,99%</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: COR_CRITICA.bar }} /> Vermelho: abaixo de 80%</span>
          </div>
        </div>

        {/* 15.3 — Relatório individual por caminhão */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-bold dark:text-white">Relatório individual por caminhão — {periodoLabel}</h3>
            <p className="text-xs text-zinc-500">Clique na placa para abrir o histórico completo do veículo.</p>
          </div>
          <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
              <thead className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2 sticky left-0 bg-zinc-50 dark:bg-zinc-950">Placa</th>
                  <th className="px-3 py-2 text-center">{COLUNA_TIPO_LABEL.inspecao}</th>
                  <th className="px-3 py-2 text-center">{COLUNA_TIPO_LABEL.lubrificacao}</th>
                  <th className="px-3 py-2 text-center">{COLUNA_TIPO_LABEL.calibragem}</th>
                  <th className="px-3 py-2 text-center">{COLUNA_TIPO_LABEL.lavagem}</th>
                  <th className="px-3 py-2 text-center">Previstas</th>
                  <th className="px-3 py-2 text-center">No Prazo</th>
                  <th className="px-3 py-2 text-center">Fora do Prazo</th>
                  <th className="px-3 py-2 text-center">Pendente</th>
                  <th className="px-3 py-2 text-center">Aderência Individual</th>
                </tr>
              </thead>
              <tbody>
                {relatorioPorCaminhao.map((r, idx) => {
                  const rowBg = idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950";
                  return (
                    <tr key={r.veiculo.id || r.veiculo.placa} className="border-b dark:border-zinc-800">
                      <td className={cn("px-3 py-2 sticky left-0", rowBg)}>
                        <button
                          onClick={() => setPlacaHistorico(r.veiculo.placa)}
                          className="font-mono font-bold text-green-700 dark:text-green-400 hover:underline"
                        >
                          {r.veiculo.placa}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center"><PctBadge stats={r.porTipo.inspecao} /></td>
                      <td className="px-3 py-2 text-center"><PctBadge stats={r.porTipo.lubrificacao} /></td>
                      <td className="px-3 py-2 text-center"><PctBadge stats={r.porTipo.calibragem} /></td>
                      <td className="px-3 py-2 text-center"><PctBadge stats={r.porTipo.lavagem} /></td>
                      <td className="px-3 py-2 text-center">{r.previstasTotal}</td>
                      <td className="px-3 py-2 text-center">{r.dentroTotal}</td>
                      <td className="px-3 py-2 text-center">{r.foraTotal}</td>
                      <td className="px-3 py-2 text-center">{r.pendentesTotal}</td>
                      <td className="px-3 py-2 text-center"><PctBadge stats={{ aderencia: r.aderenciaIndividual, previstas: r.previstasTotal }} /></td>
                    </tr>
                  );
                })}
                {relatorioPorCaminhao.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-8 text-zinc-500">Nenhum veículo encontrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pendências identificadas — compõe a exportação 15.6 */}
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-bold dark:text-white">Pendências identificadas — {periodoLabel}</h3>
            <p className="text-xs text-zinc-500">Atividades pendentes ou atrasadas no período e escopo filtrado.</p>
          </div>
          <div className="overflow-x-auto max-h-[50vh] overflow-y-auto">
            <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-3 py-2">Placa</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Data Programada</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Dias</th>
                  <th className="px-3 py-2">Resp. Acompanh.</th>
                </tr>
              </thead>
              <tbody>
                {pendenciasIdentificadas.map((p, idx) => (
                  <tr key={idx} className="border-b dark:border-zinc-800">
                    <td className="px-3 py-2 font-mono font-bold text-zinc-900 dark:text-zinc-100">{p.placa}</td>
                    <td className="px-3 py-2">{p.tipo}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmtFullBR(p.dataProgramada)}</td>
                    <td className="px-3 py-2">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                        p.status === "Atrasada" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{p.status === "Atrasada" ? `${p.dias}d atraso` : `faltam ${p.dias}d`}</td>
                    <td className="px-3 py-2">{p.responsavelAcompanhamento}</td>
                  </tr>
                ))}
                {pendenciasIdentificadas.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma pendência no período filtrado.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de histórico por placa (15.3) */}
      {placaHistorico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-2xl shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4 sticky top-0 bg-white dark:bg-zinc-950 pb-2 -mt-1 -mx-1 px-1 pt-1 z-10">
              <div className="flex items-center gap-2">
                <History size={18} className="text-zinc-400" />
                <div>
                  <h3 className="text-base font-bold dark:text-white">Histórico — {placaHistorico}</h3>
                  <p className="text-xs text-zinc-500">{historicoPlaca.length} lançamento(s), mais recente primeiro</p>
                </div>
              </div>
              <button onClick={() => setPlacaHistorico(null)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-full shrink-0">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-600 dark:text-zinc-400">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-semibold border-b dark:border-zinc-800 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3 py-2">Tipo</th>
                    <th className="px-3 py-2">Data Prog.</th>
                    <th className="px-3 py-2">Data Execução</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Resp. Execução</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoPlaca.map(e => {
                    const dentro = isDentroDoPrazo(e);
                    const fora = isForaDoPrazo(e);
                    return (
                      <tr key={e.id} className="border-b dark:border-zinc-800">
                        <td className="px-3 py-2">{TIPO_PROGRAMACAO_LABEL[e.tipo_programacao]}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtFullBR(e.data_programada)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{e.data_execucao ? fmtFullBR(dataOnly(e.data_execucao)!) : "-"}</td>
                        <td className="px-3 py-2">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold",
                            dentro ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : fora ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                            : e.status === "em_andamento" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300")}>
                            {dentro ? "No prazo" : fora ? "Fora do prazo" : e.status === "em_andamento" ? "Em andamento" : "Programado"}
                          </span>
                        </td>
                        <td className="px-3 py-2">{e.responsavel_execucao || "-"}</td>
                      </tr>
                    );
                  })}
                  {historicoPlaca.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum lançamento encontrado para esta placa.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
