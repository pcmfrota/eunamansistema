"use client";

import { useMemo, useState, useEffect, useTransition } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, LineChart, Line, Legend, ReferenceLine, Cell,
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
  horario_parada?: string | null;
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

  // Helper local para fundir intervalos e evitar duplicidade
  const mergeIntervals = (intervals: Array<{ start: number, end: number }>) => {
    if (intervals.length === 0) return 0;
    const sorted = [...intervals].sort((a, b) => a.start - b.start);
    let totalMs = 0;
    let currentStart = sorted[0].start;
    let currentEnd = sorted[0].end;
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i];
      if (next.start < currentEnd) {
        currentEnd = Math.max(currentEnd, next.end);
      } else {
        totalMs += Math.max(0, currentEnd - currentStart);
        currentStart = next.start;
        currentEnd = next.end;
      }
    }
    totalMs += Math.max(0, currentEnd - currentStart);
    return totalMs;
  };

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
  // Regra D-1: Nunca considerar dados do dia atual
  const agoraRef = new Date();
  const ontem = new Date(agoraRef);
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(23, 59, 59, 999);
  const dataAtualizacao = ontem.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const LIMITE_INI = periodoSelecionado ? new Date(periodoSelecionado.data_inicio + "T00:00:00") : null;
  // O fim do período nunca deve passar de ontem (D-1)
  let LIMITE_FIM = periodoSelecionado ? new Date(periodoSelecionado.data_fim + "T23:59:59") : null;
  if (LIMITE_FIM && LIMITE_FIM > ontem) {
    LIMITE_FIM = ontem;
  }

  // Calcula horas totais: Clipando ao período, fundindo sobreposições e incluindo OS abertas
  const totalHoras = useMemo(() => {
    if (!LIMITE_INI || !LIMITE_FIM) return 0;
    
    // Agrupa intervalos por placa para fundir sobreposições
    const intervalosPorVeiculo = new Map<string, Array<{start: number, end: number}>>();
    
    ordensFiltradas.forEach(o => {
      const inicioOS = new Date(o.horario_parada || o.data_abertura);
      const fimOS = o.data_fechamento ? new Date(o.data_fechamento) : agoraRef;
      
      const interInicio = inicioOS > LIMITE_INI ? inicioOS : LIMITE_INI;
      const interFim = fimOS < LIMITE_FIM ? fimOS : LIMITE_FIM;

      if (interInicio < interFim) {
        const p = o.placa || "S/P";
        const arr = intervalosPorVeiculo.get(p) || [];
        arr.push({ start: interInicio.getTime(), end: interFim.getTime() });
        intervalosPorVeiculo.set(p, arr);
      }
    });

    let somaTotalMs = 0;
    intervalosPorVeiculo.forEach(intervals => {
      somaTotalMs += mergeIntervals(intervals);
    });

    return somaTotalMs / 3600000;
  }, [ordensFiltradas, LIMITE_INI, LIMITE_FIM]);

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

  // ── DM (Disponibilidade Mecânica) por Módulo ──────────────────────────────
  const dmPorModulo = useMemo(() => {
    if (!LIMITE_INI || !LIMITE_FIM) return [];

    // Dias no período (D-1)
    const diasPeriodo = Math.max(1,
      Math.round((LIMITE_FIM.getTime() - LIMITE_INI.getTime()) / (24 * 3600000))
    );

    // Agrupa placas únicas por módulo para calcular H_Total (24h × dias × nVeículos)
    const placasPorModulo = new Map<string, Set<string>>();
    // Horas de manutenção por módulo (clipadas ao período)
    const horasManutPorModulo = new Map<string, number>();

    ordensFiltradas.forEach(o => {
      const modulo = (o.modulo || "SEM MÓDULO").toUpperCase();
      const placa = o.placa || "S/P";

      // Registrar placa no módulo
      if (!placasPorModulo.has(modulo)) placasPorModulo.set(modulo, new Set());
      placasPorModulo.get(modulo)!.add(placa);

      // Calcular horas de manutenção clipadas ao período
      const inicioOS = new Date(o.horario_parada || o.data_abertura);
      const fimOS = o.data_fechamento ? new Date(o.data_fechamento) : LIMITE_FIM;

      const clipIni = inicioOS > LIMITE_INI ? inicioOS : LIMITE_INI;
      const clipFim = fimOS < LIMITE_FIM ? fimOS : LIMITE_FIM;

      if (clipIni < clipFim) {
        const horas = (clipFim.getTime() - clipIni.getTime()) / 3600000;
        horasManutPorModulo.set(modulo, (horasManutPorModulo.get(modulo) ?? 0) + horas);
      }
    });

    const resultado: { modulo: string; dm: number; hTotal: number; hManut: number; veiculos: number }[] = [];

    placasPorModulo.forEach((placas, modulo) => {
      const nVeiculos = placas.size;
      const hTotal = diasPeriodo * 24 * nVeiculos;
      const hManut = Math.round((horasManutPorModulo.get(modulo) ?? 0) * 10) / 10;
      const dm = hTotal > 0 ? Math.round(((hTotal - hManut) / hTotal) * 1000) / 10 : 100;
      resultado.push({ modulo, dm: Math.min(100, Math.max(0, dm)), hTotal, hManut, veiculos: nVeiculos });
    });

    return resultado.sort((a, b) => a.dm - b.dm); // do pior para o melhor
  }, [ordensFiltradas, LIMITE_INI, LIMITE_FIM]);

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
        // Regra D-1: se aberta, conta apenas até ontem
        const fim = o.data_fechamento ? new Date(o.data_fechamento).getTime() : ontem.getTime();
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

      {/* Header com Regra D-1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="px-2 py-0.5 bg-green-500/10 border border-green-500/20 rounded-md">
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">Regra D+1 (PCM Suzano)</span>
          </div>
          <span className="text-xs text-zinc-500 font-medium">Dados atualizados até {dataAtualizacao} 23:59</span>
        </div>
      </div>

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

      {/* ══ Gráfico DM por Módulo ══ */}
      <div className="rounded-2xl border border-zinc-800 bg-[#0f1623] p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
              Disponibilidade Mecânica (DM%) por Módulo
            </p>
            <p className="text-[11px] text-zinc-600 mt-0.5">
              Fórmula PCM: DM = ((H_Total - H_Manut) / H_Total) × 100 · Meta: ≥ 95%
            </p>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-500">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" /> ≥ 95%</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" /> 90–94%</div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" /> &lt; 90%</div>
          </div>
        </div>

        {dmPorModulo.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-zinc-600 text-sm">Sem dados de módulo no período selecionado.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={dmPorModulo}
              margin={{ top: 24, right: 16, left: -16, bottom: 8 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="modulo"
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                tickLine={false}
                axisLine={{ stroke: "#1e293b" }}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "#64748b", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                content={({ active, payload }: any) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 10, padding: "10px 16px", minWidth: 200 }}>
                      <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{d.modulo}</p>
                      <p style={{ color: d.dm >= 95 ? "#22c55e" : d.dm >= 90 ? "#f59e0b" : "#ef4444", fontSize: 20, fontWeight: 900, margin: "2px 0" }}>
                        DM: {d.dm.toFixed(1)}%
                      </p>
                      <div style={{ height: 1, background: "#1e293b", margin: "6px 0" }} />
                      <p style={{ color: "#94a3b8", fontSize: 11, margin: "2px 0" }}>Veículos: <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{d.veiculos}</span></p>
                      <p style={{ color: "#94a3b8", fontSize: 11, margin: "2px 0" }}>H. Total: <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{d.hTotal}h</span></p>
                      <p style={{ color: "#ef4444", fontSize: 11, margin: "2px 0" }}>H. Manut: <span style={{ color: "#f1f5f9", fontWeight: 700 }}>{d.hManut}h</span></p>
                    </div>
                  );
                }}
              />
              {/* Linha de meta 95% */}
              <ReferenceLine
                y={95}
                stroke="#22c55e"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{ value: "Meta 95%", fill: "#22c55e", fontSize: 10, fontWeight: 700, position: "insideTopRight" }}
              />
              <Bar dataKey="dm" radius={[4, 4, 0, 0]}
                label={{ position: "top", fill: "#e2e8f0", fontSize: 11, fontWeight: 800, formatter: (v: number) => `${v.toFixed(1)}%` }}
              >
                {dmPorModulo.map((entry, index) => (
                  <Cell
                    key={`cell-dm-${index}`}
                    fill={entry.dm >= 95 ? "#22c55e" : entry.dm >= 90 ? "#f59e0b" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
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
        <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold border border-emerald-200">
          Dados até: {dataAtualizacao} (D+1)
        </span>
      </div>
    </div>
  );
}
