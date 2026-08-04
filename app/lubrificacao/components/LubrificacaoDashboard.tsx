"use client";

import React, { useMemo } from "react";
import {
  Droplets,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  Truck,
  Gauge,
  MapPin,
  TrendingUp,
  Award,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { FichaLubrificacao } from "@/src/services/LubrificacaoService";

interface LubrificacaoDashboardProps {
  fichas: FichaLubrificacao[];
  equipamentos?: any[];
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#64748b"];

export function LubrificacaoDashboard({ fichas, equipamentos = [] }: LubrificacaoDashboardProps) {
  // Calculations & Analytics
  const analytics = useMemo(() => {
    const total = fichas.length;
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    let hojeCount = 0;
    let semanaCount = 0;
    let mesCount = 0;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let totalCalibragens = 0;
    let totalReapertos = 0;
    let totalMinutos = 0;
    let minutosCount = 0;

    const mecanicosSet = new Set<string>();
    const equipamentosSet = new Set<string>();
    const porMecanicoMap: Record<string, number> = {};
    const porEquipamentoMap: Record<string, number> = {};
    const porModuloMap: Record<string, number> = {};
    const porDiaMap: Record<string, number> = {};
    const porMesMap: Record<string, number> = {};

    let totalChecklistsOk = 0;

    fichas.forEach((f) => {
      const dateObj = new Date(f.data_registro || f.created_at || Date.now());
      const dateStr = dateObj.toISOString().split("T")[0];
      const mesStr = `${dateObj.getMonth() + 1}/${dateObj.getFullYear()}`;

      if (dateStr === todayStr) hojeCount++;
      if (dateObj >= startOfWeek) semanaCount++;
      if (dateObj >= startOfMonth) mesCount++;

      if (f.mecanico_responsavel) {
        mecanicosSet.add(f.mecanico_responsavel);
        porMecanicoMap[f.mecanico_responsavel] = (porMecanicoMap[f.mecanico_responsavel] || 0) + 1;
      }

      const eqNome = f.placa || f.equipamento?.placa || "Sem Placa";
      equipamentosSet.add(eqNome);
      porEquipamentoMap[eqNome] = (porEquipamentoMap[eqNome] || 0) + 1;

      const mod = f.modulo || "BASE";
      porModuloMap[mod] = (porModuloMap[mod] || 0) + 1;

      porDiaMap[dateStr] = (porDiaMap[dateStr] || 0) + 1;
      porMesMap[mesStr] = (porMesMap[mesStr] || 0) + 1;

      if (Array.isArray(f.calibragem)) totalCalibragens += f.calibragem.length;
      if (Array.isArray(f.reapertos)) totalReapertos += f.reapertos.length;

      // Calculo de conformidade
      if (f.status === "CONCLUÍDO") totalChecklistsOk++;

      // Calculo de tempo medio (hora inicio x fim)
      if (f.hora_inicio && f.hora_fim) {
        try {
          const [h1, m1] = f.hora_inicio.split(":").map(Number);
          const [h2, m2] = f.hora_fim.split(":").map(Number);
          if (!isNaN(h1) && !isNaN(m1) && !isNaN(h2) && !isNaN(m2)) {
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 24 * 60; // meia noite crossover
            if (diff > 0 && diff < 1440) {
              totalMinutos += diff;
              minutosCount++;
            }
          }
        } catch (e) {}
      }
    });

    const tempoMedioMinutos = minutosCount > 0 ? Math.round(totalMinutos / minutosCount) : 45;
    const taxaConformidade = total > 0 ? Math.round((totalChecklistsOk / total) * 100) : 100;

    // Charts arrays
    const chartMecanicos = Object.entries(porMecanicoMap)
      .map(([name, val]) => ({ name, quantidade: val }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);

    const chartEquipamentos = Object.entries(porEquipamentoMap)
      .map(([name, val]) => ({ name, quantidade: val }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);

    const chartModulos = Object.entries(porModuloMap).map(([name, value]) => ({ name, value }));

    const chartDias = Object.entries(porDiaMap)
      .map(([date, quantidade]) => ({ date, quantidade }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14);

    const chartMeses = Object.entries(porMesMap).map(([mes, quantidade]) => ({ mes, quantidade }));

    // Tabela de Equipamentos Pendentes / Atrasados
    const pendentesList = (equipamentos.length > 0 ? equipamentos : Array.from(equipamentosSet).map((p) => ({ placa: p, modulo: "BASE" }))).map((eq) => {
      const eqPlaca = eq.placa || eq;
      const fUltima = fichas.find((f) => f.placa === eqPlaca || f.equipamento?.placa === eqPlaca);
      const ultData = fUltima ? new Date(fUltima.data_registro) : null;

      let diasAtraso = 0;
      if (ultData) {
        const diffMs = now.getTime() - ultData.getTime();
        diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      } else {
        diasAtraso = 30; // padrão se nunca lubrificou
      }

      const horimetroAtual = fUltima?.horimetro_fim || 1200;
      const proximaLubrificacaoHorimetro = horimetroAtual + 250;

      return {
        placa: eqPlaca,
        equipamento: eq.tipo || eq.modulo || "Caminhão Comboio",
        ultimaLubrificacao: ultData ? ultData.toLocaleDateString("pt-BR") : "Nunca",
        horimetroAtual,
        proximaLubrificacao: `${proximaLubrificacaoHorimetro} hrs`,
        diasAtraso,
        status: diasAtraso > 15 ? "CRÍTICO" : diasAtraso > 7 ? "ATENÇÃO" : "EM DIA",
      };
    }).sort((a, b) => b.diasAtraso - a.diasAtraso).slice(0, 8);

    const pendenciasCount = pendentesList.filter((p) => p.diasAtraso > 7).length;

    return {
      total,
      hojeCount,
      semanaCount,
      mesCount,
      totalCalibragens,
      totalReapertos,
      equipamentosAtendidos: equipamentosSet.size,
      mecanicosAtivos: mecanicosSet.size,
      tempoMedioMinutos,
      pendenciasCount,
      taxaConformidade,
      chartMecanicos,
      chartEquipamentos,
      chartModulos,
      chartDias,
      chartMeses,
      pendentesList,
    };
  }, [fichas, equipamentos]);

  return (
    <div className="space-y-6">
      
      {/* 1. CARDS DE INDICADORES PRINCIPAIS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Total Lubrificações</span>
            <Droplets size={18} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black">{analytics.total}</span>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Histórico Geral</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 dark:text-blue-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Hoje</span>
            <Calendar size={18} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black">{analytics.hojeCount}</span>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Nesta Data</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-indigo-600 dark:text-indigo-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Esta Semana</span>
            <TrendingUp size={18} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black">{analytics.semanaCount}</span>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Últimos 7 dias</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 dark:text-purple-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Este Mês</span>
            <Award size={18} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black">{analytics.mesCount}</span>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Mês Vigente</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 dark:text-rose-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Pendências</span>
            <AlertTriangle size={18} />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-rose-600">{analytics.pendenciasCount}</span>
            <p className="text-[10px] text-zinc-500 font-bold mt-0.5">Requer atenção</p>
          </div>
        </div>

      </div>

      {/* SECUNDÁRIO: TEMPO MÉDIO, CONFORMIDADE E REAPERTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Conformidade</span>
            <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">{analytics.taxaConformidade}%</div>
            <p className="text-[10px] text-zinc-500">Checklists completos</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Clock size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Tempo Médio</span>
            <div className="text-xl font-black text-blue-600 dark:text-blue-400">{analytics.tempoMedioMinutos} min</div>
            <p className="text-[10px] text-zinc-500">Por serviço executado</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Gauge size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Calibragens</span>
            <div className="text-xl font-black text-amber-600 dark:text-amber-400">{analytics.totalCalibragens}</div>
            <p className="text-[10px] text-zinc-500">Pneus inspecionados</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20 flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
            <Truck size={22} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Frota Atendida</span>
            <div className="text-xl font-black text-purple-600 dark:text-purple-400">{analytics.equipamentosAtendidos}</div>
            <p className="text-[10px] text-zinc-500">{analytics.mecanicosAtivos} Mecânicos ativos</p>
          </div>
        </div>

      </div>

      {/* 2. GRÁFICOS VISUAIS RECHARTS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gráfico 1: Lubrificações por Mecânico */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            Lubrificações por Mecânico Responsável
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.chartMecanicos} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#10b981" radius={[6, 6, 0, 0]} name="Lubrificações" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Lubrificações por Equipamento (Ranking) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Truck size={16} className="text-blue-500" />
            Equipamentos com Mais Lubrificações (Top 10)
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={analytics.chartEquipamentos} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={70} />
                <Tooltip />
                <Bar dataKey="quantidade" fill="#3b82f6" radius={[0, 6, 6, 0]} name="Lubrificações" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3: Distribuição por Módulo (Pizza) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <Droplets size={16} className="text-purple-500" />
            Serviços Executados por Módulo
          </h4>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.chartModulos}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {analytics.chartModulos.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 4: Evolução Diária de Lubrificações (Linha) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
            <TrendingUp size={16} className="text-amber-500" />
            Evolução Diária de Lançamentos
          </h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.chartDias} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="quantidade" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} name="Serviços" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. TABELA DE EQUIPAMENTOS PENDENTES / ATRASADOS */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            Equipamentos Pendentes de Lubrificação (Manutenção Preventiva)
          </h4>
          <span className="text-[10px] font-bold text-zinc-400 uppercase">Ciclo Sugerido: 250 Horas</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-extrabold uppercase text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Placa</th>
                <th className="px-3 py-2.5">Equipamento</th>
                <th className="px-3 py-2.5">Última Lubrificação</th>
                <th className="px-3 py-2.5 text-center">Horímetro Atual</th>
                <th className="px-3 py-2.5 text-center">Próxima Lubrificação</th>
                <th className="px-3 py-2.5 text-center">Dias sem Lubr.</th>
                <th className="px-3 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
              {analytics.pendentesList.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850">
                  <td className="px-3 py-2 font-black font-mono text-emerald-600 dark:text-emerald-400">{row.placa}</td>
                  <td className="px-3 py-2 font-bold">{row.equipamento}</td>
                  <td className="px-3 py-2">{row.ultimaLubrificacao}</td>
                  <td className="px-3 py-2 text-center font-mono font-bold">{row.horimetroAtual} hrs</td>
                  <td className="px-3 py-2 text-center font-mono font-bold">{row.proximaLubrificacao}</td>
                  <td className="px-3 py-2 text-center font-mono font-black">{row.diasAtraso} dias</td>
                  <td className="px-3 py-2 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        row.status === "CRÍTICO"
                          ? "bg-rose-500 text-white"
                          : row.status === "ATENÇÃO"
                          ? "bg-amber-500 text-white"
                          : "bg-emerald-500 text-white"
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
