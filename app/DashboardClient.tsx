"use client";

import React, { useState, useEffect, useTransition } from "react";
import { Filtros, type FiltrosValues } from "@/components/filtros";
import {
  GraficoVeiculos,
  GraficoPreventivas,
  GraficoSemanal,
  ResumoHoras,
  GraficoParadasCategoria,
  RankingFalhas,
  GraficoManuTipo,
  GraficoDispTipo,
  TabelaStatusFrota,
  PainelFormulas,
} from "@/components/graficos";
import { FileText, Clock, CheckCircle2, TrendingUp, PenTool, Timer, Loader2, Activity, CalendarClock, AlertCircle } from "lucide-react";
import { getDashboardData, type DashboardData, type FiltroOpcoes } from "@/app/actions/dashboard";

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
    categoria: "",
    placa: "",
    modulo: "",
    status: "",
  };

  const [filtros, setFiltros] = useState<FiltrosValues>(defaultFiltros);
  const [mostrarIndisp, setMostrarIndisp] = useState(false);

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
      });
      setData(result);
    });
  }

  const mttrLabel = data.mttr > 0 ? `${data.mttr}h` : "—";
  const mtbfLabel = data.mtbf > 0 ? `${data.mtbf}h` : "—";

  return (
    <div className="p-5 md:p-8 flex flex-col gap-6 bg-[#f8fafc] dark:bg-[#0f1115] min-h-screen relative">
      {/* Loading overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-black/10 dark:bg-black/30 z-50 flex items-center justify-center backdrop-blur-[1px]">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Atualizando dados...</span>
          </div>
        </div>
      )}

      <div className="flex flex-col mb-1 shrink-0">
        <h1 className="text-2xl font-bold tracking-tight text-[#1e293b] dark:text-zinc-100">Dashboard Operacional</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Visão geral da manutenção e disponibilidade da frota
        </p>
      </div>

      <Filtros
        opcoes={data.filtroOpcoes}
        valores={filtros}
        onChange={handleFilterChange}
        onReset={handleReset}
        periodoLabel={data.periodoLabel}
      />

      <div className="flex overflow-x-auto gap-4 pb-2 -mx-5 px-5 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <KpiCard
          title="DM (Mecânica)"
          value={
            <span className={`font-bold ${data.dm >= 95 ? "text-emerald-500" : data.dm >= 90 ? "text-amber-500" : "text-red-500"}`}>
              {data.dm.toFixed(1)}%
            </span>
          }
          subtitle="Meta: ≥ 95%"
          icon={<TrendingUp size={18} className="text-emerald-500" />}
          iconBg="bg-emerald-100/50 dark:bg-emerald-500/10"
        />
        <KpiCard
          title="DO (Operacional)"
          value={
            <span className={`font-bold ${data.doOperacional >= 95 ? "text-blue-500" : data.doOperacional >= 90 ? "text-indigo-500" : "text-violet-500"}`}>
              {data.doOperacional.toFixed(1)}%
            </span>
          }
          subtitle="Equipamentos Aptos"
          icon={<Activity size={18} className="text-blue-500" />}
          iconBg="bg-blue-100/50 dark:bg-blue-500/10"
        />
        <KpiCard
          title="MTBF"
          value={mtbfLabel}
          subtitle={<>Tempo <br/>Entre Falhas</>}
          icon={<Timer size={18} className="text-indigo-500" />}
          iconBg="bg-indigo-100/50 dark:bg-indigo-500/10"
        />
        <KpiCard
          title="MTTR"
          value={mttrLabel}
          subtitle={<>Tempo Médio <br/>de Reparo</>}
          icon={<PenTool size={18} className="text-[#a855f7]" />}
          iconBg="bg-purple-100/40 dark:bg-purple-500/10"
        />
        <KpiCard
          title="Backlog"
          value={data.backlog > 0 ? `${data.backlog}d` : "—"}
          subtitle="Dias Pendentes"
          icon={<CalendarClock size={18} className="text-amber-500" />}
          iconBg="bg-amber-100/50 dark:bg-amber-500/10"
        />
        <KpiCard
          title="Total de OS"
          value={String(data.totalOS)}
          subtitle={`${data.emAndamento} abertas | ${data.osFechadas} fechadas`}
          icon={<FileText size={18} className="text-zinc-500 dark:text-zinc-400" />}
          iconBg="bg-zinc-100 dark:bg-zinc-800"
        />
      </div>

      </div>

      <div className="flex flex-col gap-6 w-full">
        <div className="flex justify-end">
          <button
            onClick={() => setMostrarIndisp(!mostrarIndisp)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors border ${
              mostrarIndisp 
                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 hover:bg-red-100' 
                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-100'
            }`}
          >
            {mostrarIndisp ? (
              <><AlertCircle size={16} /> Ocultar Indisponibilidade</>
            ) : (
              <><AlertCircle size={16} /> Mostrar Indisponibilidade</>
            )}
          </button>
        </div>

        <GraficoVeiculos 
          title={mostrarIndisp ? "Indisponibilidade Mecânica (IM) por Placa" : "Disponibilidade Mecânica (DM) por Placa"}
          dados={data.veiculos} 
          periodoLabel={data.periodoLabel} 
          mes={filtros.mes || undefined} 
          ano={filtros.ano || undefined} 
          mostrarIndisponibilidade={mostrarIndisp}
        />
        <GraficoVeiculos 
          title={mostrarIndisp ? "Indisponibilidade Operacional (IO) por Placa" : "Disponibilidade Operacional (DO) por Placa"}
          dados={data.veiculos} 
          periodoLabel={data.periodoLabel} 
          mes={filtros.mes || undefined} 
          ano={filtros.ano || undefined} 
          mostrarIndisponibilidade={mostrarIndisp}
        />
        
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

function KpiCard({ title, value, subtitle, icon, iconBg }: any) {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl p-5 px-6 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-w-[160px] flex-shrink-0">
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{title}</h3>
        <div className={`p-2 rounded-xl ${iconBg} ml-4`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="text-[28px] font-bold text-zinc-800 dark:text-zinc-100 leading-none mb-1">{value}</div>
        <p className="text-[11px] text-[#94a3b8] dark:text-zinc-500 leading-tight">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function KpiCardDocs({ title, v, av, venc, icon, iconBg }: any) {
  return (
    <div className="bg-white dark:bg-zinc-950 rounded-2xl p-5 px-6 border border-zinc-100 dark:border-zinc-800 flex flex-col justify-between shadow-sm min-w-[170px] flex-shrink-0">
      <div className="flex justify-between items-start mb-5">
        <h3 className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">{title}</h3>
        <div className={`p-2 rounded-xl ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5 mb-1">
          <span className="text-[28px] font-bold text-emerald-500 leading-none">{v}</span>
          <span className="text-[28px] font-bold text-amber-500 leading-none">{av}</span>
          <span className="text-[28px] font-bold text-rose-500 leading-none">{venc}</span>
        </div>
        <p className="text-[11px] font-medium text-[#94a3b8] dark:text-zinc-500 uppercase tracking-wider">
          V / AV / Venc
        </p>
      </div>
    </div>
  );
}
