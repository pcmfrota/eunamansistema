"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Mesmos 4 tipos de caminhão que este checklist cobre (ver FROTA_PARA_TIPO_EQUIPAMENTO
// em app/checklist-frota/ChecklistFrotaClient.tsx) — "toda a frota" aqui é a frota
// pesada coberta por este checklist, não os veículos leves de apoio (Strada, Hilux etc).
const TIPOS_FROTA_CHECKLIST = ["COMBOIO", "PIPA", "MULTIFUNCIONAL", "MUNCK"];
const CICLO_DIAS = 15;

const MESES_NOME = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

type StatusChecklist = "no_prazo" | "atencao" | "atrasado" | "nunca";

const STATUS_CONFIG: Record<StatusChecklist, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  no_prazo: { label: "No prazo", className: "bg-green-50 text-green-700 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800", Icon: CheckCircle2 },
  atencao: { label: "Atenção", className: "bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800", Icon: AlertTriangle },
  atrasado: { label: "Atrasado", className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800", Icon: XCircle },
  nunca: { label: "Nunca feito", className: "bg-red-50 text-red-700 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800", Icon: XCircle },
};

interface Props {
  checklists: any[];
  frota: any[];
}

export default function CalendarioQuinzenalChecklist({ checklists, frota }: Props) {
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hojeISO = useMemo(() => toISODate(hoje), [hoje]);

  const [refMonth, setRefMonth] = useState(() => new Date(hoje.getFullYear(), hoje.getMonth(), 1));

  const veiculos = useMemo(() => {
    return (frota || [])
      .filter(f => TIPOS_FROTA_CHECKLIST.includes(String(f.tipo || "").toUpperCase().trim()))
      .map(f => ({ ...f, placaNorm: String(f.placa || "").toUpperCase().trim() }))
      .filter(f => f.placaNorm)
      .sort((a, b) => a.placaNorm.localeCompare(b.placaNorm));
  }, [frota]);

  // Datas (YYYY-MM-DD) de checklist já feito, por placa normalizada, em ordem crescente.
  const datasPorPlaca = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of checklists || []) {
      const placaNorm = String(c.placa || "").toUpperCase().trim();
      const data = c.data_checklist;
      if (!placaNorm || !data) continue;
      if (!map.has(placaNorm)) map.set(placaNorm, []);
      map.get(placaNorm)!.push(data);
    }
    Array.from(map.values()).forEach(arr => arr.sort());
    return map;
  }, [checklists]);

  const diasDoMes = useMemo(() => {
    const ano = refMonth.getFullYear();
    const mes = refMonth.getMonth();
    const totalDias = new Date(ano, mes + 1, 0).getDate();
    return Array.from({ length: totalDias }, (_, i) => new Date(ano, mes, i + 1));
  }, [refMonth]);

  function statusDoVeiculo(placaNorm: string) {
    const datas = datasPorPlaca.get(placaNorm) || [];
    if (datas.length === 0) {
      return { status: "nunca" as StatusChecklist, ultima: null as string | null, proxima: null as string | null, diasRestantes: null as number | null };
    }
    const ultima = datas[datas.length - 1];
    const proximaDate = addDays(parseLocalDate(ultima), CICLO_DIAS);
    const diasRestantes = diffDays(proximaDate, hoje);
    const status: StatusChecklist = diasRestantes < 0 ? "atrasado" : diasRestantes <= 3 ? "atencao" : "no_prazo";
    return { status, ultima, proxima: toISODate(proximaDate), diasRestantes };
  }

  function mudarMes(delta: number) {
    setRefMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-zinc-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold dark:text-white">Calendário Quinzenal de Checklist</h3>
            <p className="text-xs text-zinc-500">Checklist Mecânico a cada {CICLO_DIAS} dias — Comboio, Pipa, Multifuncional e Munck.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button onClick={() => mudarMes(-1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-36 text-center dark:text-white">
            {MESES_NOME[refMonth.getMonth()]} / {refMonth.getFullYear()}
          </span>
          <button onClick={() => mudarMes(1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-2 border-b border-zinc-100 dark:border-zinc-900 text-[11px] text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-600" /> Checklist realizado</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" /> Vencimento do ciclo (15 dias)</span>
        <span className="flex items-center gap-1.5">Hoje <span className="inline-block w-5 h-3 rounded bg-blue-50 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-700" /></span>
      </div>

      <div className="overflow-x-auto">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-left font-bold text-zinc-600 dark:text-zinc-300 w-[170px] min-w-[170px]">
                Placa / Status
              </th>
              {diasDoMes.map(dia => {
                const isWeekend = dia.getDay() === 0 || dia.getDay() === 6;
                const isHoje = toISODate(dia) === hojeISO;
                return (
                  <th
                    key={dia.getDate()}
                    className={cn(
                      "border border-zinc-200 dark:border-zinc-800 px-1 py-2 text-center font-semibold w-7",
                      isWeekend ? "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400" : "text-zinc-600 dark:text-zinc-300",
                      isHoje && "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    )}
                  >
                    {dia.getDate()}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v, idx) => {
              const { status, ultima, proxima, diasRestantes } = statusDoVeiculo(v.placaNorm);
              const datasExecutadas = new Set(datasPorPlaca.get(v.placaNorm) || []);
              const cfg = STATUS_CONFIG[status];
              const rowBg = idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950";
              return (
                <tr key={v.id || v.placaNorm}>
                  <td className={cn("sticky left-0 z-10 border border-zinc-200 dark:border-zinc-800 px-3 py-2 w-[170px] min-w-[170px]", rowBg)}>
                    <div className="font-mono font-bold whitespace-nowrap dark:text-white">{v.placaNorm}</div>
                    <div className="text-[10px] text-zinc-400 uppercase truncate">{v.tipo}{v.local ? ` • ${v.local}` : ""}</div>
                    <div className={cn("mt-1 flex items-center gap-1 justify-center px-1.5 py-0.5 rounded-md border text-[10px] font-bold", cfg.className)}>
                      <cfg.Icon size={11} />
                      {cfg.label}
                    </div>
                    <div className="text-[9px] text-zinc-400 text-center mt-0.5">
                      {ultima ? `Últ.: ${fmtBR(ultima)}` : "Sem registro"}
                      {diasRestantes !== null && (
                        <> · {diasRestantes >= 0 ? `vence em ${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrasado`}</>
                      )}
                    </div>
                  </td>
                  {diasDoMes.map(dia => {
                    const iso = toISODate(dia);
                    const feito = datasExecutadas.has(iso);
                    const isVencimento = !feito && proxima === iso;
                    return (
                      <td key={iso} className={cn("border border-zinc-200 dark:border-zinc-800 text-center p-0.5", rowBg)}>
                        {feito ? (
                          <div className="flex items-center justify-center" title={`Checklist realizado em ${fmtBR(iso)}`}>
                            <CheckCircle2 size={14} className="text-green-600" />
                          </div>
                        ) : isVencimento ? (
                          <div className="flex items-center justify-center" title="Data de vencimento do ciclo de 15 dias">
                            <span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" />
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {veiculos.length === 0 && (
              <tr>
                <td colSpan={1 + diasDoMes.length} className="text-center py-8 text-zinc-500">
                  Nenhum veículo encontrado (Comboio/Pipa/Multifuncional/Munck).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
