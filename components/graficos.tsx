"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine,
  LineChart, Line, Area, AreaChart
} from "recharts";
import {
  X, Truck, ClipboardList, CheckCircle2, Clock,
  Wrench, TrendingUp, AlertTriangle, Loader2, FileText, Printer,
  Maximize2, Minimize2
} from "lucide-react";
import { getOSporCategoriaV3 } from "@/app/actions/os-categoria";
import type { VeiculoDisp, PreventivaStatus } from "@/app/actions/dashboard";
import type { OrdemServicoResumo } from "@/app/actions/os-placa";
import OSFichaModal, { type OSFichaData } from "@/app/os/OSFicha";
import { useTheme } from "./theme-provider";

// ─── helpers ────────────────────────────────────────────────────────────────
function getColorDisp(val: number) {
  if (val >= 95) return "#22c55e";
  if (val >= 90) return "#f59e0b";
  return "#ef4444";
}
function getColorPrev(status: string) {
  if (status === "atrasado") return "#ef4444";
  if (status === "atencao") return "#f59e0b";
  return "#22c55e";
}
function statusBadge(s: string) {
  if (s === "Aberta") return "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30";
  if (s === "Fechada") return "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30";
  return "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-600";
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface VeiculoDetalhe {
  placa: string;
  nome: string;
  disp: number; // For plotting
  dispDM: number;
  dispDO: number;
  totalOS: number;
  osFechadas: number;
  horasManut: number;
  horasOperacional: number;
  hTotalDM: number;
  hTotalDO: number;
  horasDisponiveisOperacional: number;
  historicoDiario?: { 
    data: string; 
    hTotalDM: number; 
    hIndispDM: number; 
    hTotalDO: number; 
    hIndispDO: number;
    disponibilidadeDM: number;
    disponibilidadeDO: number;
  }[];
  osImpactantes?: string[];
}

function ModalDetalhe({
  veiculo,
  mes,
  ano,
  dataInicio,
  dataFim,
  onClose,
}: {
  veiculo: VeiculoDetalhe;
  mes?: number;
  ano?: number;
  dataInicio?: string;
  dataFim?: string;
  onClose: () => void;
}) {
  const [osList, setOsList] = useState<OrdemServicoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fichaOS, setFichaOS] = useState<OSFichaData | null>(null);

  const osAbertas = veiculo.totalOS - veiculo.osFechadas;
  const mttr =
    veiculo.osFechadas > 0
      ? (veiculo.horasManut / veiculo.osFechadas).toFixed(1)
      : "—";
  const displayDisp = veiculo.dispDM; // Use DM for main status badge color/label
  const dispColor = getColorDisp(displayDisp);
  const dispLabel = displayDisp >= 95 ? "Operacional" : displayDisp >= 90 ? "Atenção" : "Crítico";

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    import("@/app/actions/os-placa").then(({ buscarOSporPlaca }) =>
      buscarOSporPlaca(veiculo.placa, mes, ano, dataInicio, dataFim)
    ).then((data) => {
      if (!cancelled) { setOsList(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setOsList([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [veiculo.placa, mes, ano, dataInicio, dataFim]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md" onClick={onClose} />

      {/* Ficha Modal (sobreposto) */}
      {fichaOS && (
        <OSFichaModal os={fichaOS} onClose={() => setFichaOS(null)} />
      )}

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-2xl bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden flex flex-col"
        style={{ maxHeight: "95vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 transition-colors"
          style={{ background: `linear-gradient(135deg, ${dispColor}15, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `${dispColor}15` }}>
              <Truck className="w-5 h-5" style={{ color: dispColor }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{veiculo.nome}</h2>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${dispColor}15`, color: dispColor }}
              >
                {dispLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 pt-2 flex flex-col gap-3">

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-3 flex flex-col shadow-sm">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">DM (Mecânica)</p>
              <p className="text-3xl font-black" style={{ color: getColorDisp(veiculo.dispDM) }}>
                {(veiculo.dispDM || 0).toFixed(1)}%
              </p>
              <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/30">
                <p className="text-[9px] text-zinc-500">Horas Totais: {Number(veiculo.hTotalDM || 0)}h</p>
                <p className="text-[9px] text-red-500 dark:text-red-400/70">Parado: {Number(veiculo.horasManut || 0)}h</p>
                <p className="text-[8px] text-zinc-400 dark:text-zinc-600 mt-1 italic">{(Number(veiculo.hTotalDM || 0) - Number(veiculo.horasManut || 0)).toFixed(1)}h disp. / {Number(veiculo.hTotalDM || 0)}h total</p>
              </div>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-100 dark:border-zinc-700">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-zinc-400 text-[10px] uppercase font-bold tracking-wider">DO (OPERACIONAL)</h4>
                <span className="text-orange-500 font-mono text-xs font-bold bg-orange-500/10 px-2 py-0.5 rounded">PCM</span>
              </div>
              <div className="text-4xl font-black text-orange-500 mb-4">{(veiculo.dispDO || 0).toFixed(1)}%</div>
              <div className="space-y-2">
                <p className="text-[9px] text-zinc-500">Carga Horária: {Number(veiculo.hTotalDO || 0)}h</p>
                <p className="text-[9px] text-red-500/80">Indisp. no Turno: {Number(veiculo.horasOperacional || 0)}h</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-1">Disponibilidade Real: {Number(veiculo.horasDisponiveisOperacional || 0)}h</p>
                <p className="text-[10px] text-zinc-400 italic">
                  {Number(veiculo.horasDisponiveisOperacional || 0)}h disp. / {Number(veiculo.hTotalDO || 0)}h turno
                </p>
              </div>
            </div>
          </div>

          {/* ── Bloco — Memória de Cálculo ── */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-3">
              <Clock size={16} />
              <h4 className="font-black text-xs uppercase tracking-widest">MEMÓRIA DE CÁLCULO PCM</h4>
            </div>
            <div className="text-[11px] space-y-2">
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                <b>DM:</b> Mede o estado mecânico sobre 24h. Formula: ((T - H_Manut) / T) × 100 onde T = 24h × {Math.max(1, Math.round(Number(veiculo.hTotalDM || 0) / 24))} dias.
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                <b>DO:</b> Mede o impacto na produção. Formula: ((CH - H_Indisp) / CH) × 100 onde CH = {Number(veiculo.hTotalDO || 0) > 0 ? (Number(veiculo.hTotalDO || 0) / Math.max(1, Math.round(Number(veiculo.hTotalDM || 0) / 24))).toFixed(1) : "0"}h/dia.
              </p>
              <div className="bg-white/50 dark:bg-zinc-900/50 p-3 rounded border border-blue-100 dark:border-blue-900/30 mt-2">
                <p className="text-blue-800 dark:text-blue-300 font-bold mb-1">EXEMPLO DE TURNO (08:00H ÀS 16:00H):</p>
                <p className="text-zinc-500 dark:text-zinc-500 italic">"Se o caminhão quebrar às 13:00h, ele ficará indisponível por 3 horas durante a carga horária operacional. Se quebrar após as 16:00h, não há impacto na DO."</p>
              </div>
            </div>
          </div>

          {/* ── Histórico Diário (Novo) */}
          {veiculo.historicoDiario && veiculo.historicoDiario.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden">
               <div className="bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 border-b border-zinc-200 dark:border-zinc-700/50">
                  <h3 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">HISTÓRICO DE PERFORMANCE DIÁRIA</h3>
               </div>
               <div className="max-h-[180px] overflow-y-auto">
                 <table className="w-full text-[10px] text-left border-collapse">
                   <thead className="sticky top-0 bg-white dark:bg-[#1a1f2e] shadow-sm">
                     <tr className="text-zinc-500 uppercase tracking-tighter font-bold">
                       <th className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">DATA</th>
                       <th className="px-2 py-2 border-b border-zinc-100 dark:border-zinc-800 text-center">PROGRAMADO</th>
                       <th className="px-2 py-2 border-b border-zinc-100 dark:border-zinc-800 text-center">INDISP.</th>
                       <th className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 text-right">DO (%)</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                     {veiculo.historicoDiario.map((dia, idx) => (
                       <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                         <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 font-medium">{fmtDate(dia.data)}</td>
                         <td className="px-2 py-2 text-center text-zinc-500">{dia.hTotalDO}h</td>
                         <td className={`px-2 py-2 text-center font-bold ${dia.hIndispDO > 0 ? "text-red-500" : "text-emerald-500"}`}>
                           {dia.hIndispDO > 0 ? `${dia.hIndispDO}h` : "—"}
                         </td>
                         <td className="px-3 py-2 text-right font-bold" style={{ color: getColorDisp(dia.disponibilidadeDO) }}>
                           {dia.disponibilidadeDO}%
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>
          )}

          {/* ── KPI Grid 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-500/15">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">TOTAL DE OS</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{veiculo.totalOS}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">ORDENS DE SERVIÇO</p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-500/15">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">OS CONCLUÍDAS</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{veiculo.osFechadas}</p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">FECHADAS NO PERÍODO</p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${osAbertas > 0 ? "bg-amber-100 dark:bg-amber-500/15" : "bg-zinc-100 dark:bg-zinc-700/50"}`}>
                  <Clock className={`w-3.5 h-3.5 ${osAbertas > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500"}`} />
                </div>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">OS EM ABERTO</p>
              </div>
              <p className={`text-2xl font-bold ${osAbertas > 0 ? "text-amber-600 dark:text-amber-400" : "text-zinc-900 dark:text-zinc-100"}`}>
                {osAbertas}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                {osAbertas > 0 ? "⚠ ATENÇÃO NECESSÁRIA" : "NENHUMA PENDENTE"}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-500/15">
                  <Wrench className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">HS MANUTENÇÃO</p>
              </div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {veiculo.horasManut > 0 ? `${veiculo.horasManut}h` : "—"}
              </p>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">NO PERÍODO</p>
            </div>
          </div>

          {/* ── MTTR (full width) */}
          <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-500/15">
                <AlertTriangle className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">MTTR</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-500 uppercase tracking-wider">TEMPO MÉDIO DE REPARO</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-violet-600 dark:text-violet-400">
                {mttr}{mttr !== "—" ? "h" : ""}
              </span>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500">POR OS CONCLUÍDA</p>
            </div>
          </div>

            <div className="mt-6">
              <h3 className="font-black text-sm uppercase tracking-widest text-zinc-800 dark:text-zinc-200 mb-4 flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-500" />
                ORDENS DE SERVIÇO ({osList.length})
              </h3>
              
              {loading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">CARREGANDO DADOS...</span>
                </div>
              ) : osList.length > 0 ? (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse bg-white dark:bg-[#1a1f2e]">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-800/80 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                        <th className="px-4 py-3">DESCRIÇÃO DA ATIVIDADE</th>
                        <th className="px-3 py-3 text-center">STATUS</th>
                        <th className="px-3 py-3 text-center">MECÂNICA</th>
                        <th className="px-3 py-3 text-center">OPERACIONAL</th>
                        <th className="px-4 py-3 text-right">FICHA</th>
                      </tr>
                    </thead>
                    <tbody className="text-[11px] divide-y divide-zinc-100 dark:divide-zinc-800">
                      {osList.map((os: any) => {
                        const hMec = Number(os.horas_manutencao || 0);
                        const hOp = Number(os.horas_impacto_do || 0);
                        const isFechada = os.status === "Fechada" || os.status === "Concluída";
                        return (
                          <tr 
                            key={os.id} 
                            className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                            onClick={() => setFichaOS(os as any)}
                          >
                            <td className="px-4 py-3">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                <span className="opacity-50 text-[10px]">#{os.numero_os || os.id.slice(0,6)}</span>
                                {hOp > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Afeta Disponibilidade Operacional" />}
                              </div>
                              <div className="text-zinc-500 text-[10px] line-clamp-1 mt-0.5">{os.descricao || 'Atividade de manutenção'}</div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                isFechada ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-orange-100 text-orange-700 border border-orange-200'
                              }`}>
                                {os.status}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {hMec > 0 ? `${hMec.toFixed(1)}h` : '—'}
                            </td>
                            <td className={`px-3 py-3 text-center font-mono font-bold ${hOp > 0 ? 'text-red-500' : 'text-emerald-500 opacity-30'}`}>
                              {hOp > 0 ? `${hOp.toFixed(1)}h` : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button 
                                onClick={() => setFichaOS(os)}
                                className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-blue-500 hover:text-white transition-all"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-10 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700/50">
                  <ClipboardList className="w-8 h-8 text-zinc-200 mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium italic text-sm text-center">Nenhuma OS encontrada para este período.</p>
                </div>
              )}
            </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700/50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-700 dark:bg-zinc-800 hover:bg-zinc-600 dark:hover:bg-zinc-700 text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── FullscreenChartModal ────────────────────────────────────────────────────
function FullscreenChartModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Trava rolagem do body quando fullscreen está aberto
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{
        background: 'var(--bg-primary, #fff)',
        backgroundColor: 'white',
      }}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-zinc-200 dark:border-zinc-800"
        style={{
          background: 'linear-gradient(135deg, #1a5c1a, #2d8a2d)',
        }}
      >
        <div className="flex items-center gap-2">
          <Maximize2 className="w-4 h-4 text-emerald-200" />
          <span className="text-white font-bold text-sm uppercase tracking-wider truncate">
            {title}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-all"
        >
          <Minimize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Fechar Tela Cheia</span>
          <span className="sm:hidden">Fechar</span>
        </button>
      </div>

      {/* Área do gráfico sem rolagem, ocupando toda a tela restante */}
      <div className="flex-1 min-h-0 w-full p-4 relative bg-white dark:bg-[#0f1115] flex items-center justify-center">
        <div className="w-full h-full max-h-[50vh] max-w-[1600px]">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Disponibilidade Operacional ─────────────────────────────────────────────
interface GraficoVeiculosProps {
  dados?: VeiculoDisp[];
  periodoLabel?: string;
  mes?: number;
  ano?: number;
  dataInicio?: string;
  dataFim?: string;
  dataAtualizacao?: string;
  title?: string;
  mostrarIndisponibilidade?: boolean;
  tipoAvailability?: "DM" | "DO";
}

export function GraficoVeiculos({ 
  dados, 
  periodoLabel, 
  mes, 
  ano,
  dataInicio,
  dataFim, 
  dataAtualizacao,
  title = "Disponibilidade Operacional",
  mostrarIndisponibilidade = false,
  tipoAvailability = "DM"
}: GraficoVeiculosProps) {
  const [selected, setSelected] = useState<VeiculoDetalhe | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  const chartData = (dados ?? []).map((v) => {
    const isDO = tipoAvailability === "DO";
    const valBase = isDO ? v.disponibilidade_operacional : v.disponibilidade;
    
    let dispExibida = mostrarIndisponibilidade ? Number((100 - (valBase || 0)).toFixed(1)) : (valBase || 0);
    
    return {
      ...v,
      nome: v.placa,
      disp: dispExibida,
      dispDM: v.disponibilidade,
      dispDO: v.disponibilidade_operacional,
      totalOS: v.totalOS,
      osFechadas: v.osFechadas,
      horasManut: v.horasManut,
      horasOperacional: v.horasOperacional,
    };
  });


  if (chartData.length === 0) {
    return (
      <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
            {String(title).toUpperCase()}
          </h3>
          {periodoLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
              {periodoLabel}
            </span>
          )}
        </div>
        <div className="flex items-center justify-center h-[140px] text-zinc-400 text-sm">
          Nenhum veículo com OS lançada no período selecionado.
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white dark:bg-[#1a1f2e] rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs pointer-events-none">
        <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-1.5">{d.nome}</p>
        <div className="flex flex-col gap-1 text-zinc-700 dark:text-zinc-400">
          <p className="flex justify-between gap-4">
            <span>DM (Mecânica):</span>
            <span className="font-semibold" style={{ color: getColorDisp(d.dispDM) }}>
              {d.dispDM}%
            </span>
          </p>
          <p className="flex justify-between gap-4">
            <span>DO (Operacional):</span>
            <span className="font-semibold" style={{ color: getColorDisp(d.dispDO) }}>
              {d.dispDO}%
            </span>
          </p>
          <div className="h-[1px] bg-zinc-200 dark:bg-zinc-700/50 my-1" />
          <p>
            Total de OS: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.totalOS}</span>
          </p>
          <p>
            Hs Manut (Impacto DM): <span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.horasManut}h</span>
          </p>
          <p>
            Hs Indisp (Impacto DO): <span className="font-semibold text-zinc-800 dark:text-zinc-200">{d.horasOperacional}h</span>
          </p>
        </div>
        <p className="mt-2 text-[10px] text-zinc-500 dark:text-zinc-600 italic">Clique para ver detalhes e OS</p>
      </div>
    );
  };

  return (
    <>
      {selected && (
        <ModalDetalhe
          veiculo={selected}
          mes={mes}
          ano={ano}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Fullscreen modal */}
      {fullscreen && (
        <FullscreenChartModal
          title={String(title).toUpperCase()}
          onClose={() => setFullscreen(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 24, right: 16, left: -16, bottom: 60 }}
              barCategoryGap="10%"
              onClick={(data) => {
                if (data?.activePayload?.[0]?.payload?.nome) {
                  const p = data.activePayload[0].payload.nome;
                  const found = chartData.find(d => d.placa === p);
                  if (found) { setSelected(found as any); setFullscreen(false); }
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="nome" tick={{ fontSize: chartData.length > 20 ? 8 : 10, fill: tickColor, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: gridColor }} interval={0} angle={-45} textAnchor="end" dy={5} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: tickColor, fontWeight: 500 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="disp" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: isDark ? '#f8fafc' : '#0f172a', fontSize: chartData.length > 20 ? 8 : 10, fontWeight: 800, formatter: (v: number) => `${v}%` }}>
                {chartData.map((entry, index) => {
                  let color = '#3b82f6';
                  if (tipoAvailability === 'DM') {
                    color = mostrarIndisponibilidade ? (entry.disp > 0 ? '#ef4444' : '#e4e4e7') : getColorDisp(entry.dispDM);
                  } else {
                    color = mostrarIndisponibilidade ? (entry.disp > 0 ? '#ef4444' : '#e4e4e7') : getColorDisp(entry.dispDO);
                  }
                  return <Cell key={`fs-cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </FullscreenChartModal>
      )}

    <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
        <div className="flex flex-col gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
              {String(title).toUpperCase()}
            </h3>
            {periodoLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                {periodoLabel}
              </span>
            )}
            {dataAtualizacao && (
              <span className="text-[10px] px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-700 font-bold uppercase tracking-wider">
                ATU: {dataAtualizacao}
              </span>
            )}
            </div>
            <button
              onClick={() => setFullscreen(true)}
              title="Tela Cheia"
              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-500 dark:text-zinc-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-zinc-600 dark:text-zinc-500">
            {!mostrarIndisponibilidade ? (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> ≥ 95%
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> 90-94%
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> &lt; 90%
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Quanto maior, pior
                </div>
              </>
            )}
            <span className="text-zinc-400 dark:text-zinc-600 text-[10px] italic">
              Toque na barra para detalhes
            </span>
          </div>
        </div>

        {/* Rolagem horizontal para muitas barras no mobile/Android */}
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <div style={{ minWidth: Math.max(300, chartData.length * 52), width: "100%" }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 10, left: -20, bottom: 50 }}
                barCategoryGap="18%"
                onClick={(data) => {
                  if (data?.activePayload?.[0]?.payload?.nome) {
                    const p = data.activePayload[0].payload.nome;
                    const found = chartData.find(d => d.placa === p);
                    if (found) {
                      setSelected(found as any);
                    }
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={gridColor}
                />
                <XAxis
                  dataKey="nome"
                  tick={{ fontSize: 10, fill: tickColor, fontWeight: 600 }}
                  tickLine={false}
                  axisLine={{ stroke: gridColor }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  dy={5}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: tickColor, fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "rgba(148,163,184,0.08)" }}
                />
                <Bar
                  dataKey="disp"
                  radius={[3, 3, 0, 0]}
                  label={{
                    position: "top",
                    fill: isDark ? "#f8fafc" : "#0f172a", 
                    fontSize: 10,
                    fontWeight: 800,
                    formatter: (v: number) => `${v}%`,
                  }}
                >
                  {chartData.map((entry, index) => {
                    let color = "#3b82f6"; // default blue for DO
                    
                    if (tipoAvailability === "DM") {
                      color = mostrarIndisponibilidade 
                        ? (entry.disp > 0 ? "#ef4444" : "#e4e4e7") 
                        : getColorDisp(entry.dispDM);
                    } else {
                      // DO colors: Now using the same status palette as DM
                      color = mostrarIndisponibilidade 
                        ? (entry.disp > 0 ? "#ef4444" : "#e4e4e7") 
                        : getColorDisp(entry.dispDO);
                    }
                    
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Status das Preventivas ──────────────────────────────────────────────────
interface GraficoPreventigasProps {
  dados?: PreventivaStatus[];
}

const prevMock: PreventivaStatus[] = [
  { placa: "TWY2I61", horas_restantes: -990, status: "atrasado" },
  { placa: "TJJ3E07", horas_restantes: -171, status: "atrasado" },
  { placa: "PTV5G37", horas_restantes: -15, status: "atrasado" },
  { placa: "ROG1I38", horas_restantes: 15, status: "atencao" },
  { placa: "SGJ7I82", horas_restantes: 24, status: "atencao" },
  { placa: "TCN7J72", horas_restantes: 45, status: "atencao" },
  { placa: "ROG1I26", horas_restantes: 109, status: "no_prazo" },
  { placa: "LUC7J90", horas_restantes: 113, status: "no_prazo" },
  { placa: "ROE8F66", horas_restantes: 190, status: "no_prazo" },
];

export function GraficoPreventivas({ dados }: GraficoPreventigasProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  const source = dados && dados.length > 0 ? dados : prevMock;
  const chartData = source.map((p) => ({
    nome: p.placa,
    val: 1,
    text: `${p.horas_restantes > 0 ? "+" : ""}${p.horas_restantes}h`,
    status: p.status,
  }));

  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, index } = props;
    const text = chartData[index]?.text;
    return (
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        fill={isDark ? "#f8fafc" : "#0f172a"} 
        fontSize={10}
        textAnchor="middle"
        fontWeight={800}
      >
        {text}
      </text>
    );
  };

  return (
    <>
      {/* Fullscreen modal */}
      {fullscreen && (
        <FullscreenChartModal
          title="STATUS DAS PREVENTIVAS POR PLACA"
          onClose={() => setFullscreen(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 16, left: -20, bottom: 60 }} barCategoryGap="8%">
              <XAxis dataKey="nome" tick={{ fontSize: chartData.length > 20 ? 8 : 10, fill: tickColor, fontWeight: 600 }} tickLine={false} axisLine={{ stroke: gridColor }} interval={0} angle={-45} textAnchor="end" dy={5} />
              <YAxis domain={[0, 2]} tick={false} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ backgroundColor: isDark ? '#1a1f2e' : '#ffffff', borderColor: isDark ? '#3f3f46' : '#e2e8f0', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any, name: any, props: any) => [props.payload.text, 'Horas Restantes']} />
              <Bar dataKey="val" radius={[2, 2, 0, 0]} label={(props: any) => {
                const { x, y, width, height, index } = props;
                const text = chartData[index]?.text;
                return (
                  <text
                    x={x + width / 2}
                    y={y + height / 2 + 4}
                    fill={isDark ? "#f8fafc" : "#0f172a"} 
                    fontSize={chartData.length > 20 ? 8 : 10}
                    textAnchor="middle"
                    fontWeight={800}
                  >
                    {text}
                  </text>
                );
              }}>
                {chartData.map((entry, index) => (<Cell key={`fs-cell-${index}`} fill={getColorPrev(entry.status)} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </FullscreenChartModal>
      )}

    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
        <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          STATUS DAS PREVENTIVAS POR PLACA
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-zinc-500">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> ATRASADO
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> ATENÇÃO
            </div>
          </div>
          <button
            onClick={() => setFullscreen(true)}
            title="Tela Cheia"
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-500 hover:text-emerald-700 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {/* Rolagem horizontal para muitas barras no mobile/Android */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: Math.max(300, chartData.length * 52), width: "100%" }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 50 }}
              barCategoryGap="12%"
            >
              <XAxis
                dataKey="nome"
                tick={{ fontSize: 9, fill: tickColor, fontWeight: 600 }}
                tickLine={false}
                axisLine={{ stroke: gridColor }}
                interval={0}
                angle={-45}
                textAnchor="end"
                dy={5}
              />
              <YAxis domain={[0, 2]} tick={false} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "transparent" }}
                contentStyle={{
                  backgroundColor: isDark ? "#1a1f2e" : "#ffffff",
                  borderColor: isDark ? "#3f3f46" : "#e2e8f0",
                  borderRadius: "8px",
                  fontSize: "12px",
                  color: isDark ? "#f4f4f5" : "#18181b",
                }}
                itemStyle={{ color: isDark ? "#f4f4f5" : "#18181b" }}
                formatter={(v: any, name: any, props: any) => [
                  props.payload.text,
                  "Horas Restantes",
                ]}
              />
              <Bar dataKey="val" radius={[2, 2, 0, 0]} label={renderCustomBarLabel}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getColorPrev(entry.status)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Disponibilidade Semanal ──────────────────────────────────────────────────
const semanalMock = [
  { semana: "S1", disp: 99.8 }, { semana: "S2", disp: 99.6 },
  { semana: "S3", disp: 99.8 }, { semana: "S4", disp: 93.3 },
  { semana: "S5", disp: 99.1 },
];

interface GraficoSemanalProps {
  dados?: { semana: string; disp: number }[];
  periodoLabel?: string;
}

export function GraficoSemanal({ dados, periodoLabel }: GraficoSemanalProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  const chartData = dados && dados.length > 0 ? dados : semanalMock;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
          DISPONIBILIDADE POR SEMANA DO MÊS
          {periodoLabel && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium ml-2">
              {periodoLabel}
            </span>
          )}
        </h3>
        <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> ≥ 95%
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> 90-94%
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> &lt; 90%
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }} barSize={35}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke={gridColor}
          />
          <XAxis
            dataKey="semana"
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: tickColor }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ fill: "transparent" }}
            contentStyle={{
              backgroundColor: isDark ? "#1a1f2e" : "#ffffff",
              borderColor: isDark ? "#3f3f46" : "#e2e8f0",
              borderRadius: "8px",
              fontSize: "12px",
              color: isDark ? "#f4f4f5" : "#18181b",
            }}
            itemStyle={{ color: isDark ? "#f4f4f5" : "#18181b" }}
            formatter={(val) => [`${val}%`, "Disponibilidade"]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: "10px", paddingBottom: "10px", color: tickColor }}
          />
          <Bar
            dataKey="disp"
            radius={[3, 3, 0, 0]}
            label={{
              position: "top",
              fill: isDark ? "#94a3b8" : "#64748b",
              fontSize: 10,
              fontWeight: 600,
              formatter: (v: number) => `${v}%`,
            }}
          >
            {chartData.map((entry: { semana: string; disp: number }, index: number) => (
              <Cell key={`cell-${index}`} fill={getColorDisp(entry.disp)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Resumo de Horas ────────────────────────────────────────────────────────
interface ResumoHorasProps {
  horasManutencao?: number;
  totalEquipamentos?: number;
}

export function ResumoHoras({
  horasManutencao = 0,
  totalEquipamentos = 0,
}: ResumoHorasProps) {
  // Aplica regra D-1: considerar apenas até ontem
  const agora = new Date();
  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  const diasTranscorridos = Math.max(1, ontem.getDate());
  const horasPeriodo = diasTranscorridos * 24 * totalEquipamentos;
  const horasDisponiveis = Math.max(0, horasPeriodo - horasManutencao);

  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-6 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        RESUMO DE HORAS
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-zinc-500 font-medium">Horas de Manutenção</span>
          <span className="text-[26px] font-bold text-zinc-800 dark:text-zinc-100 leading-none">
            {horasManutencao > 0 ? `${horasManutencao}h` : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-zinc-500 font-medium">Horas Disponíveis</span>
          <span className="text-[26px] font-bold text-zinc-800 dark:text-zinc-100 leading-none">
            {horasDisponiveis > 0 ? `${horasDisponiveis.toFixed(1)}h` : "—"}
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] text-zinc-500 font-medium">Total de Equipamentos</span>
          <span className="text-[26px] font-bold text-zinc-800 dark:text-zinc-100 leading-none">
            {totalEquipamentos}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 13. Paradas por Categoria (Gráfico de Pizza) ───────────────────────────
const COLORS_PIE = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#6366f1", "#ec4899", "#8b5cf6"];

export function GraficoParadasCategoria({ dados }: { dados: { categoria: string; quantidade: number }[] }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        PARADAS POR CATEGORIA
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={dados}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="quantidade"
            nameKey="categoria"
            labelLine={false}
          >
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(val: number) => [`${val} OS`, "Quantidade"]}
            contentStyle={{ 
              backgroundColor: isDark ? "#1a1f2e" : "#ffffff", 
              border: `1px solid ${isDark ? "#3f3f46" : "#e2e8f0"}`, 
              borderRadius: "8px", 
              fontSize: "12px", 
              color: isDark ? "#fff" : "#18181b" 
            }}
            itemStyle={{ color: isDark ? "#f4f4f5" : "#18181b" }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: isDark ? '#a1a1aa' : '#64748b' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatarTempoManut(horasDec: number): string {
  if (horasDec <= 0) return "—";
  
  const totalMinutos = Math.round(horasDec * 60);
  const dias = Math.floor(totalMinutos / (24 * 60));
  const horas = Math.floor((totalMinutos % (24 * 60)) / 60);
  const mins = totalMinutos % 60;
  
  const partes = [];
  if (dias > 0) {
    partes.push(dias === 1 ? "1 dia" : `${dias} dias`);
  }
  if (horas > 0) {
    partes.push(`${horas}h`);
  }
  if (mins > 0) {
    partes.push(`${mins}min`);
  }
  
  if (partes.length === 3) {
    return `${partes[0]}, ${partes[1]} e ${partes[2]}`;
  }
  return partes.join(" e ");
}

// ─── 14. Ranking de Falhas (Tabela) ──────────────────────────────────────────
export function RankingFalhas({ dados }: { dados: { placa: string; falhas: number; mttr?: number; mtbf: number; diasManut?: number }[] }) {
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        Ranking de Falhas (Top 10)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <th className="pb-3 px-2 font-medium">Equipamento</th>
              <th className="pb-3 px-2 font-medium">Nº Falhas</th>
              <th className="pb-3 px-2 font-medium text-right">Tempo Manut.</th>
              <th className="pb-3 px-2 font-medium text-right">MTTR</th>
              <th className="pb-3 px-2 font-medium text-right">MTBF</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                <td className="py-3 px-2 font-semibold text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                      {i + 1}
                    </div>
                    {item.placa}
                  </div>
                </td>
                <td className="py-3 px-2">
                  <span className="px-2.5 py-1 rounded-md bg-amber-100/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 font-semibold">
                    {item.falhas}
                  </span>
                </td>
                <td className="py-3 px-2 text-right text-zinc-500 font-medium whitespace-nowrap">
                  {item.diasManut != null && item.diasManut > 0 ? formatarTempoManut(item.diasManut) : "—"}
                </td>
                <td className="py-3 px-2 text-right text-purple-600 dark:text-purple-400 font-semibold whitespace-nowrap">
                  {item.mttr != null && item.mttr > 0 ? `${item.mttr} h` : "—"}
                </td>
                <td className="py-3 px-2 text-right text-indigo-600 dark:text-indigo-400 font-semibold whitespace-nowrap">
                  {item.mtbf > 0 ? `${item.mtbf} h` : "—"}
                </td>
              </tr>
            ))}
            {dados.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">Nenhum dado no período</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 15. Manutenção por Tipo (Gráfico de Barras) ─────────────────────────────
export function GraficoManuTipo({ dados }: { dados: { tipo: string; quantidade: number }[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        COMPOSIÇÃO DA MANUTENÇÃO (TIPOS DE OS)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridColor} />
          <XAxis type="number" tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} />
          <YAxis dataKey="tipo" type="category" tick={{ fontSize: 10, fill: tickColor, fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            contentStyle={{ 
              backgroundColor: isDark ? "#1a1f2e" : "#ffffff", 
              borderColor: isDark ? "#3f3f46" : "#e2e8f0",
              borderRadius: "8px",
              color: isDark ? "#f4f4f5" : "#18181b"
            }}
            itemStyle={{ color: isDark ? "#f4f4f5" : "#18181b" }}
            formatter={(val: number) => [`${val} OS`, "Quantidade"]}
          />
          <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} fill="#3b82f6" >
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 16. Disponibilidade por Categoria (Gráfico de Barras) ─────────────────
export function GraficoDispTipo({ dados }: { dados: { tipo: string; disponibilidade: number; total: number }[] }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tickColor = isDark ? "#94a3b8" : "#64748b";
  const gridColor = isDark ? "#1e293b" : "#e2e8f0";

  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        DISPONIBILIDADE OPERACIONAL POR CATEGORIA DE VEÍCULO
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 10, right: 0, left: -20, bottom: 5 }} barSize={35}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
          <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: tickColor, fontWeight: 600 }} axisLine={false} tickLine={false} dy={5} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: tickColor }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="3 3" />
          <Tooltip 
            cursor={{ fill: "rgba(148,163,184,0.08)" }} 
            contentStyle={{ 
              backgroundColor: isDark ? "#1a1f2e" : "#ffffff", 
              borderColor: isDark ? "#3f3f46" : "#e2e8f0",
              borderRadius: "8px",
              color: isDark ? "#f4f4f5" : "#18181b" 
            }}
            itemStyle={{ color: isDark ? "#f4f4f5" : "#18181b" }}
            formatter={(val: number) => [`${val}%`, "Disponibilidade Méd."]} 
          />
          <Bar dataKey="disponibilidade" radius={[3, 3, 0, 0]} label={{ position: 'top', fill: '#0f172a', fontSize: 10, fontWeight: 800, formatter: (v: number) => `${v}%` }}>
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColorDisp(entry.disponibilidade)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 17. Mapa de Status da Frota (Tabela Dinâmica) ───────────────────────────
export function TabelaStatusFrota({ dados }: { dados: { placa: string; tipo: string; status: string; disponibilidade: number; modulo: string }[] }) {
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm w-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
        MAPA DE STATUS DA FROTA
      </h3>
      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-left text-[13px] border-collapse relative">
          <thead className="sticky top-0 bg-white dark:bg-[#0f1115] z-10 shadow-[0_1px_0_0_#e4e4e7] dark:shadow-[0_1px_0_0_#27272a]">
            <tr className="text-zinc-500">
              <th className="pb-3 px-3 font-medium">PLACA</th>
              <th className="pb-3 px-3 font-medium">EQUIPAMENTO</th>
              <th className="pb-3 px-3 font-medium">STATUS ATUAL</th>
              <th className="pb-3 px-3 font-medium">DISP. NO PERÍODO</th>
              <th className="pb-3 px-3 font-medium">MÓDULO</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item, i) => {
              let statusBadgeClass = "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400";
              if (item.status === "Manutenção") statusBadgeClass = "bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500";
              if (item.status === "Disponível") statusBadgeClass = "bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500";
              if (item.status === "Atenção") statusBadgeClass = "bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500";
              if (item.status === "Crítico") statusBadgeClass = "bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500";

              return (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors">
                  <td className="py-3 px-3 font-bold text-zinc-700 dark:text-zinc-200">{item.placa}</td>
                  <td className="py-3 px-3 text-zinc-600 dark:text-zinc-400">{item.tipo}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusBadgeClass}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold" style={{ color: getColorDisp(item.disponibilidade) }}>
                      {item.disponibilidade}%
                    </span>
                  </td>
                  <td className="py-3 px-3 text-zinc-500 text-xs">{item.modulo}</td>
                </tr>
              )
            })}
            {dados.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-zinc-500">Nenhuma placa encontrada no filtro</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 18. Painel de Fórmulas ──────────────────────────────────────────────────
export function PainelFormulas() {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-900/40 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 p-6 flex flex-col w-full text-[13px] text-zinc-600 dark:text-zinc-400">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-500" /> Entenda os Indicadores (Fórmulas PCM Florestal)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">Disponibilidade Operacional (DO)</strong>
          <p className="mb-2">Mede a proporção do tempo em que o veículo esteve operando ou apto, calculada sobre 24h/dia. A indisponibilidade deixa de contar quando o veículo reserva assume a operação.</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-blue-600 dark:text-blue-400 font-mono block w-fit">
            DO = (Ht - Indisp. até reserva) / Ht × 100
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">Disponibilidade Mecânica (DM)</strong>
          <p className="mb-2">Mede o tempo real livre de manutenção, calculada sobre 24h/dia por veículo.</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-emerald-600 dark:text-emerald-400 font-mono block w-fit">
            DM = (Ht - H.Manut) / Ht × 100
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">Ht = Horas Planejadas</strong>
          <p className="mb-2">Cada veículo é considerado disponível 24h/dia, tanto para a DM quanto para a DO, independente da escala cadastrada.</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-purple-600 dark:text-purple-400 font-mono block w-fit">
            Ht = Dias × 24h
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">D+1 (Ontem)</strong>
          <p className="mb-2">Todos os dados de hoje são consolidados apenas no dia seguinte. O dashboard reflete o fechamento de ontem.</p>
          <span className="text-[10px] text-zinc-400">Referência: Regra PCM Suzano</span>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">MTBF — Tempo Médio Entre Falhas</strong>
          <p className="mb-2">
            Indica a confiabilidade da frota: quanto maior, menos frequentes são as falhas corretivas. Calculado sobre as horas operacionais disponíveis no período.
          </p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-indigo-600 dark:text-indigo-400 font-mono block w-fit mb-1">
            MTBF = (Ht_DO - H.Indisp_DO) / Nº OS Corretivas
          </code>
          <span className="text-[10px] text-zinc-400 block">
            Ex: 26 veículos × 720h = 18.720h planejadas. 4.680h indisponíveis e 93 OS corretivas → MTBF = (18.720 − 4.680) / 93 ≈ <strong className="text-indigo-500">150,9h</strong>
          </span>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1 uppercase tracking-wider">MTTR — Tempo Médio Para Reparo</strong>
          <p className="mb-2">
            Mede a eficiência do time de manutenção: quanto menor, mais rápida é a resolução das OS corretivas. Baseado nas horas de indisponibilidade mecânica (DM).
          </p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-purple-600 dark:text-purple-400 font-mono block w-fit mb-1">
            MTTR = H.Indisp_DM_Total / Nº OS Corretivas Fechadas
          </code>
          <span className="text-[10px] text-zinc-400 block">
            Ex: 3.152h de indisp. mecânica e 81 OS fechadas → MTTR = 3.152 / 81 ≈ <strong className="text-purple-500">38,9h</strong>
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── 19. Disponibilidade por Tipo de Frota (DM + DO, Dupla Barra) ────────
const categoriaMock = [
  { categoria: 'PIPA',    dm: 89.5, doOp: 88.2, total: 0, qtdOS: 0 },
  { categoria: 'COMBOIO', dm: 93.1, doOp: 91.8, total: 0, qtdOS: 0 },
  { categoria: 'MUNCK',   dm: 96.4, doOp: 95.9, total: 0, qtdOS: 0 },
  { categoria: 'MULTI',   dm: 87.3, doOp: 85.1, total: 0, qtdOS: 0 },
];

// ─── ModalDetalheCategoria ───────────────────────────────────────────────────
function ModalDetalheCategoria({
  categoria,
  mes,
  ano,
  dataInicio,
  dataFim,
  onClose,
}: {
  categoria: string;
  mes?: number;
  ano?: number;
  dataInicio?: string;
  dataFim?: string;
  onClose: () => void;
}) {
  const [osList, setOsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fichaOS, setFichaOS] = useState<OSFichaData | null>(null);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getOSporCategoriaV3(categoria, mes, ano, dataInicio, dataFim)
      .then((data) => {
        if (!cancelled) {
          setOsList(data || []);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error loading OS por categoria:", err);
        if (!cancelled) {
          setOsList([]);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [categoria, mes, ano, dataInicio, dataFim]);

  if (!mounted) return null;

  const totalOS = osList.length;
  const osFechadas = osList.filter(os => os.status === "Fechada" || os.status === "Concluída").length;
  const osAbertas = totalOS - osFechadas;
  const horasManutTotal = osList.reduce((acc, os) => acc + Number(os.horas_manutencao || 0), 0);
  const mttr = osFechadas > 0 ? (horasManutTotal / osFechadas).toFixed(1) : "—";

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md" onClick={onClose} />

      {/* Ficha Modal (sobreposto) */}
      {fichaOS && (
        <OSFichaModal os={fichaOS} onClose={() => setFichaOS(null)} />
      )}

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-3xl bg-white dark:bg-[#1a1f2e] rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden flex flex-col"
        style={{ maxHeight: "95vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0 bg-gradient-to-r from-zinc-100 to-zinc-50 dark:from-zinc-800/50 dark:to-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                ORDENS DE SERVIÇO - TIPO DE FROTA {String(categoria).toUpperCase()}
              </h2>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                LISTA DE OS ABERTAS OU PARADAS NO PERÍODO SELECIONADO
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 pb-5 pt-4 flex flex-col gap-4">
          
          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-3">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">TOTAL DE OS</p>
              <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{loading ? "..." : totalOS}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-3">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">OS CONCLUÍDAS</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{loading ? "..." : osFechadas}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-3">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">OS EM ABERTO</p>
              <p className={`text-xl font-bold ${osAbertas > 0 ? "text-amber-600" : "text-zinc-900 dark:text-zinc-100"}`}>{loading ? "..." : osAbertas}</p>
            </div>
            <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 p-3">
              <p className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-0.5">MTTR MÉDIO</p>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{loading ? "..." : `${mttr}h`}</p>
            </div>
          </div>

          <div className="mt-2">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-zinc-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Buscando ordens de serviço...</span>
              </div>
            ) : osList.length > 0 ? (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse bg-white dark:bg-[#1a1f2e]">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/80 text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
                      <th className="px-4 py-3">EQUIPAMENTO</th>
                      <th className="px-3 py-3">DESCRIÇÃO DA ATIVIDADE</th>
                      <th className="px-3 py-3 text-center">STATUS</th>
                      <th className="px-3 py-3 text-center">HORAS MANUT.</th>
                      <th className="px-3 py-3 text-center">HORAS IMP.</th>
                      <th className="px-4 py-3 text-right">FICHA</th>
                    </tr>
                  </thead>
                  <tbody className="text-[11px] divide-y divide-zinc-100 dark:divide-zinc-800">
                    {osList.map((os: any) => {
                      const hMec = Number(os.horas_manutencao || 0);
                      const hOp = Number(os.horas_impacto_do || 0);
                      const isFechada = os.status === "Fechada" || os.status === "Concluída";
                      return (
                        <tr 
                          key={os.id} 
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                          onClick={() => setFichaOS(os as any)}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-zinc-900 dark:text-zinc-100">
                              {os.placa}
                            </div>
                            <div className="text-[10px] text-zinc-500 dark:text-zinc-400">
                              {os.modelo} · Mód. {os.modulo}
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <span className="opacity-50 text-[10px]">#{os.numero_os || os.id.slice(0,6)}</span>
                              {hOp > 0 && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" title="Afeta Disponibilidade Operacional" />}
                            </div>
                            <div className="text-zinc-500 text-[10px] line-clamp-1 mt-0.5" title={os.descricao}>{os.descricao || 'Atividade de manutenção'}</div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              isFechada ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-200' : 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border border-orange-200'
                            }`}>
                              {os.status}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            {hMec > 0 ? `${hMec.toFixed(1)}h` : '—'}
                          </td>
                          <td className={`px-3 py-3 text-center font-mono font-bold ${hOp > 0 ? 'text-red-500' : 'text-emerald-500 opacity-30'}`}>
                            {hOp > 0 ? `${hOp.toFixed(1)}h` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button 
                              onClick={() => setFichaOS(os)}
                              className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-blue-500 hover:text-white transition-all"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-10 flex flex-col items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-700/50">
                <ClipboardList className="w-8 h-8 text-zinc-200 mb-3" />
                <p className="text-zinc-500 dark:text-zinc-400 font-medium italic text-sm text-center">Nenhuma OS encontrada para este período.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-700/50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-700 dark:bg-zinc-800 hover:bg-zinc-600 dark:hover:bg-zinc-700 text-white transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GraficoDispCategoria({
  dados,
  periodoLabel,
  mes,
  ano,
  dataInicio,
  dataFim,
}: {
  dados?: { categoria: string; dm: number; doOp: number; total: number; qtdOS: number }[];
  periodoLabel?: string;
  mes?: number;
  ano?: number;
  dataInicio?: string;
  dataFim?: string;
}) {
  const [selecionado, setSelecionado] = useState<any>(null);
  const [verOS, setVerOS] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? '#1e293b'  : '#e2e8f0';
  const isMock    = !dados || dados.length === 0;
  const source    = isMock ? categoriaMock : dados!;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dm   = payload.find((p: any) => p.dataKey === 'dm')?.value   ?? 0;
    const doOp = payload.find((p: any) => p.dataKey === 'doOp')?.value ?? 0;
    const qos  = payload[0]?.payload?.qtdOS ?? 0;
    return (
      <div className="bg-white dark:bg-[#1a1f2e] rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs pointer-events-none min-w-[160px]">
        <p className="font-bold text-[13px] text-zinc-800 dark:text-zinc-100 mb-2 border-b border-zinc-100 dark:border-zinc-700 pb-1">{label}</p>
        <div className="flex flex-col gap-1.5 text-zinc-600 dark:text-zinc-400">
          <p className="flex justify-between gap-4">
            <span>DM (Mecânica):</span>
            <span className="font-bold" style={{ color: getColorDisp(dm) }}>{dm}%</span>
          </p>
          <p className="flex justify-between gap-4">
            <span>DO (Operacional):</span>
            <span className="font-bold" style={{ color: doOp >= 95 ? '#3b82f6' : doOp >= 90 ? '#6366f1' : '#a855f7' }}>{doOp}%</span>
          </p>
          <p className="flex justify-between gap-4 border-t border-zinc-100 dark:border-zinc-700 pt-1 mt-1">
            <span className="text-zinc-400">Ordens de Serviço:</span>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">{qos}</span>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h3 className="font-bold text-[15px] text-zinc-800 dark:text-zinc-100 uppercase tracking-wider">DISPONIBILIDADE POR TIPO DE FROTA</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
            {periodoLabel ? periodoLabel + ' · ' : ''}DM e DO por tipo (PIPA · COMBOIO · MUNCK · MULTI)
            {isMock && <span className="ml-1 text-amber-500 italic">(prévia — sem dados)</span>}
          </p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-semibold">
          <div className="flex items-center gap-1.5"><div className="w-3 h-2.5 rounded-sm bg-[#22c55e]" /><span className="text-zinc-500 dark:text-zinc-400">DM</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-2.5 rounded-sm bg-[#3b82f6]" /><span className="text-zinc-500 dark:text-zinc-400">DO</span></div>
        </div>
      </div>

      {/* Rolagem horizontal para mobile/Android */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: Math.max(300, source.length * 90), width: "100%" }}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart 
              data={source} 
              margin={{ top: 22, right: 10, left: -20, bottom: 5 }} 
              barCategoryGap="28%" 
              barGap={4}
              onClick={(data) => {
                if (data && data.activePayload && data.activePayload.length > 0) {
                  const cat = data.activePayload[0].payload;
                  setSelecionado(cat);
                  setVerOS(true);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis dataKey="categoria" tick={{ fontSize: 12, fill: tickColor, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: gridColor }} />
              <YAxis domain={[75, 100]} tick={{ fontSize: 10, fill: tickColor }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="4 3" strokeWidth={1.5}
                label={{ value: 'Meta 95%', position: 'insideTopRight', fontSize: 8, fill: '#22c55e' }} />
              <ReferenceLine y={90} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1}
                label={{ value: '90%', position: 'insideTopRight', fontSize: 8, fill: '#f59e0b' }} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="dm" name="DM (Mecânica)" radius={[4, 4, 0, 0]}
                label={{ position: 'top', fill: isDark ? '#f8fafc' : '#0f172a', fontSize: 9, fontWeight: 800, formatter: (v: number) => `${v}%` }}
                fill="#22c55e"
              />
              <Bar dataKey="doOp" name="DO (Operacional)" radius={[4, 4, 0, 0]}
                label={{ position: 'top', fill: isDark ? '#f8fafc' : '#0f172a', fontSize: 9, fontWeight: 800, formatter: (v: number) => `${v}%` }}
                fill="#3b82f6"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex gap-2 mt-3 flex-wrap">
        {source.map((item) => (
          <button 
            key={item.categoria} 
            onClick={() => {
              setSelecionado(item);
              setVerOS(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-all text-left"
          >
            <div className="w-2 h-2 rounded-full" style={{ background: getColorDisp(item.dm) }} />
            <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">{item.categoria}</span>
            {item.total > 0 && <span className="text-[9px] text-zinc-400 dark:text-zinc-400">({item.total})</span>}
          </button>
        ))}
      </div>

      {selecionado && (
        <div className="mt-6 p-4 rounded-2xl bg-zinc-100/50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/50 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-inner" style={{ background: getColorDisp(selecionado.dm) }}>
              {(selecionado.dm || 0).toFixed(1)}%
            </div>
            <div>
              <h4 className="font-bold text-zinc-800 dark:text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                {selecionado.categoria}
                <span className="text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-zinc-500">TIPO</span>
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selecionado.total}</span> equipamentos · <span className="font-semibold text-zinc-700 dark:text-zinc-300">{selecionado.qtdOS}</span> OS no período
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase font-bold mb-1">Taxa Disponibilidade</span>
              <div className="flex items-center gap-2">
                <div className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600">DM: {(selecionado.dm || 0).toFixed(1)}%</div>
                <div className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-600">DO: {(selecionado.doOp || 0).toFixed(1)}%</div>
              </div>
            </div>
            <button
              onClick={() => setVerOS(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all"
            >
              <ClipboardList size={14} />
              Ver OSs
            </button>
            <button 
              onClick={() => setSelecionado(null)}
              className="p-1.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-300 transition-all ml-2"
              title="Fechar detalhes"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {verOS && selecionado && (
        <ModalDetalheCategoria
          categoria={selecionado.categoria}
          mes={mes}
          ano={ano}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onClose={() => setVerOS(false)}
        />
      )}
    </div>
  );
}

// ─── GraficoDMModulo ──────────────────────────────────────────────────────────
export function GraficoDMModulo({
  dados,
}: {
  dados: { modulo: string; dm: number; doOp: number; hManut: number; hTotal: number; veiculos: number }[];
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg     = isDark ? "#0f1623" : "#ffffff";
  const border = isDark ? "#1e293b" : "#e2e8f0";
  const grid   = isDark ? "#1e293b" : "#f1f5f9";
  const tickC  = isDark ? "#94a3b8" : "#64748b";
  const labelC = isDark ? "#e2e8f0" : "#1e293b";

  if (!dados || dados.length === 0) {
    return (
      <div className="rounded-3xl border p-6 flex flex-col gap-3" style={{ background: bg, borderColor: border }}>
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tickC }}>
          Disponibilidade Mecânica (DM%) por Módulo
        </p>
        <div className="flex items-center justify-center h-40 text-sm" style={{ color: tickC }}>
          Sem dados de módulo disponíveis.
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const cor = d.dm >= 95 ? "#22c55e" : d.dm >= 90 ? "#f59e0b" : "#ef4444";
    return (
      <div style={{ background: isDark ? "#0f172a" : "#fff", border: `1px solid ${border}`, borderRadius: 12, padding: "10px 16px", minWidth: 210, boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
        <p style={{ color: tickC, fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{d.modulo}</p>
        <p style={{ color: cor, fontSize: 22, fontWeight: 900, margin: "2px 0" }}>DM: {d.dm.toFixed(1)}%</p>
        <div style={{ height: 1, background: border, margin: "6px 0" }} />
        <p style={{ color: tickC, fontSize: 11, margin: "2px 0" }}>Veículos: <span style={{ color: labelC, fontWeight: 700 }}>{d.veiculos}</span></p>
        <p style={{ color: tickC, fontSize: 11, margin: "2px 0" }}>H. Total: <span style={{ color: labelC, fontWeight: 700 }}>{d.hTotal}h</span></p>
        <p style={{ color: "#ef4444", fontSize: 11, margin: "2px 0" }}>H. Manut: <span style={{ color: labelC, fontWeight: 700 }}>{d.hManut}h</span></p>
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col gap-4 shadow-sm">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: tickC }}>
            Disponibilidade Mecânica (DM%) por Módulo
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: isDark ? "#475569" : "#94a3b8" }}>
            Fórmula PCM · DM = ((H_Total − H_Manut) / H_Total) × 100 · Meta ≥ 95%
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold flex-wrap">
          {[["#22c55e","≥ 95% Meta"],["#f59e0b","90–94% Atenção"],["#ef4444","< 90% Crítico"]].map(([cor, label]) => (
            <span key={label} className="flex items-center gap-1.5" style={{ color: tickC }}>
              <span style={{ display:"inline-block", width:10, height:10, borderRadius:"50%", background: cor }} />
              {label}
            </span>
          ))}
        </div>
        <button
          onClick={() => setFullscreen(true)}
          title="Tela Cheia"
          className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-500 hover:text-emerald-700 transition-all"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Fullscreen modal */}
      {fullscreen && (
        <FullscreenChartModal
          title="DM% por Módulo"
          onClose={() => setFullscreen(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 28, right: 20, left: -10, bottom: 10 }} barCategoryGap="15%">
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="modulo" tick={{ fill: tickC, fontSize: dados.length > 20 ? 8 : 11, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: grid }} interval={0} />
              <YAxis domain={[0, 100]} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.07)' }} />
              <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: 'Meta 95%', fill: '#22c55e', fontSize: 11, fontWeight: 700, position: 'insideTopRight' }} />
              <Bar dataKey="dm" radius={[6, 6, 0, 0]} label={{ position: 'top', fill: labelC, fontSize: dados.length > 20 ? 8 : 11, fontWeight: 800, formatter: (v: number) => `${v.toFixed(1)}%` }}>
                {dados.map((entry, i) => (<Cell key={`fs-mod-${i}`} fill={entry.dm >= 95 ? '#22c55e' : entry.dm >= 90 ? '#f59e0b' : '#ef4444'} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </FullscreenChartModal>
      )}

      {/* Gráfico — com rolagem horizontal para mobile/Android */}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
        <div style={{ minWidth: Math.max(300, dados.length * 72), width: "100%" }}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={dados} margin={{ top: 24, right: 16, left: -16, bottom: 8 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="modulo"
                tick={{ fill: tickC, fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={{ stroke: grid }}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: isDark ? "#64748b" : "#94a3b8", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.07)" }} />
              <ReferenceLine
                y={95}
                stroke="#22c55e"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: "Meta 95%", fill: "#22c55e", fontSize: 10, fontWeight: 700, position: "insideTopRight" }}
              />
              <Bar dataKey="dm" radius={[5, 5, 0, 0]}
                label={{ position: "top", fill: labelC, fontSize: 11, fontWeight: 800, formatter: (v: number) => `${v.toFixed(1)}%` }}
              >
                {dados.map((entry, i) => (
                  <Cell key={`mod-${i}`} fill={entry.dm >= 95 ? "#22c55e" : entry.dm >= 90 ? "#f59e0b" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── Gráfico DM Mensal ────────────────────────────────────────────────────────
export type DMMensalItem = { mes: string; dm: number; doOp: number };

interface GraficoDMMensalProps {
  dados: DMMensalItem[];
  loading?: boolean;
}

export function GraficoDMMensal({ dados, loading }: GraficoDMMensalProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const tickC = isDark ? "#94a3b8" : "#64748b";
  const grid = isDark ? "#1e293b" : "#e2e8f0";
  const labelC = isDark ? "#f8fafc" : "#0f172a";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dm = payload.find((p: any) => p.dataKey === "dm");
    return (
      <div className="bg-white dark:bg-[#1a1f2e] rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-3 text-xs pointer-events-none min-w-[140px]">
        <p className="font-bold text-sm text-zinc-800 dark:text-zinc-100 mb-2">{label}</p>
        {dm && (
          <p className="flex justify-between gap-4">
            <span className="text-zinc-500">DM (Mecânica):</span>
            <span className="font-bold" style={{ color: dm.value >= 95 ? "#22c55e" : dm.value >= 90 ? "#f59e0b" : "#ef4444" }}>
              {dm.value.toFixed(1)}%
            </span>
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-5">
        <div>
          <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">DM POR MÊS</h3>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-0.5">Disponibilidade Mecânica — ano atual</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            DM Mecânica
          </div>
          <button
            onClick={() => setFullscreen(true)}
            title="Tela Cheia"
            className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-zinc-500 hover:text-emerald-700 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        </div>
      ) : dados.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-zinc-400 text-sm">Sem dados disponíveis.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dados} margin={{ top: 32, right: 16, left: -16, bottom: 8 }}>
            <defs>
              <linearGradient id="gradDM" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={isDark ? 0.25 : 0.18} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
            <XAxis
              dataKey="mes"
              tick={{ fill: tickC, fontSize: 11, fontWeight: 700 }}
              tickLine={false}
              axisLine={{ stroke: grid }}
            />
            <YAxis
              domain={[60, 100]}
              tick={{ fill: isDark ? "#64748b" : "#94a3b8", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: isDark ? "#334155" : "#cbd5e1", strokeWidth: 1.5 }} />
            <ReferenceLine
              y={95}
              stroke="#22c55e"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{ value: "Meta 95%", fill: "#22c55e", fontSize: 10, fontWeight: 700, position: "insideTopRight" }}
            />
            <Area
              type="monotone"
              dataKey="dm"
              stroke="#22c55e"
              strokeWidth={2.5}
              fill="url(#gradDM)"
              dot={{ fill: "#22c55e", r: 4, strokeWidth: 0 }}
              activeDot={{ r: 6, fill: "#22c55e", strokeWidth: 0 }}
              label={(props: any) => {
                const { x, y, value } = props;
                if (value == null) return null;
                return (
                  <text
                    x={x}
                    y={y - 10}
                    textAnchor="middle"
                    fill={labelC}
                    fontSize={10}
                    fontWeight={800}
                  >
                    {`${Number(value).toFixed(1)}%`}
                  </text>
                );
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Fullscreen modal DM Mensal */}
      {fullscreen && (
        <FullscreenChartModal
          title="DM POR MÊS — DISPONIBILIDADE MECÂNICA"
          onClose={() => setFullscreen(false)}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dados} margin={{ top: 36, right: 24, left: -10, bottom: 10 }}>
              <defs>
                <linearGradient id="gradDMFS" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={isDark ? 0.3 : 0.22} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: tickC, fontSize: 13, fontWeight: 700 }} tickLine={false} axisLine={{ stroke: grid }} />
              <YAxis domain={[60, 100]} tick={{ fill: isDark ? '#64748b' : '#94a3b8', fontSize: 13 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: isDark ? '#334155' : '#cbd5e1', strokeWidth: 1.5 }} />
              <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="6 4" strokeWidth={1.5} label={{ value: 'Meta 95%', fill: '#22c55e', fontSize: 11, fontWeight: 700, position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="dm" stroke="#22c55e" strokeWidth={3} fill="url(#gradDMFS)"
                dot={{ fill: '#22c55e', r: 5, strokeWidth: 0 }}
                activeDot={{ r: 7, fill: '#22c55e', strokeWidth: 0 }}
                label={(props: any) => {
                  const { x, y, value } = props;
                  if (value == null) return null;
                  return (
                    <text x={x} y={y - 12} textAnchor="middle" fill={labelC} fontSize={12} fontWeight={800}>
                      {`${Number(value).toFixed(1)}%`}
                    </text>
                  );
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </FullscreenChartModal>
      )}
    </div>
  );
}
