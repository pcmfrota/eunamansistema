"use client";

import React, { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Filtros, type FiltrosValues } from "@/components/filtros";
import { gerarSlideHTML } from "@/lib/gerar-slide";

// Componentes estáticos que não usam bibliotecas pesadas de gráficos
import { PainelFormulas } from "@/components/graficos";

// Importação dinâmica dos gráficos pesados (Recharts) para deixar o carregamento inicial mais leve
const GraficoVeiculos = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoVeiculos), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoPreventivas = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoPreventivas), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoSemanal = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoSemanal), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoParadasCategoria = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoParadasCategoria), { ssr: false, loading: () => <CarregandoGrafico /> });
const RankingFalhas = dynamic(() => import("@/components/graficos").then((mod) => mod.RankingFalhas), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoManuTipo = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoManuTipo), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoDispTipo = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoDispTipo), { ssr: false, loading: () => <CarregandoGrafico /> });
const TabelaStatusFrota = dynamic(() => import("@/components/graficos").then((mod) => mod.TabelaStatusFrota), { ssr: false, loading: () => <CarregandoGrafico /> });

function CarregandoGrafico() {
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex items-center justify-center h-full min-h-[300px]">
      <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
    </div>
  );
}
import { Loader2 } from "lucide-react";
import {
  getDashboardData,
  type DashboardData,
} from "@/app/actions/dashboard";

interface DashboardClientProps {
  initialData: DashboardData;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();

  // Default filters to current month/year (from the initial data)
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  const defaultFiltros: FiltrosValues = {
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
    categoria: "PESADA",
    placa: "",
    modulo: "",
    status: "",
    dataInicio: "",
    dataFim: "",
  };

  const [filtros, setFiltros] = useState<FiltrosValues>(defaultFiltros);
  const [mostrarIndisp, setMostrarIndisp] = useState(false);
  const [availabilityType, setAvailabilityType] = useState<"DM" | "DO">("DM");

  function handleFilterChange(key: keyof FiltrosValues, value: string | number) {
    const newFiltros = { ...filtros, [key]: value };
    setFiltros(newFiltros);

    startTransition(async () => {
      const result = await getDashboardData({
        mes: (newFiltros.mes as number) > 0 ? (newFiltros.mes as number) : undefined,
        ano: (newFiltros.ano as number) > 0 ? (newFiltros.ano as number) : undefined,
        categoria: newFiltros.categoria || undefined,
        placa: newFiltros.placa || undefined,
        modulo: newFiltros.modulo || undefined,
        status: newFiltros.status || undefined,
        dataInicio: newFiltros.dataInicio || undefined,
        dataFim: newFiltros.dataFim || undefined,
      });
      setData(result);
    });
  }

  function handleReset() {
    setFiltros(defaultFiltros);
    startTransition(async () => {
      const result = await getDashboardData({
        mes: defaultFiltros.mes,
        ano: defaultFiltros.ano,
        categoria: defaultFiltros.categoria || undefined,
        dataInicio: undefined,
        dataFim: undefined,
      });
      setData(result);
    });
  }

  const mttrLabel = data.mttr > 0 ? `${data.mttr}h` : "—";
  const mtbfLabel = data.mtbf > 0 ? `${data.mtbf}h` : "—";

  const [isExporting, setIsExporting] = useState(false);

  async function exportarRelatorio() {
    setIsExporting(true);
    try {
      // Sempre busca dados de frota PESADA para o relatório
      const dadosPesada = await getDashboardData({
        mes: (filtros.mes as number) > 0 ? (filtros.mes as number) : undefined,
        ano: (filtros.ano as number) > 0 ? (filtros.ano as number) : undefined,
        categoria: 'PESADA',
        dataInicio: filtros.dataInicio || undefined,
        dataFim: filtros.dataFim || undefined,
      });
      const periodo = dadosPesada.periodoLabel || 'Período';
      const html = gerarSlideHTML(dadosPesada, periodo, 'Frota Pesada');
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-pcm-pesada-${periodo.replace(/\s/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen relative">
      {/* Loading overlay */}
      {(isPending || isExporting) && (
        <div className="fixed inset-0 bg-black/10 dark:bg-black/30 z-50 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Atualizando dados...</span>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="flex items-start justify-between mb-1 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] dark:text-zinc-100">Dashboard Operacional</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Visão geral da manutenção e disponibilidade da frota
          </p>
        </div>
        <button
          onClick={exportarRelatorio}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-lg shadow-blue-500/20 transition-all"
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> Exportar Relatório PCM</>
          )}
        </button>
      </div>

      {/* Filtros */}
      <Filtros
        opcoes={data.filtroOpcoes}
        valores={filtros}
        onChange={handleFilterChange}
        onReset={handleReset}
        periodoLabel={data.periodoLabel}
      />

      {/* ── Período inline (pequeno, abaixo dos filtros) ── */}
      {data.data_inicio && (
        <div className="flex items-center gap-2 -mt-3 pb-1">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Período:</span>
          <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-300 font-mono">
            {new Date(data.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
          <span className="text-zinc-600 text-xs">{'->'}</span>
          <span className="px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-md text-xs text-zinc-300 font-mono">
            {new Date(data.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
          </span>
        </div>
      )}

      {/* ── KPI Mini Cards — todos em uma linha ── */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        <MiniCard label="Frota Ativa" value={String(data.totalVeiculosAtivos || 0)} sub="veículos" color="text-blue-400" />
        <MiniCard label="DM (Mecânica)" value={`${data.dm.toFixed(1)}%`} sub="meta ≥ 95%" color={data.dm >= 95 ? 'text-emerald-400' : data.dm >= 90 ? 'text-amber-400' : 'text-red-400'} />
        <MiniCard label="DO (Operacional)" value={`${data.doOperacional.toFixed(1)}%`} sub="equip. aptos" color={data.doOperacional >= 95 ? 'text-blue-400' : data.doOperacional >= 90 ? 'text-indigo-400' : 'text-violet-400'} />
        <MiniCard label="MTBF" value={mtbfLabel} sub="entre falhas" color="text-indigo-300" />
        <MiniCard label="MTTR" value={mttrLabel} sub="médio reparo" color="text-purple-300" />
        <MiniCard label="Backlog" value={data.backlog > 0 ? `${data.backlog}d` : '—'} sub="dias pendentes" color="text-amber-300" />
        <MiniCard label="Total de OS" value={String(data.totalOS)} sub={`${data.emAndamento}ab | ${data.osFechadas}fech`} color="text-zinc-300" />
        <MiniCard label="Horas Mec." value={`${data.horasManutencao}h`} sub={availabilityType === 'DM' ? 'total frota (DM)' : 'total frota (DO)'} color={availabilityType === 'DM' ? 'text-orange-300' : 'text-cyan-300'} />
      </div>

      {/* Gráficos e tabelas */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-4">
               <button 
                 onClick={() => setAvailabilityType("DM")}
                 className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${availabilityType === "DM" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}
               >
                 Mecânica (DM)
               </button>
               <button 
                 onClick={() => setAvailabilityType("DO")}
                 className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${availabilityType === "DO" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"}`}
               >
                 Operacional (DO)
               </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMostrarIndisp(!mostrarIndisp)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-colors border ${
                  mostrarIndisp
                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50"
                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {mostrarIndisp ? "Ver Disponibilidade" : "Ver Indisponibilidade"}
              </button>
            </div>
          </div>

          <GraficoVeiculos
            title={availabilityType === "DM" ? (mostrarIndisp ? "Indisponibilidade Mecânica (IM)" : "Disponibilidade Mecânica (DM)") : (mostrarIndisp ? "Indisponibilidade Operacional (IO)" : "Disponibilidade Operacional (DO)")}
            dados={data.veiculos}
            periodoLabel={data.periodoLabel}
            mes={filtros.mes || undefined}
            ano={filtros.ano || undefined}
            dataInicio={data.data_inicio || undefined}
            dataFim={data.data_fim || undefined}
            mostrarIndisponibilidade={mostrarIndisp}
            tipoAvailability={availabilityType}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GraficoParadasCategoria dados={data.paradasPorCategoria} />
          <RankingFalhas dados={data.rankingFalhas} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GraficoDispTipo dados={data.dispPorTipo} />
          <GraficoManuTipo dados={data.manutPorTipo} />
        </div>

        <TabelaStatusFrota dados={data.statusFrota} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GraficoSemanal dados={data.dispSemanal} periodoLabel={data.periodoLabel} />
          <GraficoPreventivas dados={data.preventivas} />
        </div>

        <PainelFormulas />
      </div>
    </div>
  );
}

function MiniCard({ label, value, sub, color = 'text-zinc-100' }: {
  label: string; value: string; sub: string; color?: string
}) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col gap-0.5">
      <p className="text-[9px] font-semibold text-zinc-500 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-lg font-black leading-tight ${color}`}>{value}</p>
      <p className="text-[9px] text-zinc-600 truncate">{sub}</p>
    </div>
  )
}


