"use client";

import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Legend,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine
} from "recharts";
import {
  X, Truck, ClipboardList, CheckCircle2, Clock,
  Wrench, TrendingUp, AlertTriangle, Loader2
} from "lucide-react";
import type { VeiculoDisp, PreventivaStatus } from "@/app/actions/dashboard";
import type { OrdemServicoResumo } from "@/app/actions/os-placa";

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
  if (s === "Aberta") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  if (s === "Fechada") return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  return "bg-zinc-700 text-zinc-300 border border-zinc-600";
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface VeiculoDetalhe {
  nome: string;
  disp: number; // For plotting
  dispDM: number;
  dispDO: number;
  totalOS: number;
  osFechadas: number;
  horasManut: number;
  horasOperacional: number;
}

function ModalDetalhe({
  veiculo,
  mes,
  ano,
  onClose,
}: {
  veiculo: VeiculoDetalhe;
  mes?: number;
  ano?: number;
  onClose: () => void;
}) {
  const [osList, setOsList] = useState<OrdemServicoResumo[] | null>(null);
  const [loading, setLoading] = useState(true);

  const osAbertas = veiculo.totalOS - veiculo.osFechadas;
  const mttr =
    veiculo.osFechadas > 0
      ? (veiculo.horasManut / veiculo.osFechadas).toFixed(1)
      : "—";
  const displayDisp = veiculo.dispDM; // Use DM for main status badge color/label
  const dispColor = getColorDisp(displayDisp);
  const dispLabel = displayDisp >= 95 ? "Operacional" : displayDisp >= 90 ? "Atenção" : "Crítico";

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    import("@/app/actions/os-placa").then(({ buscarOSporPlaca }) =>
      buscarOSporPlaca(veiculo.nome, mes, ano)
    ).then((data) => {
      if (!cancelled) { setOsList(data); setLoading(false); }
    }).catch(() => {
      if (!cancelled) { setOsList([]); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [veiculo.nome, mes, ano]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-md bg-[#1a1f2e] rounded-2xl shadow-2xl border border-zinc-700/50 overflow-hidden flex flex-col"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: `linear-gradient(135deg, ${dispColor}22, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl" style={{ background: `${dispColor}25` }}>
              <Truck className="w-5 h-5" style={{ color: dispColor }} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100">{veiculo.nome}</h2>
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${dispColor}25`, color: dispColor }}
              >
                {dispLabel}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-zinc-700/50 transition-colors"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 pt-2 flex flex-col gap-3">

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">DM (Mecânica)</p>
                <p className="text-2xl font-bold text-emerald-400" style={{ color: getColorDisp(veiculo.dispDM) }}>
                  {veiculo.dispDM}%
                </p>
              </div>
              <p className="text-[9px] text-zinc-500 mt-1">Impacto: {veiculo.horasManut}h</p>
            </div>
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-3 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">DO (Operacional)</p>
                <p className="text-2xl font-bold text-blue-400" style={{ color: getColorDisp(veiculo.dispDO) }}>
                  {veiculo.dispDO}%
                </p>
              </div>
              <p className="text-[9px] text-zinc-500 mt-1">Impacto: {veiculo.horasOperacional}h</p>
            </div>
          </div>

          {/* ── KPI Grid 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-500/15">
                  <ClipboardList className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-400">Total de OS</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{veiculo.totalOS}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">ordens de serviço</p>
            </div>

            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/15">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-400">OS Concluídas</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">{veiculo.osFechadas}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">fechadas no período</p>
            </div>

            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-1.5 rounded-lg ${osAbertas > 0 ? "bg-amber-500/15" : "bg-zinc-700/50"}`}>
                  <Clock className={`w-3.5 h-3.5 ${osAbertas > 0 ? "text-amber-400" : "text-zinc-500"}`} />
                </div>
                <p className="text-[11px] font-medium text-zinc-400">OS em Aberto</p>
              </div>
              <p className={`text-2xl font-bold ${osAbertas > 0 ? "text-amber-400" : "text-zinc-100"}`}>
                {osAbertas}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {osAbertas > 0 ? "⚠ atenção necessária" : "nenhuma pendente"}
              </p>
            </div>

            <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-purple-500/15">
                  <Wrench className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-400">Hs Manutenção</p>
              </div>
              <p className="text-2xl font-bold text-zinc-100">
                {veiculo.horasManut > 0 ? `${veiculo.horasManut}h` : "—"}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">no período</p>
            </div>
          </div>

          {/* ── MTTR (full width) */}
          <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/15">
                <AlertTriangle className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-300">MTTR</p>
                <p className="text-[11px] text-zinc-500">Tempo Médio de Reparo</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-violet-400">
                {mttr}{mttr !== "—" ? "h" : ""}
              </span>
              <p className="text-[10px] text-zinc-500">por OS concluída</p>
            </div>
          </div>

          {/* ── Lista de OS */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-3">
              Ordens de Serviço ({veiculo.totalOS})
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8 gap-2 text-zinc-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">Carregando...</span>
              </div>
            ) : !osList || osList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-zinc-600">
                <ClipboardList className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhuma OS encontrada para este período.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {osList.map((os) => (
                  <div
                    key={os.id}
                    className="rounded-xl bg-zinc-800/40 border border-zinc-700/40 p-3.5"
                  >
                    {/* Row 1: número + status */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-bold text-zinc-100">
                        OS: {os.numero_os}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge(os.status)}`}>
                        {os.status}
                      </span>
                    </div>

                    {/* Classe / sistema */}
                    {(os.classe || os.sistema) && (
                      <p className="text-[11px] text-zinc-400 mb-2">
                        {os.classe}{os.sistema ? ` · ${os.sistema}` : ""}
                        {os.sub_sistema ? ` · ${os.sub_sistema}` : ""}
                      </p>
                    )}

                    {/* Descrição */}
                    {os.descricao && (
                      <p className="text-[11px] text-zinc-500 mb-2 line-clamp-2 italic">
                        {os.descricao}
                      </p>
                    )}

                    {/* Hs + Data */}
                    <div className="flex items-center gap-4 text-[11px] text-zinc-400">
                      {os.horas_manutencao != null && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {os.horas_manutencao}h
                        </span>
                      )}
                      {(os.data_fechamento || os.data_abertura) && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {fmtDate(os.data_fechamento ?? os.data_abertura)}
                        </span>
                      )}
                      {os.motivo && (
                        <span className="text-zinc-500 truncate max-w-[120px]">{os.motivo}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-700/50 shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Disponibilidade Operacional ─────────────────────────────────────────────
interface GraficoVeiculosProps {
  dados?: VeiculoDisp[];
  periodoLabel?: string;
  mes?: number;
  ano?: number;
  title?: string;
  mostrarIndisponibilidade?: boolean;
  tipoAvailability?: "DM" | "DO";
}

export function GraficoVeiculos({ 
  dados, 
  periodoLabel, 
  mes, 
  ano, 
  title = "Disponibilidade Operacional",
  mostrarIndisponibilidade = false,
  tipoAvailability = "DM"
}: GraficoVeiculosProps) {
  const [selected, setSelected] = useState<VeiculoDetalhe | null>(null);

  const chartData = (dados ?? []).map((v) => {
    const isDO = tipoAvailability === "DO";
    const valBase = isDO ? v.disponibilidade_operacional : v.disponibilidade;
    
    let dispExibida = mostrarIndisponibilidade ? Number((100 - valBase).toFixed(1)) : valBase;
    
    return {
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
          <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200">
            {title}
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
      <div className="bg-[#1a1f2e] rounded-lg shadow-lg border border-zinc-700 p-3 text-xs pointer-events-none">
        <p className="font-bold text-sm text-zinc-100 mb-1.5">{d.nome}</p>
        <div className="flex flex-col gap-1 text-zinc-400">
          <p className="flex justify-between gap-4">
            <span>DM (Mecânica):</span>
            <span className="font-semibold text-emerald-400" style={{ color: getColorDisp(d.dispDM) }}>
              {d.dispDM}%
            </span>
          </p>
          <p className="flex justify-between gap-4">
            <span>DO (Operacional):</span>
            <span className="font-semibold text-blue-400" style={{ color: getColorDisp(d.dispDO) }}>
              {d.dispDO}%
            </span>
          </p>
          <div className="h-[1px] bg-zinc-700/50 my-1" />
          <p>
            Total de OS: <span className="font-semibold text-zinc-200">{d.totalOS}</span>
          </p>
          <p>
            Hs Manut (Impacto DM): <span className="font-semibold text-zinc-200">{d.horasManut}h</span>
          </p>
          <p>
            Hs Indisp (Impacto DO): <span className="font-semibold text-zinc-200">{d.horasOperacional}h</span>
          </p>
        </div>
        <p className="mt-2 text-[10px] text-zinc-600 italic">Clique para ver detalhes e OS</p>
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
          onClose={() => setSelected(null)}
        />
      )}

      <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200">
              {title}
            </h3>
            {periodoLabel && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                {periodoLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-500">
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
            <span className="text-zinc-400 dark:text-zinc-600 border-l border-zinc-200 dark:border-zinc-700 pl-3 ml-1">
              Clique na barra para detalhes
            </span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 0, left: -20, bottom: 40 }}
            barCategoryGap="18%"
            onClick={(data) => {
              if (data?.activePayload?.[0]?.payload) {
                setSelected(data.activePayload[0].payload as VeiculoDetalhe);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#e4e4e7"
              className="dark:stroke-zinc-800"
            />
            <XAxis
              dataKey="nome"
              tick={{ fontSize: 10, fill: "#f4f4f5", fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#e4e4e7" }}
              interval={0}
              angle={-45}
              textAnchor="end"
              dy={5}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "#f4f4f5", fontWeight: 500 }}
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
                fill: "#ffffff",
                fontSize: 10,
                fontWeight: 600,
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
        fill="#fff"
        fontSize={10}
        textAnchor="middle"
        fontWeight={600}
      >
        {text}
      </text>
    );
  };

  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200">
          Status das Preventivas por Placa
        </h3>
        <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-500">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> Atrasado
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> Atenção
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> No Prazo
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 0, left: -20, bottom: 40 }}
          barCategoryGap="12%"
        >
          <XAxis
            dataKey="nome"
            tick={{ fontSize: 9, fill: "#71717a", fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: "#e4e4e7" }}
            interval={0}
            angle={-45}
            textAnchor="end"
            dy={5}
          />
          <YAxis domain={[0, 2]} tick={false} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ fill: "transparent" }}
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
  const chartData = dados && dados.length > 0 ? dados : semanalMock;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-semibold text-[15px] text-zinc-800 dark:text-zinc-200">
          Disponibilidade por Semana do Mês
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
            stroke="#e4e4e7"
            className="dark:stroke-zinc-800"
          />
          <XAxis
            dataKey="semana"
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="3 3" />
          <Tooltip
            cursor={{ fill: "transparent" }}
            formatter={(val) => [`${val}%`, "Disponibilidade"]}
          />
          <Bar
            dataKey="disp"
            radius={[3, 3, 0, 0]}
            label={{
              position: "top",
              fill: "#3f3f46",
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
  const hoje = new Date();
  const diasTranscorridos = hoje.getDate();
  const horasPeriodo = diasTranscorridos * 24 * totalEquipamentos;
  const horasDisponiveis = Math.max(0, horasPeriodo - horasManutencao);

  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
      <h3 className="font-semibold text-[15px] mb-6 text-zinc-800 dark:text-zinc-200">
        Resumo de Horas
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
  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200">
        Paradas por Categoria
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
            contentStyle={{ backgroundColor: "#1a1f2e", border: "1px solid #3f3f46", borderRadius: "8px", fontSize: "12px", color: "#fff" }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 14. Ranking de Falhas (Tabela) ──────────────────────────────────────────
export function RankingFalhas({ dados }: { dados: { placa: string; falhas: number; mtbf: number }[] }) {
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200">
        Ranking de Falhas (Top 10)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <th className="pb-3 px-2 font-medium">Equipamento</th>
              <th className="pb-3 px-2 font-medium">Nº Falhas</th>
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
                <td className="py-3 px-2 text-right text-zinc-500">
                  {item.mtbf > 0 ? `${item.mtbf} h` : "—"}
                </td>
              </tr>
            ))}
            {dados.length === 0 && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-zinc-500">Nenhum dado no período</td>
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
  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200">
        Composição da Manutenção (Tipos de OS)
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }} barCategoryGap="15%">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" className="dark:stroke-zinc-800" />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
          <YAxis dataKey="tipo" type="category" tick={{ fontSize: 10, fill: "#71717a", fontWeight: 600 }} axisLine={false} tickLine={false} />
          <Tooltip 
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
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
  if (!dados || dados.length === 0) return null;
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm h-full">
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200">
        Disponibilidade Operacional por Categoria de Veículo
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={dados} margin={{ top: 10, right: 0, left: -20, bottom: 5 }} barSize={35}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" className="dark:stroke-zinc-800" />
          <XAxis dataKey="tipo" tick={{ fontSize: 10, fill: "#71717a", fontWeight: 600 }} axisLine={false} tickLine={false} dy={5} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
          <ReferenceLine y={95} stroke="#22c55e" strokeDasharray="3 3" />
          <Tooltip cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(val: number) => [`${val}%`, "Disponibilidade Méd."]} />
          <Bar dataKey="disponibilidade" radius={[3, 3, 0, 0]} label={{ position: 'top', fill: '#71717a', fontSize: 10, fontWeight: 600, formatter: (v: number) => `${v}%` }}>
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
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200">
        Mapa de Status da Frota
      </h3>
      <div className="overflow-x-auto max-h-[400px]">
        <table className="w-full text-left text-[13px] border-collapse relative">
          <thead className="sticky top-0 bg-white dark:bg-[#0f1115] z-10 shadow-[0_1px_0_0_#e4e4e7] dark:shadow-[0_1px_0_0_#27272a]">
            <tr className="text-zinc-500">
              <th className="pb-3 px-3 font-medium">Placa</th>
              <th className="pb-3 px-3 font-medium">Equipamento</th>
              <th className="pb-3 px-3 font-medium">Status Atual</th>
              <th className="pb-3 px-3 font-medium">Disp. no Período</th>
              <th className="pb-3 px-3 font-medium">Módulo</th>
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
      <h3 className="font-semibold text-[15px] mb-4 text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-blue-500" /> Entenda os Indicadores (Fórmulas PCM Florestal)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1">Disponibilidade Operacional (DO)</strong>
          <p className="mb-2">Mede a proporção do tempo em que o veículo esteve operando ou apto, considerando apenas as horas da escala Suzano.</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-blue-600 dark:text-blue-400 font-mono block w-fit">
            DO = (Ht - Indisp. Shift) / Ht × 100
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1">Disponibilidade Mecânica (DM)</strong>
          <p className="mb-2">Mede o tempo real livre de manutenção dentro do período planejado de trabalho (Escala).</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-emerald-600 dark:text-emerald-400 font-mono block w-fit">
            DM = (Ht - H.Manut Shift) / Ht × 100
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1">Ht = Horas Planejadas</strong>
          <p className="mb-2">Baseado no cadastro de Escala da Frota (Ex: 16h/dia de 08:00 às 00:00). Se não cadastrado, assume 24h.</p>
          <code className="bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs text-purple-600 dark:text-purple-400 font-mono block w-fit">
            Ht = Dias × Carga Horária
          </code>
        </div>
        <div>
          <strong className="text-zinc-700 dark:text-zinc-300 block mb-1">D-1 (Ontem)</strong>
          <p className="mb-2">Todos os dados de hoje são consolidados apenas no dia seguinte. O dashboard reflete o fechamento de ontem.</p>
          <span className="text-[10px] text-zinc-400">Referência: Regra PCM Suzano</span>
        </div>
      </div>
    </div>
  );
}
