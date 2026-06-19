"use client";

import React, { useState, useTransition, useEffect } from "react";
import dynamic from "next/dynamic";
import { Loader2, RefreshCcw } from "lucide-react";
import { Filtros, type FiltrosValues } from "@/components/filtros";
import { gerarSlideHTML } from "@/lib/gerar-slide";
import { getDashboardData, type DashboardData } from "@/app/actions/dashboard";
import { getHistoricoMensal } from "@/app/actions/historico";
import { useOffline } from "@/components/offline-provider";
import { getOfflineDashboardData, getOfflineHistoricoMensal } from "@/lib/offline-calculations";

// Componentes estáticos que não usam bibliotecas pesadas de gráficos
import { PainelFormulas } from "@/components/graficos";
import { PremiumLoader } from "@/components/premium-loader";

// Importação dinâmica dos gráficos pesados (Recharts) para deixar o carregamento inicial mais leve
const GraficoVeiculos = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoVeiculos), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoPreventivas = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoPreventivas), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoSemanal = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoSemanal), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoParadasCategoria = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoParadasCategoria), { ssr: false, loading: () => <CarregandoGrafico /> });
const RankingFalhas = dynamic(() => import("@/components/graficos").then((mod) => mod.RankingFalhas), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoManuTipo = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoManuTipo), { ssr: false, loading: () => <CarregandoGrafico /> });
const TabelaStatusFrota = dynamic(() => import("@/components/graficos").then((mod) => mod.TabelaStatusFrota), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoDMModulo = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoDMModulo), { ssr: false, loading: () => <CarregandoGrafico /> });
const GraficoDMMensal = dynamic(() => import("@/components/graficos").then((mod) => mod.GraficoDMMensal), { ssr: false, loading: () => <CarregandoGrafico /> });

function CarregandoGrafico() {
  return (
    <div className="bg-white dark:bg-[#0f1115] rounded-3xl border border-zinc-100 dark:border-zinc-800 p-6 flex items-center justify-center h-full min-h-[300px]">
      <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
    </div>
  );
}

interface DashboardClientProps {
  initialData?: DashboardData;
}

export default function DashboardClient({ initialData }: DashboardClientProps) {
  const { isOnline } = useOffline();
  const [data, setData] = useState<DashboardData | null>(initialData || null);
  const [isPending, startTransition] = useTransition();
  const [isLoadingInitial, setIsLoadingInitial] = useState(!initialData);

  // Default filters
  const defaultFiltros: FiltrosValues = {
    mes: data?.mesSelecionado || 0, // 0 triggers operational month detection on server
    ano: data?.anoSelecionado || 0,
    categoria: "PESADA",
    placa: "",
    modulo: "",
    area: "",
    status: "",
    dataInicio: "",
    dataFim: "",
    filial: "TODAS", // Admin pode trocar; usuário comum não vê este campo
  };

  const [filtros, setFiltros] = useState<FiltrosValues>(defaultFiltros);
  const [mostrarIndisp, setMostrarIndisp] = useState(false);
  const [availabilityType, setAvailabilityType] = useState<"DM" | "DO">("DM");
  const [historicoMensal, setHistoricoMensal] = useState<{ mes: string; dm: number; doOp: number }[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const initialSyncDone = React.useRef(false);

  // Sincroniza os filtros com o mês operacional Suzano detectado pelo servidor
  // apenas na carga inicial (para que o dropdown mostre o mês correto automaticamente)
  useEffect(() => {
    if (data && !initialSyncDone.current && data.mesSelecionado > 0) {
      initialSyncDone.current = true;
      setFiltros(prev => ({
        ...prev,
        mes: data.mesSelecionado,
        ano: data.anoSelecionado,
      }));
    }
  }, [data]);

  // Busca histórico mensal de DM (últimos 6 meses)
  useEffect(() => {
    setLoadingHistorico(true);
    const categoria = filtros.categoria || "PESADA";
    
    const fetchHistorico = async () => {
      if (isOnline) {
        try {
          const res = await getHistoricoMensal(categoria);
          setHistoricoMensal(res);
          return;
        } catch (err) {
          console.warn("Falha ao buscar histórico online, usando local:", err);
        }
      }
      const localRes = await getOfflineHistoricoMensal(categoria);
      setHistoricoMensal(localRes);
    };

    fetchHistorico().finally(() => setLoadingHistorico(false));
  }, [filtros.categoria, isOnline]);

  // Carrega e atualiza os dados do Dashboard (Offline-First)
  useEffect(() => {
    let active = true;

    startTransition(async () => {
      try {
        // 1. Carrega do IndexedDB local imediatamente (Offline First)
        const localData = await getOfflineDashboardData({
          mes: (filtros.mes as number) > 0 ? (filtros.mes as number) : undefined,
          ano: (filtros.ano as number) > 0 ? (filtros.ano as number) : undefined,
          categoria: filtros.categoria || undefined,
          placa: filtros.placa || undefined,
          modulo: filtros.modulo || undefined,
          area: filtros.area || undefined,
          status: filtros.status || undefined,
          dataInicio: filtros.dataInicio || undefined,
          dataFim: filtros.dataFim || undefined,
        });

        if (active) {
          setData(localData);
          setIsLoadingInitial(false);
        }

        // 2. Se estiver online, busca dados frescos do servidor
        if (isOnline) {
          try {
            const freshData = await getDashboardData({
              mes: (filtros.mes as number) > 0 ? (filtros.mes as number) : undefined,
              ano: (filtros.ano as number) > 0 ? (filtros.ano as number) : undefined,
              categoria: filtros.categoria || undefined,
              placa: filtros.placa || undefined,
              modulo: filtros.modulo || undefined,
              area: filtros.area || undefined,
              status: filtros.status || undefined,
              dataInicio: filtros.dataInicio || undefined,
              dataFim: filtros.dataFim || undefined,
              filial: (filtros as any).filial || undefined,
            });
            if (active && freshData) {
              setData(freshData);
            }
          } catch (onlineErr) {
            console.warn("Erro ao buscar dados online, mantendo locais:", onlineErr);
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
        if (active) setIsLoadingInitial(false);
      }
    });

    return () => {
      active = false;
    };
  }, [filtros, isOnline]);

  function handleFilterChange(key: keyof FiltrosValues, value: string | number) {
    setFiltros(prev => ({ ...prev, [key]: value }));
  }

  function handleReset() {
    setFiltros(defaultFiltros);
  }

  const mttrLabel = data?.mttr && data.mttr > 0 ? `${data.mttr}h` : "—";
  const mtbfLabel = data?.mtbf && data.mtbf > 0 ? `${data.mtbf}h` : "—";

  const [isExporting, setIsExporting] = useState(false);

  async function exportarRelatorio() {
    if (!data) return;
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

  if (isLoadingInitial || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full">
        <PremiumLoader type="squares-sequential" text="Carregando Frota" subtext="Sincronizando dados em tempo real..." />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-8 flex flex-col gap-6 min-h-screen relative">
      {/* Loading overlay */}
      {(isPending || isExporting) && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center backdrop-blur-sm">
          <div
            className="rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.6)',
            }}
          >
            <Loader2 className="w-5 h-5 text-green-700 animate-spin" />
            <span className="text-sm font-medium text-zinc-700">Atualizando dados...</span>
          </div>
        </div>
      )}

      {/* Cabeçalho */}
      <div
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-1 shrink-0 rounded-2xl px-4 py-3"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow: '0 4px 24px rgba(10,50,10,0.12)',
        }}
      >
        <div>
          <h1 className="text-lg font-bold tracking-tight text-zinc-800 uppercase">DASHBOARD OPERACIONAL</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <p className="text-xs text-zinc-500">
              Visão geral da manutenção e disponibilidade da frota
            </p>
            {data.dataAtualizacao && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200">
                ATÉ: {data.dataAtualizacao} (D+1)
              </span>
            )}
          </div>
        </div>
        <button
          onClick={exportarRelatorio}
          disabled={isExporting}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-white text-xs font-semibold shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
          style={{
            background: 'linear-gradient(135deg, #1a5c1a, #2d8a2d)',
            boxShadow: '0 4px 16px rgba(26,92,26,0.35)',
          }}
        >
          {isExporting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg> <span className="hidden sm:inline">EXPORTAR RELATÓRIO PCM</span><span className="sm:hidden">EXPORTAR</span></>
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
      {data.data_inicio && data.data_fim && (
        <div className="flex items-center gap-2 -mt-3 pb-1">
          <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">PERÍODO OPERACIONAL:</span>
          <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs text-zinc-700 dark:text-zinc-300 font-mono">
            {data.data_inicio.split('-').reverse().join('/')}
          </span>
          <span className="text-zinc-500 dark:text-zinc-600 text-[10px] font-bold">ATÉ</span>
          <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md text-xs text-zinc-700 dark:text-zinc-300 font-mono">
            {data.data_fim.split('-').reverse().join('/')}
          </span>
        </div>
      )}

      {/* ── KPI Mini Cards — todos em uma linha ── */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        <MiniCard label="Frota Ativa" value={String(data.totalVeiculosAtivos || 0)} sub="veículos" color="text-blue-600 dark:text-blue-400" />
        <MiniCard label="DM (Mecânica)" value={`${data.dm.toFixed(1)}%`} sub="meta ≥ 95%" color={data.dm >= 95 ? 'text-emerald-600 dark:text-emerald-400' : data.dm >= 90 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'} />
        <MiniCard label="DO (Operacional)" value={`${data.doOperacional.toFixed(1)}%`} sub="equip. aptos" color={data.doOperacional >= 95 ? 'text-blue-600 dark:text-blue-400' : data.doOperacional >= 90 ? 'text-indigo-600 dark:text-indigo-400' : 'text-violet-600 dark:text-violet-400'} />
        <MiniCard label="MTBF" value={mtbfLabel} sub="entre falhas" color="text-indigo-700 dark:text-indigo-300" />
        <MiniCard label="MTTR" value={mttrLabel} sub="médio reparo" color="text-purple-700 dark:text-purple-300" />
        <MiniCard label="Backlog" value={data.backlog > 0 ? `${data.backlog}d` : '—'} sub="dias pendentes" color="text-amber-700 dark:text-amber-300" />
        <MiniCard label="Total de OS" value={String(data.totalOS)} sub={`${data.emAndamento}ab | ${data.osFechadas}fech`} color="text-zinc-800 dark:text-zinc-300" />
        <MiniCard label="Horas Mec." value={`${data.horasManutencao}h`} sub={availabilityType === 'DM' ? 'total frota (DM)' : 'total frota (DO)'} color={availabilityType === 'DM' ? 'text-orange-700 dark:text-orange-300' : 'text-cyan-700 dark:text-cyan-300'} />
      </div>

      {/* Gráficos e tabelas */}
      <div className="flex flex-col gap-6 w-full">
        <div className="bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 flex flex-col shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div className="flex flex-wrap items-center gap-2">
               <button 
                 onClick={() => setAvailabilityType("DM")}
                 className={`px-3 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${availabilityType === "DM" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
               >
                 MECÂNICA (DM)
               </button>
               <button 
                 onClick={() => setAvailabilityType("DO")}
                 className={`px-3 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${availabilityType === "DO" ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"}`}
               >
                 OPERACIONAL (DO)
               </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMostrarIndisp(!mostrarIndisp)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-tighter transition-colors border ${
                  mostrarIndisp
                    ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50"
                    : "bg-zinc-50 dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800"
                }`}
              >
                {mostrarIndisp ? "VER DISP." : "VER INDISP."}
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
            dataAtualizacao={data.dataAtualizacao}
            mostrarIndisponibilidade={mostrarIndisp}
            tipoAvailability={availabilityType}
          />
        </div>

        <GraficoDMModulo dados={data.dispPorModulo} />

        {/* Gráfico de tendência mensal de DM */}
        <GraficoDMMensal dados={historicoMensal} loading={loadingHistorico} />

        <div className="grid grid-cols-1 gap-6">
          <RankingFalhas dados={data.rankingFalhas} />
        </div>

        <div className="grid grid-cols-1 gap-6">
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

function MiniCard({ label, value, sub, color = 'text-zinc-800' }: {
  label: string; value: string; sub: string; color?: string
}) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
      style={{
        background: 'var(--bg-card)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-color)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
      }}
    >
      <p className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: 'var(--text-muted)' }}>{label.toUpperCase()}</p>
      <p className={`text-lg font-black leading-tight ${color}`}>{value}</p>
      <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  )
}



