"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line, Legend,
} from "recharts";
import { Download } from "lucide-react";
import { getOSDashboardData, type PeriodoSuzano } from "./actions-dashboard";

// ─── Cores dos anos nos gráficos de linha ────────────────────────────────────
const LINE_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#a78bfa", "#fb923c",
  "#34d399", "#60a5fa", "#fbbf24", "#c084fc", "#f87171",
];

// Meses para eixo X dos gráficos de linha (mesma ordem do calendário Suzano)
const MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

type OS = {
  id: string;
  numero_os: string;
  placa: string | null;
  modulo: string | null;
  status: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  horas_manutencao: number | null;
  classe: string | null;
  motivo: string | null;
  sistema: string | null;
  sub_sistema: string | null;
  equipamento_id: string;
};

// ─── Tooltip escuro personalizado ────────────────────────────────────────────
function DarkTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 16px", minWidth: 150 }}>
      <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.fill || p.stroke || "#22c55e", fontSize: 13, fontWeight: 700, margin: "2px 0" }}>
          {p.name ?? "qtd"}: <span style={{ color: "#f1f5f9" }}>{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-[#0f1623] p-5 flex flex-col gap-1 shadow-lg">
      <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background: color }} />
      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</p>
      <p className="text-4xl font-black leading-none mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Bar Chart genérico ───────────────────────────────────────────────────────
function OsBarChart({ title, data, color = "#22c55e" }: { title: string; data: { name: string; qty: number }[]; color?: string }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5 flex flex-col gap-3">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{title}</p>
        <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">Sem dados no período</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5">
      <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 14, right: 8, left: -20, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} angle={-38} textAnchor="end" interval={0} />
          <YAxis tick={{ fill: "#64748b", fontSize: 10 }} allowDecimals={false} />
          <Tooltip content={<DarkTooltip />} />
          <Bar dataKey="qty" name="OS" fill={color} radius={[4, 4, 0, 0]}
            label={{ position: "top", fill: "#e2e8f0", fontSize: 10, fontWeight: 700 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function OSDashboard({ ordens: initialOrdens }: { ordens: OS[] }) {
  const [periodos, setPeriodos] = useState<PeriodoSuzano[]>([]);
  const [ordens, setOrdens] = useState<OS[]>(initialOrdens);
  const [isPending, startTransition] = useTransition();

  // Carregar períodos + OS completas via server action
  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getOSDashboardData();
        setPeriodos(data.periodos);
        setOrdens(data.ordens);
      } catch (e) {
        console.error("Erro ao carregar dados do dashboard OS:", e);
      }
    });
  }, []);

  // Período ativo (default = último período do calendário ou mês atual)
  const periodoAtual = useMemo(() => {
    if (!periodos.length) return null;
    const now = new Date();
    // Tenta encontrar o período que contém hoje
    const periodoPresenteOuAnterior = periodos
      .filter(p => new Date(p.data_inicio) <= now)
      .at(-1);
    return periodoPresenteOuAnterior ?? periodos.at(-1) ?? null;
  }, [periodos]);

  const [periodoKey, setPeriodoKey] = useState<string>("");

  // Quando periodos carregam, seta o período atual
  useEffect(() => {
    if (periodoAtual && !periodoKey) {
      setPeriodoKey(`${periodoAtual.mes}-${periodoAtual.ano}`);
    }
  }, [periodoAtual, periodoKey]);

  const periodoSelecionado = useMemo(() => {
    if (!periodoKey || !periodos.length) return periodoAtual;
    const [mes, ano] = periodoKey.split("-").map(Number);
    return periodos.find(p => p.mes === mes && p.ano === ano) ?? periodoAtual;
  }, [periodoKey, periodos, periodoAtual]);

  // Filtros adicionais (placa, classe)
  const [filtroPlaca, setFiltroPlaca] = useState("Todas");
  const [filtroClasse, setFiltroClasse] = useState("Todos");

  // Placas disponíveis
  const placas = useMemo(() =>
    ["Todas", ...Array.from(new Set(ordens.map(o => o.placa).filter(Boolean) as string[])).sort()],
    [ordens]);

  // OS filtradas pelo período Suzano selecionado
  const ordensFiltradas = useMemo(() => {
    if (!periodoSelecionado) return [];
    const inicio = new Date(periodoSelecionado.data_inicio + "T00:00:00");
    const fim = new Date(periodoSelecionado.data_fim + "T23:59:59");

    return ordens.filter(o => {
      const dtAbertura = new Date(o.data_abertura);
      // OS que foram abertas antes do fim do período E não foram fechadas antes do início
      const dentroDoIntervalo = dtAbertura <= fim &&
        (o.data_fechamento == null || new Date(o.data_fechamento) >= inicio);
      const matchPlaca = filtroPlaca === "Todas" || o.placa === filtroPlaca;
      const matchClasse = filtroClasse === "Todos" || o.classe === filtroClasse;
      return dentroDoIntervalo && matchPlaca && matchClasse;
    });
  }, [ordens, periodoSelecionado, filtroPlaca, filtroClasse]);

  // ── KPIs
  // ─── Consolidação das Métricas ───────────────────────────────────────────
  const totalOS = ordensFiltradas.length;
  const emAndamento = ordensFiltradas.filter(o => o.status === "Aberta" || o.status === "Em Andamento").length;
  const encerradas = ordensFiltradas.filter(o => o.status === "Fechada" || o.status === "Concluída").length;
  
  // Limites do período para "clipar" as horas (Padrão PCM)
  const agoraRef = new Date();
  const ontem = new Date(agoraRef);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);

  const LIMITE_INI = periodoSelecionado ? new Date(periodoSelecionado.data_inicio + "T00:00:00") : null;
  // O fim do período nunca deve passar de ontem (D-1) para o mês atual
  let LIMITE_FIM = periodoSelecionado ? new Date(periodoSelecionado.data_fim + "T23:59:59") : null;
  if (LIMITE_FIM && LIMITE_FIM > ontem) {
    LIMITE_FIM = ontem;
  }

  // Calcula horas totais: Clipando ao período e incluindo OS abertas
  const totalHoras = ordensFiltradas.reduce((s, o) => {
    const inicioOS = new Date(o.horario_parada || o.data_abertura);
    const fimOS = o.data_fechamento ? new Date(o.data_fechamento) : agoraRef;

    // Se o período não está definido, usa o total da OS
    if (!LIMITE_INI || !LIMITE_FIM) {
      return s + Math.max(0, (fimOS.getTime() - inicioOS.getTime()) / 3600000);
    }

    // Interseção (Clip): Início é o mais tardio entre (OS, Período), Fim é o mais cedo
    const interInicio = inicioOS > LIMITE_INI ? inicioOS : LIMITE_INI;
    const interFim = fimOS < LIMITE_FIM ? fimOS : LIMITE_FIM;

    const diffMs = interFim.getTime() - interInicio.getTime();
    return s + (diffMs > 0 ? diffMs / 3600000 : 0);
  }, 0);

  // ── Gráfico por Motivo
  const porMotivo = useMemo(() => {
    const map = new Map<string, number>();
    ordensFiltradas.forEach(o => { const m = (o.motivo || "SEM MOTIVO").toUpperCase(); map.set(m, (map.get(m) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [ordensFiltradas]);

  // ── Gráfico por Sistema
  const porSistema = useMemo(() => {
    const map = new Map<string, number>();
    ordensFiltradas.forEach(o => { const s = (o.sistema || "GERAL").toUpperCase(); map.set(s, (map.get(s) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [ordensFiltradas]);

  // ── Gráfico por Sub-Sistema
  const porSubSistema = useMemo(() => {
    const map = new Map<string, number>();
    ordensFiltradas.forEach(o => { const s = (o.sub_sistema || "N/A").toUpperCase(); map.set(s, (map.get(s) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [ordensFiltradas]);

  // ── Gráfico por Classe
  const porClasse = useMemo(() => {
    const map = new Map<string, number>();
    ordensFiltradas.forEach(o => { const c = (o.classe || "SEM CLASSE").toUpperCase(); map.set(c, (map.get(c) ?? 0) + 1); });
    return Array.from(map.entries()).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
  }, [ordensFiltradas]);

  // ── Anos disponíveis nos períodos Suzano
  const anosDisponiveis = useMemo(() =>
    Array.from(new Set(periodos.map(p => p.ano))).sort(),
    [periodos]);

  // ── Linha: % de OS por mês Suzano, comparando anos
  // Usa mesma lógica do dashboard: OS ativa no período (abertura <= fim E fechamento >= inicio ou null)
  const dadosPctMensal = useMemo(() => {
    const totalPorAno: Record<number, number> = {};
    anosDisponiveis.forEach(ano => {
      const perAno = periodos.filter(p => p.ano === ano);
      totalPorAno[ano] = ordens.filter(o => {
        const dtAb = new Date(o.data_abertura);
        return perAno.some(p => {
          const ini = new Date(p.data_inicio + "T00:00:00");
          const fim = new Date(p.data_fim + "T23:59:59");
          return dtAb <= fim && (o.data_fechamento == null || new Date(o.data_fechamento) >= ini);
        });
      }).length;
    });

    return MESES_PT.map((label, idx) => {
      const mes = idx + 1;
      const row: Record<string, any> = { mes: label };
      anosDisponiveis.forEach(ano => {
        const per = periodos.find(p => p.mes === mes && p.ano === ano);
        if (!per) { row[String(ano)] = 0; return; }
        const ini = new Date(per.data_inicio + "T00:00:00");
        const fim = new Date(per.data_fim + "T23:59:59");
        // OS que estavam ativas no período (abertura <= fim E fechamento >= inicio ou null)
        const qtd = ordens.filter(o => {
          const dtAb = new Date(o.data_abertura);
          return dtAb <= fim && (o.data_fechamento == null || new Date(o.data_fechamento) >= ini);
        }).length;
        row[String(ano)] = totalPorAno[ano] > 0 ? +(qtd / totalPorAno[ano] * 100).toFixed(1) : 0;
      });
      return row;
    });
  }, [periodos, ordens, anosDisponiveis]);

  // ── Linha: OS Fechadas por mês Suzano, comparando anos
  // Conta OS cujo data_fechamento está dentro do período Suzano (igual ao KPI card)
  const dadosOsFechadas = useMemo(() => {
    return MESES_PT.map((label, idx) => {
      const mes = idx + 1;
      const row: Record<string, any> = { mes: label };
      anosDisponiveis.forEach(ano => {
        const per = periodos.find(p => p.mes === mes && p.ano === ano);
        if (!per) { row[String(ano)] = 0; return; }
        const ini = new Date(per.data_inicio + "T00:00:00");
        const fim = new Date(per.data_fim + "T23:59:59");
        row[String(ano)] = ordens.filter(o => {
          const isFechada = o.status === "Fechada" || o.status === "Concluída";
          if (!isFechada || !o.data_fechamento) return false;
          // Usa data_fechamento dentro do período — mesma lógica do KPI encerradas
          const dtFechamento = new Date(o.data_fechamento);
          return dtFechamento >= ini && dtFechamento <= fim;
        }).length;
      });
      return row;
    });
  }, [periodos, ordens, anosDisponiveis]);

  const periodoLabel = periodoSelecionado?.label ?? "—";

  function exportarExcel() {
    const XLSX = (window as any).XLSX;
    if (!XLSX) { alert("Motor Excel ainda carregando..."); return; }
    
    const rows = ordensFiltradas.map(o => ({
      "Nº OS": o.numero_os,
      "Placa": o.placa || "",
      "Módulo": o.modulo || "",
      "Status": o.status || "",
      "Data Abertura": o.data_abertura,
      "Data Fechamento": o.data_fechamento || "",
      "Horas Manut.": (() => {
        if (o.horas_manutencao != null && o.horas_manutencao > 0) return o.horas_manutencao;
        const ini = new Date(o.horario_parada || o.data_abertura).getTime();
        const fim = o.data_fechamento ? new Date(o.data_fechamento).getTime() : Date.now();
        return Math.round((Math.max(0, fim - ini) / 3600000) * 10) / 10;
      })(),
      "Classe": o.classe || "",
      "Motivo": o.motivo || "",
      "Sistema": o.sistema || "",
      "Sub-Sistema": o.sub_sistema || ""
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dashboard_OS");
    XLSX.writeFile(workbook, `OS_Dashboard_${periodoLabel.replace("/", "-")}.xlsx`);
  }

  return (
    <div className="flex flex-col gap-6 w-full">

      {/* ── Barra de filtros ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800 bg-[#0f1623] p-4 shadow">
        {/* Período Suzano */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Período Operacional Suzano</label>
          {isPending && !periodos.length ? (
            <div className="px-3 py-2 text-xs text-zinc-500 rounded-lg border border-zinc-700 bg-zinc-900">Carregando períodos...</div>
          ) : (
            <select
              value={periodoKey}
              onChange={e => setPeriodoKey(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-500"
            >
              {periodos.map(p => (
                <option key={`${p.mes}-${p.ano}`} value={`${p.mes}-${p.ano}`}>
                  {p.label} ({p.data_inicio} → {p.data_fim})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Placa */}
        <div className="flex flex-col gap-1 min-w-[150px]">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Placa</label>
          <select value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 outline-none focus:ring-2 focus:ring-green-500/30">
            {placas.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>

        {/* Classe */}
        <div className="flex flex-col gap-1 min-w-[160px]">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tipo de Manutenção</label>
          <select value={filtroClasse} onChange={e => setFiltroClasse(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 outline-none focus:ring-2 focus:ring-green-500/30">
            <option>Todos</option>
            <option>CORRETIVA</option>
            <option>PREVENTIVA</option>
            <option>PREDITIVA</option>
          </select>
        </div>

        <div className="ml-auto flex items-center gap-4">
          <button 
            onClick={exportarExcel}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors shadow-lg"
          >
            <Download size={14} /> Exportar Excel
          </button>
          
          <div className="text-right">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Período ativo</p>
            <p className="text-lg font-black text-green-400">{periodoLabel}</p>
            {periodoSelecionado && (
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {periodoSelecionado.data_inicio} → {periodoSelecionado.data_fim}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="QTD Total de O.S" value={totalOS} sub="no período Suzano" color="#22c55e" />
        <KpiCard label="O.S Em Andamento / Abertas" value={emAndamento} sub="aguardando conclusão" color="#f59e0b" />
        <KpiCard label="O.S Encerradas" value={encerradas} sub="concluídas no período" color="#3b82f6" />
        <KpiCard label="Horas Totais de Manutenção" value={`${totalHoras.toFixed(1)}h`} sub="somadas no período" color="#a78bfa" />
      </div>

      {/* ── Gráficos de Barra — Motivo e Sistema ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OsBarChart title="QTD de O.S × Motivo" data={porMotivo} color="#22c55e" />
        <OsBarChart title="QTD de O.S × Sistema" data={porSistema} color="#3b82f6" />
      </div>

      {/* ── Sub-Sistema (largura total) ── */}
      <OsBarChart title="QTD de O.S × Sub-Sistema" data={porSubSistema} color="#f59e0b" />

      {/* ── Classe + Espelho ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OsBarChart title="QTD de O.S × Classe de Manutenção" data={porClasse} color="#a78bfa" />

        <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5">
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">
            Espelho Resumido — {periodoLabel}
          </p>
          <div className="overflow-auto max-h-[240px]">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 px-3 text-[10px] text-zinc-500 uppercase">Nº OS</th>
                  <th className="text-left py-2 px-3 text-[10px] text-zinc-500 uppercase">Placa</th>
                  <th className="text-left py-2 px-3 text-[10px] text-zinc-500 uppercase">Sistema</th>
                  <th className="text-left py-2 px-3 text-[10px] text-zinc-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {ordensFiltradas.slice(0, 50).map(o => (
                  <tr key={o.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] text-zinc-500">{o.numero_os}</td>
                    <td className="py-2 px-3 font-bold text-amber-400 text-[12px]">{o.placa ?? "-"}</td>
                    <td className="py-2 px-3 text-zinc-400 text-[11px]">{o.sistema ?? "-"}</td>
                    <td className="py-2 px-3">
                      {(o.status === "Fechada" || o.status === "Concluída")
                        ? <span className="text-[10px] font-bold text-emerald-400">✅ Fechada</span>
                        : o.status === "Em Andamento"
                          ? <span className="text-[10px] font-bold text-amber-400">⚙️ Em Andamento</span>
                          : <span className="text-[10px] font-bold text-blue-400">📋 Aberta</span>}
                    </td>
                  </tr>
                ))}
                {ordensFiltradas.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-zinc-600 text-sm">Sem OS no período selecionado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══ Gráficos de Linha ══ */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
          % de O.S por Mês Suzano — Distribuição Percentual por Ano
        </p>
        <p className="text-[11px] text-zinc-600 mb-4">
          Mostra qual % do total anual de OS foi registrada em cada mês operacional. Identifica sazonalidade e picos.
        </p>
        {anosDisponiveis.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosPctMensal} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} unit="%" domain={[0, "auto"]} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              {anosDisponiveis.map((ano, i) => (
                <Line key={ano} type="monotone" dataKey={String(ano)} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name={String(ano)} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">Carregando dados do calendário Suzano...</div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5">
        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
          Quantidade de O.S Fechadas por Mês Suzano — Evolução por Ano
        </p>
        <p className="text-[11px] text-zinc-600 mb-4">
          Acompanha a produção da equipe: quantas OS foram encerradas em cada mês, comparando anos.
        </p>
        {anosDisponiveis.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosOsFechadas} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="mes" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} />
              <Tooltip content={<DarkTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#94a3b8" }} />
              {anosDisponiveis.map((ano, i) => (
                <Line key={ano} type="monotone" dataKey={String(ano)} stroke={LINE_COLORS[i % LINE_COLORS.length]}
                  strokeWidth={2.5} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }}
                  strokeDasharray={i % 2 === 1 ? "5 4" : undefined} name={String(ano)} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">Carregando dados do calendário Suzano...</div>
        )}
      </div>

      <div className="text-center text-[10px] text-zinc-700 pb-2">
        {ordens.length} OS no banco · Período exibido: {periodoLabel}
        {periodoSelecionado && ` (${periodoSelecionado.data_inicio} → ${periodoSelecionado.data_fim})`}
      </div>
    </div>
  );
}
