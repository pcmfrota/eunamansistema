"use client";

import React from "react";
import { Settings, AlertTriangle, Clock, CheckCircle2, Wrench, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth-context";
import { cn } from "@/lib/utils";

type Preventiva = {
  id: string;
  placa: string;
  modelo: string;
  tipo_servico: string;
  horas_restantes: number;
  percentual: number;
  status: "atrasado" | "atencao" | "no_prazo";
};

type OsAberta = {
  id: string;
  placa: string | null;
  status: string | null;
  descricao_problema: string | null;
  data_abertura: string | null;
  motivo: string | null;
};

interface PCMClientProps {
  preventivas: Preventiva[];
  osPendentes: OsAberta[];
}

export default function PCMClient({ preventivas, osPendentes }: PCMClientProps) {
  const { profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const atrasadas = preventivas.filter((p) => p.status === "atrasado");
  const atencao = preventivas.filter((p) => p.status === "atencao");
  const noPrazo = preventivas.filter((p) => p.status === "no_prazo");

  return (
    <div className="p-4 md:p-8 flex flex-col gap-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 rounded-xl">
            <Settings size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Painel PCM
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Planejamento e Controle de Manutenção — alertas e agenda preventiva
            </p>
          </div>
        </div>
        {isVisitante && (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <ShieldAlert size={16} />
            <span>Somente Leitura</span>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Atrasadas"
          value={atrasadas.length}
          color="red"
          icon={<AlertTriangle size={20} className="text-red-500" />}
        />
        <KpiCard
          label="Em Atenção"
          value={atencao.length}
          color="amber"
          icon={<Clock size={20} className="text-amber-500" />}
        />
        <KpiCard
          label="No Prazo"
          value={noPrazo.length}
          color="emerald"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preventivas */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Wrench size={18} className="text-purple-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Status das Preventivas
            </h2>
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
              {preventivas.length} equip.
            </span>
          </div>

          {preventivas.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-400">
              Nenhuma preventiva cadastrada.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[420px] overflow-y-auto">
              {preventivas.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                  {/* Status dot */}
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0",
                    p.status === "atrasado" ? "bg-red-500" :
                    p.status === "atencao" ? "bg-amber-500" : "bg-emerald-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">{p.placa}</span>
                      {p.modelo && (
                        <span className="text-[11px] text-zinc-400 truncate">{p.modelo}</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{p.tipo_servico}</p>
                    {/* Progress bar */}
                    <div className="mt-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          p.status === "atrasado" ? "bg-red-500" :
                          p.status === "atencao" ? "bg-amber-500" : "bg-emerald-500"
                        )}
                        style={{ width: `${Math.min(100, p.percentual)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cn(
                      "text-xs font-bold",
                      p.status === "atrasado" ? "text-red-500" :
                      p.status === "atencao" ? "text-amber-500" : "text-emerald-500"
                    )}>
                      {p.horas_restantes >= 0 ? `${p.horas_restantes}h` : `${Math.abs(p.horas_restantes)}h atr.`}
                    </span>
                    <p className="text-[10px] text-zinc-400">{p.percentual}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OS Abertas */}
        <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              OS Pendentes (Abertas)
            </h2>
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
              {osPendentes.length} OS
            </span>
          </div>

          {osPendentes.length === 0 ? (
            <div className="p-8 text-center text-sm text-emerald-500 font-medium">
              ✓ Nenhuma OS aberta no momento
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[420px] overflow-y-auto">
              {osPendentes.map((os) => {
                const dataAbertura = os.data_abertura
                  ? new Date(os.data_abertura).toLocaleDateString("pt-BR")
                  : "—";
                return (
                  <div key={os.id} className="px-5 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {os.placa ?? "—"}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                        Aberta
                      </span>
                      <span className="ml-auto text-[11px] text-zinc-400">{dataAbertura}</span>
                    </div>
                    {os.descricao_problema && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                        {os.descricao_problema}
                      </p>
                    )}
                    {os.motivo && (
                      <p className="text-[11px] text-zinc-400 mt-0.5">{os.motivo}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: "red" | "amber" | "emerald";
  icon: React.ReactNode;
}) {
  const bg = {
    red: "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/40",
    amber: "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40",
    emerald: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40",
  }[color];
  const valueColor = {
    red: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  }[color];
  return (
    <div className={cn("rounded-xl border p-5 flex items-center gap-4", bg)}>
      <div className="p-2.5 rounded-lg bg-white/70 dark:bg-black/20">{icon}</div>
      <div>
        <div className={cn("text-3xl font-bold leading-none", valueColor)}>{value}</div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
