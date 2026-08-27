"use client";

import React, { useMemo, useState } from "react";
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
  Legend
} from "recharts";
import { BarChart2, Clock, Users, TrendingUp } from "lucide-react";
import { findPeriodoSuzano, MONTHS_PT } from "@/lib/calendario-suzano";
import type { FichaMaoObraItem } from "./FichaPDFModal";

const PRODUTIVO_COLOR = "#4f46e5"; // indigo — paleta padrão do projeto
const OCIOSO_COLOR = "#f97316"; // laranja
const PIE_COLORS = ["#4f46e5", "#10b981", "#f97316", "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#64748b", "#a1a1aa"];

interface Props {
  fichas: FichaMaoObraItem[];
  colaboradores?: any[];
  calendario?: any[];
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase">{label}</span>
      <div className={`text-xl font-black ${color}`}>{value}</div>
    </div>
  );
}

export default function MaoDeObraDashboard({ fichas = [], colaboradores = [], calendario = [] }: Props) {
  const currentPeriod = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const period = Array.isArray(calendario) ? calendario.find(p => p && p.data_inicio <= today && p.data_fim >= today) : null;
    if (period) return period;
    const now = new Date();
    return { ano: now.getFullYear(), mes: now.getMonth() + 1 };
  }, [calendario]);

  const defaultMonthName = useMemo(() => MONTHS_PT[Number(currentPeriod.mes) - 1] || "janeiro", [currentPeriod]);
  const defaultYearString = useMemo(() => String(currentPeriod.ano), [currentPeriod]);

  const [filterMes, setFilterMes] = useState(defaultMonthName);
  const [filterAno, setFilterAno] = useState(defaultYearString);
  const [filterColaborador, setFilterColaborador] = useState("");

  // Período selecionado: usa o intervalo real do calendário Suzano (RF'XX) quando existe, senão cai pro mês civil.
  const selectedPeriodo = useMemo(() => {
    const mIdx = MONTHS_PT.indexOf(filterMes.toLowerCase()) + 1;
    const yVal = Number(filterAno);

    if (mIdx > 0 && yVal > 0) {
      const cal = (calendario || []).find(p => p && Number(p.mes) === mIdx && Number(p.ano) === yVal);
      if (cal) return cal;
    }

    const today = new Date();
    const targetMonth = mIdx > 0 ? mIdx : today.getMonth() + 1;
    const targetYear = yVal > 0 ? yVal : today.getFullYear();
    const data_inicio = `${targetYear}-${String(targetMonth).padStart(2, "0")}-01`;
    const diasNoMes = new Date(targetYear, targetMonth, 0).getDate();
    const data_fim = `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(diasNoMes).padStart(2, "0")}`;
    return { mes: targetMonth, ano: targetYear, data_inicio, data_fim };
  }, [calendario, filterMes, filterAno]);

  const anoOptions = useMemo(() => {
    const anos = new Set<string>();
    (fichas || []).forEach(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (d) anos.add(d.split("-")[0]);
    });
    return Array.from(anos).sort();
  }, [fichas]);

  const colaboradorOptions = useMemo(
    () => Array.from(new Set((fichas || []).map(f => f.mecanico_nome).filter(Boolean))).sort(),
    [fichas]
  );

  const fichasFiltradas = useMemo(() => {
    return (fichas || []).filter(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (!d) return false;
      if (d < selectedPeriodo.data_inicio || d > selectedPeriodo.data_fim) return false;
      if (filterColaborador && f.mecanico_nome !== filterColaborador) return false;
      return true;
    });
  }, [fichas, selectedPeriodo, filterColaborador]);

  const kpis = useMemo(() => {
    const finalizadas = fichasFiltradas.filter(f => f.status === "Finalizado").length;
    const horasTotais = fichasFiltradas.reduce((acc, f) => acc + (f.tempo_total_horas || 0), 0);
    const horasProdutivas = fichasFiltradas.reduce((acc, f) => acc + (f.tempo_produtivo_horas || 0), 0);
    const horasOciosas = fichasFiltradas.reduce((acc, f) => acc + (f.tempo_ocioso_horas || 0), 0);
    const produtividade = horasTotais > 0 ? Math.round((horasProdutivas / horasTotais) * 100) : 0;
    const colaboradoresAtivos = new Set(fichasFiltradas.map(f => f.mecanico_nome)).size;
    return {
      finalizadas,
      horasTotais: Number(horasTotais.toFixed(1)),
      horasProdutivas: Number(horasProdutivas.toFixed(1)),
      horasOciosas: Number(horasOciosas.toFixed(1)),
      produtividade,
      colaboradoresAtivos
    };
  }, [fichasFiltradas]);

  // Horas por dia dentro do período selecionado
  const dadosPorDia = useMemo(() => {
    const map: Record<string, { produtivo: number; ocioso: number }> = {};
    fichasFiltradas.forEach(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (!d) return;
      if (!map[d]) map[d] = { produtivo: 0, ocioso: 0 };
      map[d].produtivo += f.tempo_produtivo_horas || 0;
      map[d].ocioso += f.tempo_ocioso_horas || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({
        data: data.split("-").reverse().slice(0, 2).join("/"),
        produtivo: Number(v.produtivo.toFixed(2)),
        ocioso: Number(v.ocioso.toFixed(2))
      }));
  }, [fichasFiltradas]);

  // Tendência mensal — todas as fichas, agrupadas pelo período Suzano de cada data_jornada
  const dadosPorMes = useMemo(() => {
    const map: Record<string, { ano: number; mes: number; produtivo: number; ocioso: number }> = {};
    (fichas || []).forEach(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (!d) return;
      const periodo = findPeriodoSuzano(d, calendario);
      const ano = periodo ? Number(periodo.ano) : Number(d.split("-")[0]);
      const mes = periodo ? Number(periodo.mes) : Number(d.split("-")[1]);
      const key = `${ano}-${String(mes).padStart(2, "0")}`;
      if (!map[key]) map[key] = { ano, mes, produtivo: 0, ocioso: 0 };
      map[key].produtivo += f.tempo_produtivo_horas || 0;
      map[key].ocioso += f.tempo_ocioso_horas || 0;
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        mes: `${(MONTHS_PT[v.mes - 1] || "-").slice(0, 3)}/${String(v.ano).slice(2)}`,
        produtivo: Number(v.produtivo.toFixed(2)),
        ocioso: Number(v.ocioso.toFixed(2))
      }));
  }, [fichas, calendario]);

  // Distribuição por tipo de atividade, no período selecionado
  const dadosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    fichasFiltradas.forEach(f => {
      (f.atividades || []).forEach(a => {
        if (!a.tempo_gasto) return;
        const [h, m] = a.tempo_gasto.split(":").map(Number);
        if (isNaN(h) || isNaN(m)) return;
        map[a.tipo_atividade] = (map[a.tipo_atividade] || 0) + h + m / 60;
      });
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [fichasFiltradas]);

  // Ranking por colaborador
  const ranking = useMemo(() => {
    const map: Record<string, { produtivo: number; ocioso: number; total: number }> = {};
    fichasFiltradas.forEach(f => {
      const nome = f.mecanico_nome || "Sem nome";
      if (!map[nome]) map[nome] = { produtivo: 0, ocioso: 0, total: 0 };
      map[nome].produtivo += f.tempo_produtivo_horas || 0;
      map[nome].ocioso += f.tempo_ocioso_horas || 0;
      map[nome].total += f.tempo_total_horas || 0;
    });
    return Object.entries(map)
      .map(([nome, v]) => ({
        nome,
        produtivo: Number(v.produtivo.toFixed(1)),
        ocioso: Number(v.ocioso.toFixed(1)),
        total: Number(v.total.toFixed(1)),
        pct: v.total > 0 ? Math.round((v.produtivo / v.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [fichasFiltradas]);

  const selectCls =
    "px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <select value={filterMes} onChange={e => setFilterMes(e.target.value)} className={selectCls}>
          {MONTHS_PT.map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <select value={filterAno} onChange={e => setFilterAno(e.target.value)} className={selectCls}>
          {anoOptions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <select value={filterColaborador} onChange={e => setFilterColaborador(e.target.value)} className={selectCls}>
          <option value="">Todos os Colaboradores</option>
          {colaboradorOptions.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-[10px] text-slate-400 font-semibold ml-auto">
          Período: {selectedPeriodo.data_inicio?.split("-").reverse().join("/")} — {selectedPeriodo.data_fim?.split("-").reverse().join("/")}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <KpiCard label="Jornadas Finalizadas" value={kpis.finalizadas} color="text-slate-900 dark:text-white" />
        <KpiCard label="Horas Apontadas" value={`${kpis.horasTotais}h`} color="text-slate-900 dark:text-white" />
        <KpiCard label="Horas Produtivas" value={`${kpis.horasProdutivas}h`} color="text-indigo-600 dark:text-indigo-400" />
        <KpiCard label="Horas Ociosas" value={`${kpis.horasOciosas}h`} color="text-orange-600 dark:text-orange-400" />
        <KpiCard label="% Produtividade" value={`${kpis.produtividade}%`} color="text-emerald-600 dark:text-emerald-400" />
        <KpiCard label="Colaboradores Ativos" value={kpis.colaboradoresAtivos} color="text-purple-600 dark:text-purple-400" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Clock size={14} /> Horas por Dia (período selecionado)
          </h3>
          <div className="h-64 w-full">
            {dadosPorDia.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorDia}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="data" stroke="#888888" fontSize={10} />
                  <YAxis stroke="#888888" fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="produtivo" name="Produtivo" stackId="a" fill={PRODUTIVO_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="ocioso" name="Ocioso" stackId="a" fill={OCIOSO_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic flex items-center justify-center h-full">Sem apontamentos no período.</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <TrendingUp size={14} /> Tendência Mensal
          </h3>
          <div className="h-64 w-full">
            {dadosPorMes.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="mes" stroke="#888888" fontSize={10} />
                  <YAxis stroke="#888888" fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="produtivo" name="Produtivo" stackId="a" fill={PRODUTIVO_COLOR} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="ocioso" name="Ocioso" stackId="a" fill={OCIOSO_COLOR} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic flex items-center justify-center h-full">Sem dados suficientes.</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BarChart2 size={14} /> Distribuição por Tipo de Atividade
          </h3>
          <div className="h-64 w-full">
            {dadosPorTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosPorTipo}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {dadosPorTipo.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic flex items-center justify-center h-full">Sem apontamentos no período.</p>
            )}
          </div>
        </div>

        {/* Ranking por Colaborador */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Users size={14} /> Ranking por Colaborador
          </h3>
          {ranking.length > 0 ? (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-extrabold uppercase sticky top-0">
                  <tr>
                    <th className="p-2">Colaborador</th>
                    <th className="p-2 text-right">Produtivo</th>
                    <th className="p-2 text-right">Ocioso</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ranking.map(r => (
                    <tr key={r.nome}>
                      <td className="p-2 font-bold">{r.nome}</td>
                      <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">{r.produtivo}h</td>
                      <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400">{r.ocioso}h</td>
                      <td className="p-2 text-right font-black">{r.total}h</td>
                      <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Sem apontamentos no período.</p>
          )}
        </div>
      </div>
    </div>
  );
}
