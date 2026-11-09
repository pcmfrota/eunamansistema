"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Calendar as CalendarIcon, X, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { salvarRegistroQuinzenal, excluirRegistroQuinzenal, RegistroQuinzenal } from "./actions";

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
function fmtFullBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

interface Quinzena {
  ano: number;
  mes: number; // 0-11
  parte: 1 | 2; // 1 = dias 01-15, 2 = dias 16-fim do mês
}

function quinzenaDeHoje(hoje: Date): Quinzena {
  return { ano: hoje.getFullYear(), mes: hoje.getMonth(), parte: hoje.getDate() <= 15 ? 1 : 2 };
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

function diasDaQuinzena(q: Quinzena): Date[] {
  const inicio = q.parte === 1 ? 1 : 16;
  const fim = q.parte === 1 ? 15 : ultimoDiaDoMes(q.ano, q.mes);
  const dias: Date[] = [];
  for (let d = inicio; d <= fim; d++) dias.push(new Date(q.ano, q.mes, d));
  return dias;
}

function mudarQuinzena(q: Quinzena, delta: number): Quinzena {
  if (delta > 0) {
    if (q.parte === 1) return { ...q, parte: 2 };
    const proxMes = q.mes + 1;
    return proxMes > 11 ? { ano: q.ano + 1, mes: 0, parte: 1 } : { ano: q.ano, mes: proxMes, parte: 1 };
  }
  if (q.parte === 2) return { ...q, parte: 1 };
  const mesAnterior = q.mes - 1;
  return mesAnterior < 0 ? { ano: q.ano - 1, mes: 11, parte: 2 } : { ano: q.ano, mes: mesAnterior, parte: 2 };
}

type StatusChecklist = "no_prazo" | "atencao" | "atrasado" | "nunca";

const STATUS_CONFIG: Record<StatusChecklist, { label: string; iconColor: string; Icon: typeof CheckCircle2 }> = {
  no_prazo: { label: "No prazo", iconColor: "text-green-600", Icon: CheckCircle2 },
  atencao: { label: "Atenção", iconColor: "text-amber-600", Icon: AlertTriangle },
  atrasado: { label: "Atrasado", iconColor: "text-red-600", Icon: XCircle },
  nunca: { label: "Nunca feito", iconColor: "text-red-600", Icon: XCircle },
};

interface ModalCell {
  placa: string;
  tipo: string;
  local: string;
  equipamentoId: string | null;
  iso: string;
  registroExistente: RegistroQuinzenal | null;
}

interface Props {
  checklists: any[];
  frota: any[];
  registros: RegistroQuinzenal[];
  onRegistrosChange: (updater: (prev: RegistroQuinzenal[]) => RegistroQuinzenal[]) => void;
  canEdit: boolean;
  canDelete: boolean;
}

export default function CalendarioQuinzenalChecklist({ checklists, frota, registros, onRegistrosChange, canEdit, canDelete }: Props) {
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const hojeISO = useMemo(() => toISODate(hoje), [hoje]);

  const [refQuinzena, setRefQuinzena] = useState<Quinzena>(() => quinzenaDeHoje(hoje));
  const [modalCell, setModalCell] = useState<ModalCell | null>(null);
  const [colaborador, setColaborador] = useState("");
  const [horimetro, setHorimetro] = useState("");
  const [km, setKm] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [erro, setErro] = useState("");

  const veiculos = useMemo(() => {
    return (frota || [])
      .filter(f => TIPOS_FROTA_CHECKLIST.includes(String(f.tipo || "").toUpperCase().trim()))
      .filter(f => String(f.status || "").toUpperCase().trim() !== "INATIVO")
      .map(f => ({ ...f, placaNorm: String(f.placa || "").toUpperCase().trim() }))
      .filter(f => f.placaNorm)
      .sort((a, b) => a.placaNorm.localeCompare(b.placaNorm));
  }, [frota]);

  // Datas (YYYY-MM-DD) de checklist completo já feito, por placa normalizada, em ordem crescente.
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

  // Registros rápidos do calendário (colaborador/horímetro/km), indexados por "placa|data".
  const registroPorCelula = useMemo(() => {
    const map = new Map<string, RegistroQuinzenal>();
    for (const r of registros || []) {
      const placaNorm = String(r.placa || "").toUpperCase().trim();
      if (!placaNorm || !r.data_checklist) continue;
      map.set(`${placaNorm}|${r.data_checklist}`, r);
    }
    return map;
  }, [registros]);

  // "Feito" considera tanto a inspeção completa (aba Checklists) quanto o registro
  // rápido lançado pelo calendário — qualquer um dos dois comprova o checklist do dia.
  const datasFeitasPorPlaca = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [placa, datas] of Array.from(datasPorPlaca.entries())) {
      map.set(placa, [...datas]);
    }
    for (const r of registros || []) {
      const placaNorm = String(r.placa || "").toUpperCase().trim();
      if (!placaNorm || !r.data_checklist) continue;
      if (!map.has(placaNorm)) map.set(placaNorm, []);
      const arr = map.get(placaNorm)!;
      if (!arr.includes(r.data_checklist)) arr.push(r.data_checklist);
    }
    Array.from(map.values()).forEach(arr => arr.sort());
    return map;
  }, [datasPorPlaca, registros]);

  const diasDaQuinzenaAtual = useMemo(() => diasDaQuinzena(refQuinzena), [refQuinzena]);

  function statusDoVeiculo(placaNorm: string) {
    const datas = datasFeitasPorPlaca.get(placaNorm) || [];
    if (datas.length === 0) {
      return { status: "nunca" as StatusChecklist, ultima: null as string | null, proxima: null as string | null, diasRestantes: null as number | null };
    }
    const ultima = datas[datas.length - 1];
    const proximaDate = addDays(parseLocalDate(ultima), CICLO_DIAS);
    const diasRestantes = diffDays(proximaDate, hoje);
    const status: StatusChecklist = diasRestantes < 0 ? "atrasado" : diasRestantes <= 3 ? "atencao" : "no_prazo";
    return { status, ultima, proxima: toISODate(proximaDate), diasRestantes };
  }

  function navegarQuinzena(delta: number) {
    setRefQuinzena(prev => mudarQuinzena(prev, delta));
  }

  function abrirCelula(v: any, iso: string) {
    if (!canEdit) return;
    const registroExistente = registroPorCelula.get(`${v.placaNorm}|${iso}`) || null;
    setModalCell({ placa: v.placaNorm, tipo: v.tipo || "", local: v.local || "", equipamentoId: v.id || null, iso, registroExistente });
    setColaborador(registroExistente?.colaborador || "");
    setHorimetro(registroExistente?.horimetro != null ? String(registroExistente.horimetro) : "");
    setKm(registroExistente?.km != null ? String(registroExistente.km) : "");
    setErro("");
  }

  function fecharModal() {
    setModalCell(null);
    setErro("");
  }

  async function handleSalvar() {
    if (!modalCell) return;
    if (!colaborador.trim()) {
      setErro("Informe o colaborador que realizou o checklist.");
      return;
    }
    setSaving(true);
    setErro("");
    const result = await salvarRegistroQuinzenal({
      id: modalCell.registroExistente?.id,
      equipamento_id: modalCell.equipamentoId,
      placa: modalCell.placa,
      tipo_caminhao: modalCell.tipo || null,
      data_checklist: modalCell.iso,
      colaborador: colaborador.trim(),
      horimetro: horimetro.trim() === "" ? null : Number(horimetro),
      km: km.trim() === "" ? null : Number(km),
    });
    setSaving(false);
    if (result?.error) {
      setErro(result.error);
      return;
    }
    const salvo = result.data as RegistroQuinzenal;
    onRegistrosChange(prev => [salvo, ...prev.filter(r => r.id !== salvo.id)]);
    fecharModal();
  }

  async function handleExcluir() {
    if (!modalCell?.registroExistente) return;
    if (!confirm("Excluir este registro do calendário quinzenal?")) return;
    setDeleting(true);
    const result = await excluirRegistroQuinzenal(modalCell.registroExistente.id);
    setDeleting(false);
    if (result?.error) {
      setErro(result.error);
      return;
    }
    const idExcluido = modalCell.registroExistente.id;
    onRegistrosChange(prev => prev.filter(r => r.id !== idExcluido));
    fecharModal();
  }

  return (
    <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-zinc-400 shrink-0" />
          <div>
            <h3 className="text-sm font-bold dark:text-white">Calendário Quinzenal de Checklist</h3>
            <p className="text-xs text-zinc-500">
              {canEdit ? "Clique na data da placa para lançar o checklist" : "Checklist Mecânico"} a cada {CICLO_DIAS} dias — Comboio, Pipa, Multifuncional e Munck.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button onClick={() => navegarQuinzena(-1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-56 text-center dark:text-white">
            {refQuinzena.parte === 1 ? "1ª Quinzena" : "2ª Quinzena"} — {MESES_NOME[refQuinzena.mes]}/{refQuinzena.ano}
            <span className="block text-[10px] font-normal text-zinc-400">
              {refQuinzena.parte === 1 ? "01" : "16"} a {refQuinzena.parte === 1 ? "15" : ultimoDiaDoMes(refQuinzena.ano, refQuinzena.mes)}
            </span>
          </span>
          <button onClick={() => navegarQuinzena(1)} className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 px-4 py-2 border-b border-zinc-100 dark:border-zinc-900 text-[11px] text-zinc-600 dark:text-zinc-400">
        <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-600" /> Checklist realizado</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-amber-500 inline-block" /> Vencimento do ciclo (15 dias)</span>
        <span className="flex items-center gap-1.5">Hoje <span className="inline-block w-5 h-3 rounded bg-blue-50 border border-blue-300 dark:bg-blue-900/30 dark:border-blue-700" /></span>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[75vh]">
        <table className="border-collapse text-xs w-full">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-left font-bold text-zinc-600 dark:text-zinc-300 w-[150px] min-w-[150px]">
                Placa
              </th>
              {diasDaQuinzenaAtual.map(dia => {
                const isWeekend = dia.getDay() === 0 || dia.getDay() === 6;
                const isHoje = toISODate(dia) === hojeISO;
                return (
                  <th
                    key={dia.getDate()}
                    className={cn(
                      "sticky top-0 z-10 border border-zinc-200 dark:border-zinc-800 px-1 py-1.5 text-center font-semibold w-9",
                      isWeekend ? "bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300",
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
              const datasExecutadas = new Set(datasFeitasPorPlaca.get(v.placaNorm) || []);
              const cfg = STATUS_CONFIG[status];
              const rowBg = idx % 2 === 1 ? "bg-zinc-50/70 dark:bg-zinc-900/40" : "bg-white dark:bg-zinc-950";
              const diasLabel = diasRestantes === null ? "" : diasRestantes >= 0 ? `${diasRestantes}d` : `-${Math.abs(diasRestantes)}d`;
              const tituloStatus = `${cfg.label} — ${ultima ? `Últ.: ${fmtBR(ultima)}` : "Sem registro"}${diasRestantes !== null ? ` · ${diasRestantes >= 0 ? `vence em ${diasRestantes}d` : `${Math.abs(diasRestantes)}d atrasado`}` : ""}`;
              return (
                <tr key={v.id || v.placaNorm}>
                  <td className={cn("sticky left-0 z-10 border border-zinc-200 dark:border-zinc-800 px-3 py-1 w-[150px] min-w-[150px]", rowBg)} title={tituloStatus}>
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="min-w-0 truncate">
                        <span className="font-mono font-bold dark:text-white">{v.placaNorm}</span>
                        <span className="text-[9px] text-zinc-400 ml-1 uppercase">{v.tipo}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <cfg.Icon size={13} className={cfg.iconColor} />
                        {diasLabel && <span className="text-[9px] font-bold text-zinc-400">{diasLabel}</span>}
                      </div>
                    </div>
                  </td>
                  {diasDaQuinzenaAtual.map(dia => {
                    const iso = toISODate(dia);
                    const feito = datasExecutadas.has(iso);
                    const isVencimento = !feito && proxima === iso;
                    const registro = registroPorCelula.get(`${v.placaNorm}|${iso}`);
                    const titulo = registro
                      ? `${registro.colaborador} — ${fmtFullBR(iso)}${registro.horimetro != null ? ` · Horím.: ${registro.horimetro}` : ""}${registro.km != null ? ` · Km: ${registro.km}` : ""}`
                      : feito
                      ? `Checklist realizado em ${fmtBR(iso)}`
                      : isVencimento
                      ? "Data de vencimento do ciclo de 15 dias"
                      : canEdit
                      ? "Clique para lançar o checklist"
                      : undefined;
                    return (
                      <td
                        key={iso}
                        onClick={() => abrirCelula(v, iso)}
                        className={cn(
                          "border border-zinc-200 dark:border-zinc-800 text-center p-0.5 h-8",
                          rowBg,
                          canEdit && "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20"
                        )}
                        title={titulo}
                      >
                        {feito ? (
                          <div className="flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-green-600" />
                          </div>
                        ) : isVencimento ? (
                          <div className="flex items-center justify-center">
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
                <td colSpan={1 + diasDaQuinzenaAtual.length} className="text-center py-8 text-zinc-500">
                  Nenhum veículo encontrado (Comboio/Pipa/Multifuncional/Munck).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-base font-bold dark:text-white">Checklist — {modalCell.placa}</h3>
                <p className="text-xs text-zinc-500">{modalCell.tipo} · {fmtFullBR(modalCell.iso)}</p>
              </div>
              <button onClick={fecharModal} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-full">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Colaborador que realizou *</label>
                <input
                  type="text"
                  value={colaborador}
                  onChange={e => setColaborador(e.target.value)}
                  placeholder="Nome do colaborador"
                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Horímetro</label>
                  <input
                    type="number"
                    value={horimetro}
                    onChange={e => setHorimetro(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Km</label>
                  <input
                    type="number"
                    value={km}
                    onChange={e => setKm(e.target.value)}
                    placeholder="0"
                    className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              {erro && <p className="text-xs text-red-600 font-medium">{erro}</p>}

              <div className="flex items-center justify-between gap-3 pt-2">
                {modalCell.registroExistente && canDelete ? (
                  <button
                    onClick={handleExcluir}
                    disabled={deleting || saving}
                    className="px-3 py-2 text-xs font-bold text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center gap-1.5 hover:bg-red-100 disabled:opacity-60"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Excluir
                  </button>
                ) : <span />}
                <button
                  onClick={handleSalvar}
                  disabled={saving || deleting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
