"use client";

import { useState, useMemo } from "react";
import {
  Plus, X, Camera, Trash2, Filter, CheckCircle2, AlertTriangle, History, Loader2, List,
  LayoutDashboard, Image as ImageIcon, Percent, Boxes,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from "recharts";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import {
  ControleFiltroImplemento, FiltroImplementoFoto,
  salvarLancamentoFiltroImplemento, excluirLancamentoFiltroImplemento,
} from "./actions";

// Filtro absoluto (combustível) só existe fisicamente em Comboio e Skid — os demais
// tipos de implemento (Pipa, Multifuncional, Munck) não têm esse componente.
const TIPOS_IMPLEMENTO = ["COMBOIO", "SKID"] as const;
const TIPO_LABEL: Record<string, string> = {
  COMBOIO: "Comboio", SKID: "Skid",
};
// Paleta validada (dataviz skill) — par categórico Comboio/Skid com separação segura
// pra daltonismo (CVD ΔE >= 15 no modo normal), diferente das cores de status
// (verde/âmbar) já usadas nos badges Instalado/Pendente desta tela.
const TIPO_CHART_COLOR: Record<string, string> = { COMBOIO: "#2a78d6", SKID: "#1baf7a" };
const COR_INSTALADO = "#059669";
const COR_PENDENTE = "#f59e0b";

// ── Compressão de foto (1280px / JPEG 70%) — mesmo padrão do Checklist de Frota ──
function compress(file: File): Promise<FiltroImplementoFoto | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      let w = img.naturalWidth, h = img.naturalHeight;
      const r = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * r); h = Math.round(h * r);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ d: c.toDataURL("image/jpeg", 0.7), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
async function readFiles(files: FileList | null): Promise<FiltroImplementoFoto[]> {
  if (!files) return [];
  const out: FiltroImplementoFoto[] = [];
  for (const f of Array.from(files)) { const p = await compress(f); if (p) out.push(p); }
  return out;
}

function diasDesde(dataStr: string): number {
  const d = new Date(dataStr + "T00:00:00");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoje.getTime() - d.getTime()) / 86400000));
}
function fmtDataBr(d: string) {
  if (!d) return "-";
  const [a, m, dd] = d.split("-");
  return dd && m && a ? `${dd}/${m}/${a}` : d;
}

function FotoMultiSlot({ photos, onAdd, onRemove, onExpand, readOnly }: {
  photos: FiltroImplementoFoto[]; onAdd?: (files: FileList | null) => void; onRemove?: (i: number) => void; onExpand: (d: string) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {photos.map((p, i) => (
        <div key={i} className="relative w-14 h-14 rounded overflow-hidden border border-zinc-200 dark:border-zinc-700 group">
          <img src={p.d} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => onExpand(p.d)} />
          {!readOnly && onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-4 text-center">×</button>
          )}
        </div>
      ))}
      {!readOnly && onAdd && (
        <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline h-14 px-2 border border-dashed border-blue-300 dark:border-blue-800 rounded">
          <Camera size={13} /> {photos.length > 0 ? `+${photos.length}` : "Evidência"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

type FormState = { placa: string; data_troca: string; observacoes: string; evidencias: FiltroImplementoFoto[] };
function formVazio(placa = ""): FormState {
  return { placa, data_troca: new Date().toISOString().slice(0, 10), observacoes: "", evidencias: [] };
}

export default function ControleFiltrosClient({
  isVisitante, initialLancamentos, equipamentos,
}: { isVisitante: boolean; initialLancamentos: ControleFiltroImplemento[]; equipamentos: any[] }) {
  const { isOnline } = useOffline();
  const [lancamentos, setLancamentos] = useState<ControleFiltroImplemento[]>(initialLancamentos);
  const [modalOpen, setModalOpen] = useState(false);
  const [historicoPlaca, setHistoricoPlaca] = useState<string | null>(null);
  const [view, setView] = useState<"planilha" | "dashboard" | "fotos" | "historico">("planilha");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "INSTALADO" | "PENDENTE">("TODOS");
  const [loading, setLoading] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(formVazio());

  const equipamentosFiltro = useMemo(
    () => equipamentos.filter(e => TIPOS_IMPLEMENTO.includes((e.tipo || "").toUpperCase() as any) && e.status !== "Inativo" && !e.deleted_at),
    [equipamentos]
  );

  // Último lançamento (mais recente) por placa
  const ultimoPorPlaca = useMemo(() => {
    const map: Record<string, ControleFiltroImplemento> = {};
    lancamentos.forEach(l => {
      const atual = map[l.placa];
      if (!atual || l.data_troca > atual.data_troca) map[l.placa] = l;
    });
    return map;
  }, [lancamentos]);

  const linhasTodas = useMemo(() => {
    return equipamentosFiltro
      .filter(e => filtroTipo === "TODOS" || (e.tipo || "").toUpperCase() === filtroTipo)
      .map(e => {
        const placa = e.placa as string;
        const ultimo = ultimoPorPlaca[placa];
        const qtd = lancamentos.filter(l => l.placa === placa).length;
        return {
          placa, tipo: (e.tipo || "").toUpperCase(), modulo: e.modulo || "-", area: e.area || "-",
          ultimo, dias: ultimo ? diasDesde(ultimo.data_troca) : null, qtd,
        };
      })
      .sort((a, b) => a.placa.localeCompare(b.placa));
  }, [equipamentosFiltro, ultimoPorPlaca, lancamentos, filtroTipo]);

  const linhas = useMemo(
    () => linhasTodas.filter(l => filtroStatus === "TODOS" || (filtroStatus === "INSTALADO" ? !!l.ultimo : !l.ultimo)),
    [linhasTodas, filtroStatus]
  );

  const totalOk = linhasTodas.filter(l => l.ultimo).length;

  const historicoGeral = useMemo(() => {
    return lancamentos
      .filter(l => filtroTipo === "TODOS" || (l.tipo_equipamento || "").toUpperCase() === filtroTipo)
      .slice()
      .sort((a, b) => b.data_troca.localeCompare(a.data_troca) || (b.created_at || "").localeCompare(a.created_at || ""));
  }, [lancamentos, filtroTipo]);

  const totalPendentes = linhasTodas.length - totalOk;
  const pctInstalado = linhasTodas.length > 0 ? Math.round((totalOk / linhasTodas.length) * 100) : 0;

  // Status geral (Instalado x Pendente) — respeita o filtro de tipo selecionado acima.
  const statusPieData = useMemo(() => ([
    { name: "Instalado", value: totalOk },
    { name: "Pendente", value: totalPendentes },
  ]), [totalOk, totalPendentes]);

  // Comboio x Skid — sempre os dois tipos lado a lado, mesmo com o filtro de tipo ativo,
  // já que o propósito do gráfico é justamente comparar os dois.
  const porTipoData = useMemo(() => {
    return TIPOS_IMPLEMENTO.map(tipo => {
      const doTipo = equipamentosFiltro.filter(e => (e.tipo || "").toUpperCase() === tipo);
      const instalado = doTipo.filter(e => !!ultimoPorPlaca[e.placa]).length;
      return { tipo, label: TIPO_LABEL[tipo], instalado, pendente: doTipo.length - instalado };
    });
  }, [equipamentosFiltro, ultimoPorPlaca]);

  // Trocas lançadas por mês (últimos 6 meses com lançamento) — respeita o filtro de tipo.
  const trocasPorMesData = useMemo(() => {
    const map: Record<string, number> = {};
    historicoGeral.forEach(l => {
      const mes = (l.data_troca || "").slice(0, 7);
      if (!mes) return;
      map[mes] = (map[mes] || 0) + 1;
    });
    const MESES_ABR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return Object.entries(map)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([mes, qtd]) => {
        const [ano, m] = mes.split("-");
        return { name: `${MESES_ABR[Number(m) - 1]}/${ano.slice(2)}`, qtd };
      });
  }, [historicoGeral]);

  // Lançamentos com evidência fotográfica — respeita o filtro de tipo.
  const lancamentosComFoto = useMemo(
    () => historicoGeral.filter(l => l.evidencias && l.evidencias.length > 0),
    [historicoGeral]
  );

  const abrirLancamento = (placaPreenchida?: string) => {
    setForm(formVazio(placaPreenchida));
    setErroMsg(null);
    setModalOpen(true);
  };

  const addFotos = async (files: FileList | null) => {
    const novas = await readFiles(files);
    setForm(prev => ({ ...prev, evidencias: [...prev.evidencias, ...novas] }));
  };
  const delFoto = (i: number) => setForm(prev => ({ ...prev, evidencias: prev.evidencias.filter((_, x) => x !== i) }));

  const handleSalvar = async () => {
    setErroMsg(null);
    if (!form.placa.trim()) { setErroMsg("Selecione a placa."); return; }
    if (!form.data_troca) { setErroMsg("Informe a data da troca."); return; }

    setLoading(true);
    try {
      const eq = equipamentosFiltro.find(e => e.placa === form.placa);
      const payload = {
        placa: form.placa.toUpperCase(),
        tipo_equipamento: eq?.tipo || null,
        data_troca: form.data_troca,
        evidencias: form.evidencias,
        observacoes: form.observacoes.trim() || null,
      };

      if (isOnline) {
        const res = await salvarLancamentoFiltroImplemento(payload);
        if (res && "error" in res) throw new Error(res.error);
        const saved = (res as any).data;
        setLancamentos(prev => [saved, ...prev]);
        await localDb.put("controle_filtros_implemento", saved);
      } else {
        const tempId = `temp_cfi_${Date.now()}`;
        const novo = { id: tempId, ...payload, filial_id: "MATRIZ", _isPendingSync: true };
        await localDb.put("controle_filtros_implemento", novo);
        await localDb.addToQueue("controle_filtros_implemento", "create", payload);
        setLancamentos(prev => [novo as any, ...prev]);
        alert("✅ Lançamento salvo localmente! Sincronizará automaticamente quando restabelecer conexão.");
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-controle_filtros_implemento"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      setModalOpen(false);
    } catch (err: any) {
      setErroMsg("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      if (isOnline) {
        const res = await excluirLancamentoFiltroImplemento(id);
        if (res && "error" in res) { alert(res.error); return; }
        await localDb.delete("controle_filtros_implemento", id);
      } else {
        await localDb.delete("controle_filtros_implemento", id);
        await localDb.addToQueue("controle_filtros_implemento", "delete", { id });
      }
      setLancamentos(prev => prev.filter(l => l.id !== id));
      window.dispatchEvent(new CustomEvent("offline-db-updated-controle_filtros_implemento"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  };

  const historicoLista = useMemo(
    () => historicoPlaca ? lancamentos.filter(l => l.placa === historicoPlaca).sort((a, b) => b.data_troca.localeCompare(a.data_troca)) : [],
    [historicoPlaca, lancamentos]
  );

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Filter className="text-blue-500" size={24} /> Controle de Filtros do Implemento
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Controle de instalação e troca do filtro absoluto — Comboio e Skid
          </p>
        </div>
        {!isVisitante && (
          <button onClick={() => abrirLancamento()} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> Novo Lançamento
          </button>
        )}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shrink-0"><Boxes size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Equipamentos</p>
            <p className="text-xl font-black text-zinc-800 dark:text-zinc-100 leading-tight">{linhasTodas.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0"><CheckCircle2 size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Instalados</p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-tight">{totalOk}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0"><AlertTriangle size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">Pendentes</p>
            <p className="text-xl font-black text-amber-700 dark:text-amber-400 leading-tight">{totalPendentes}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0"><Percent size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate">% Instalado</p>
            <p className="text-xl font-black text-indigo-700 dark:text-indigo-400 leading-tight">{pctInstalado}%</p>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 flex-wrap">
        <button
          onClick={() => setView("planilha")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "planilha" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <List size={15} /> Planilha
        </button>
        <button
          onClick={() => setView("dashboard")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "dashboard" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <LayoutDashboard size={15} /> Dashboard
        </button>
        <button
          onClick={() => setView("fotos")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "fotos" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <ImageIcon size={15} /> Fotos {lancamentosComFoto.length > 0 && `(${lancamentosComFoto.length})`}
        </button>
        <button
          onClick={() => setView("historico")}
          className={cn("flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors",
            view === "historico" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
        >
          <History size={15} /> Histórico
        </button>
      </div>

      {/* Filtro por tipo */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden w-fit flex-wrap">
          {["TODOS", ...TIPOS_IMPLEMENTO].map(t => (
            <button key={t} type="button" onClick={() => setFiltroTipo(t)} className={cn("px-4 py-2 text-xs font-bold whitespace-nowrap", filtroTipo === t ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400")}>
              {t === "TODOS" ? "Todos" : TIPO_LABEL[t]}
            </button>
          ))}
        </div>
        {view === "planilha" && (
          <div className="flex border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden w-fit flex-wrap">
            {(["TODOS", "INSTALADO", "PENDENTE"] as const).map(s => (
              <button key={s} type="button" onClick={() => setFiltroStatus(s)} className={cn("px-4 py-2 text-xs font-bold whitespace-nowrap", filtroStatus === s ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400")}>
                {s === "TODOS" ? "Todos os status" : s === "INSTALADO" ? "Instalado" : "Pendente"}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "planilha" && (
      <>
      {/* Planilha */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Placa", "Tipo", "Módulo/Área", "Status", "Última troca", "Dias desde a troca", "Lançamentos", "Ação"].map(h => (
                  <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap", h === "Ação" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {linhas.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum equipamento encontrado</td></tr>
              ) : linhas.map(l => (
                <tr key={l.placa} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{l.placa}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{TIPO_LABEL[l.tipo] || l.tipo}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.modulo}{l.area && l.area !== "-" ? ` · ${l.area}` : ""}</td>
                  <td className="px-3 py-2.5">
                    {l.ultimo ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 border border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 whitespace-nowrap"><CheckCircle2 size={11} /> Instalado</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 border border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 whitespace-nowrap"><AlertTriangle size={11} /> Pendente</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.ultimo ? fmtDataBr(l.ultimo.data_troca) : "-"}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.dias != null ? `${l.dias} dia(s)` : "-"}</td>
                  <td className="px-3 py-2.5">
                    {l.qtd > 0 ? (
                      <button onClick={() => setHistoricoPlaca(l.placa)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"><History size={12} /> {l.qtd}</button>
                    ) : <span className="text-zinc-300 dark:text-zinc-700">0</span>}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      {!isVisitante && (
                        <button title="Lançar troca" onClick={() => abrirLancamento(l.placa)} className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><Plus size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{linhas.length} equipamento(s)</div>
      </div>
      </>
      )}

      {view === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Status Geral */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Status Geral</h3>
            <p className="text-[11px] text-zinc-400 mb-3">
              Instalado x Pendente{filtroTipo !== "TODOS" ? ` — ${TIPO_LABEL[filtroTipo]}` : ""}
            </p>
            {linhasTodas.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-zinc-400 font-semibold uppercase tracking-wide">Sem dados</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={statusPieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {statusPieData.map(entry => (
                      <Cell key={entry.name} fill={entry.name === "Instalado" ? COR_INSTALADO : COR_PENDENTE} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} equip.`, n]} />
                  <Legend verticalAlign="bottom" height={28} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Comboio x Skid */}
          <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Comboio x Skid</h3>
            <p className="text-[11px] text-zinc-400 mb-3">Sempre os dois tipos, mesmo com o filtro de tipo ativo</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porTipoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} opacity={0.5} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend verticalAlign="top" align="right" height={24} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
                <Bar dataKey="instalado" name="Instalado" fill={COR_INSTALADO} radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="pendente" name="Pendente" fill={COR_PENDENTE} radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Trocas por mês */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Trocas Lançadas por Mês</h3>
            <p className="text-[11px] text-zinc-400 mb-3">
              Últimos meses com lançamento{filtroTipo !== "TODOS" ? ` — ${TIPO_LABEL[filtroTipo]}` : ""}
            </p>
            {trocasPorMesData.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-zinc-400 font-semibold uppercase tracking-wide">Sem lançamentos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trocasPorMesData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} opacity={0.5} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" name="Trocas" fill={TIPO_CHART_COLOR.COMBOIO} radius={[4, 4, 0, 0]} barSize={32}>
                    <LabelList dataKey="qtd" position="top" fontSize={11} fontWeight={700} fill="#52525b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {view === "fotos" && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          {lancamentosComFoto.length === 0 ? (
            <div className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhuma evidência fotográfica encontrada</div>
          ) : (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {lancamentosComFoto.map(l => (
                <div key={l.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{l.placa}</span>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">
                      {TIPO_LABEL[(l.tipo_equipamento || "").toUpperCase()] || l.tipo_equipamento || "-"}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mb-2">
                    {fmtDataBr(l.data_troca)}{l.observacoes ? ` · ${l.observacoes}` : ""}
                  </p>
                  <FotoMultiSlot photos={l.evidencias} onExpand={setFotoExpandida} readOnly />
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{lancamentosComFoto.length} lançamento(s) com foto</div>
        </div>
      )}

      {view === "historico" && (
        <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  {["Data da troca", "Placa", "Tipo", "Observações", "Evidência", "Lançado por", "Ação"].map(h => (
                    <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider whitespace-nowrap", h === "Ação" ? "text-right" : "text-left")}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
                {historicoGeral.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum lançamento encontrado</td></tr>
                ) : historicoGeral.map(l => (
                  <tr key={l.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors align-top">
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{fmtDataBr(l.data_troca)}</td>
                    <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200 whitespace-nowrap">{l.placa}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{TIPO_LABEL[(l.tipo_equipamento || "").toUpperCase()] || l.tipo_equipamento || "-"}</td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 max-w-xs">{l.observacoes || "-"}</td>
                    <td className="px-3 py-2.5">
                      {l.evidencias?.length > 0 ? <FotoMultiSlot photos={l.evidencias} onExpand={setFotoExpandida} readOnly /> : <span className="text-zinc-300 dark:text-zinc-700">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{l.criado_por_nome || "-"}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {!isVisitante && (
                          <button title="Excluir" onClick={() => setDeletingId(l.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{historicoGeral.length} lançamento(s)</div>
        </div>
      )}

      {/* Modal de lançamento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b dark:border-zinc-800 flex justify-between items-center gap-4 bg-white dark:bg-zinc-950">
              <h2 className="text-lg font-bold dark:text-white">Novo Lançamento de Filtro</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full shrink-0"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1 after:content-['_*'] after:text-red-500">Placa</label>
                <select value={form.placa} onChange={e => setForm(prev => ({ ...prev, placa: e.target.value }))} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Selecione...</option>
                  {TIPOS_IMPLEMENTO.map(tipo => {
                    const opts = equipamentosFiltro.filter(e => (e.tipo || "").toUpperCase() === tipo);
                    if (!opts.length) return null;
                    return (
                      <optgroup key={tipo} label={TIPO_LABEL[tipo]}>
                        {opts.map((e, i) => <option key={i} value={e.placa}>{e.placa} ({e.modulo || e.area || "-"})</option>)}
                      </optgroup>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1 after:content-['_*'] after:text-red-500">Data da troca</label>
                <input type="date" value={form.data_troca} onChange={e => setForm(prev => ({ ...prev, data_troca: e.target.value }))} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))} rows={3} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none resize-y" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1">Evidência (foto)</label>
                <FotoMultiSlot photos={form.evidencias} onAdd={addFotos} onRemove={delFoto} onExpand={setFotoExpandida} />
              </div>
            </div>

            <div className="p-4 border-t dark:border-zinc-800 bg-white dark:bg-zinc-950">
              {erroMsg && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold">{erroMsg}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-zinc-300">Cancelar</button>
                <button type="button" onClick={handleSalvar} disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-60">
                  {loading && <Loader2 className="animate-spin" size={18} />} Salvar Lançamento
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Histórico por placa */}
      {historicoPlaca && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b dark:border-zinc-800 flex justify-between items-center gap-4">
              <h2 className="text-lg font-bold dark:text-white">Histórico — {historicoPlaca}</h2>
              <button onClick={() => setHistoricoPlaca(null)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full shrink-0"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3">
              {historicoLista.map(l => (
                <div key={l.id} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{fmtDataBr(l.data_troca)}</span>
                    {!isVisitante && (
                      <button title="Excluir" onClick={() => setDeletingId(l.id)} className="p-1 rounded text-zinc-400 hover:text-red-600 dark:hover:text-red-400"><Trash2 size={13} /></button>
                    )}
                  </div>
                  {l.observacoes && <p className="text-xs text-zinc-500 mt-1">{l.observacoes}</p>}
                  {l.criado_por_nome && <p className="text-[11px] text-zinc-400 mt-1">Lançado por: {l.criado_por_nome}</p>}
                  {l.evidencias?.length > 0 && <FotoMultiSlot photos={l.evidencias} onExpand={setFotoExpandida} readOnly />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {fotoExpandida && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm p-4" onClick={() => setFotoExpandida(null)}>
          <button onClick={() => setFotoExpandida(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><X size={24} /></button>
          <img src={fotoExpandida} alt="Evidência ampliada" className="max-w-full max-h-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Confirmação de exclusão */}
      {deletingId && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Tem certeza que deseja excluir este lançamento?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
