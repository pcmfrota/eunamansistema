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
  Legend,
  LabelList
} from "recharts";
import { BarChart2, Clock, Users, TrendingUp } from "lucide-react";
import { findPeriodoSuzano, MONTHS_PT } from "@/lib/calendario-suzano";
import type { FichaMaoObraItem, AtividadeJornada } from "./FichaPDFModal";

const PRODUTIVO_COLOR = "#4f46e5"; // indigo — paleta padrão do projeto
const OCIOSO_COLOR = "#f97316"; // laranja — usado como "Improdutivo" na exibição
const NAO_APONTADO_COLOR = "#94a3b8"; // slate — tempo da jornada sem nenhum registro
const PIE_COLORS = ["#4f46e5", "#10b981", "#f97316", "#0ea5e9", "#a855f7", "#ec4899", "#14b8a6", "#eab308", "#ef4444", "#64748b", "#a1a1aa"];

// Duração da jornada (início/fim do dia) menos o total apontado — mesmo cálculo já usado
// no relatório individual (FichaPDFModal), aqui agregado pro dashboard.
function calcNaoApontado(f: FichaMaoObraItem): number {
  if (!f.hora_inicio_jornada || !f.hora_fim_jornada) return 0;
  const [h1, m1] = f.hora_inicio_jornada.split(":").map(Number);
  const [h2, m2] = f.hora_fim_jornada.split(":").map(Number);
  if ([h1, m1, h2, m2].some(v => isNaN(v))) return 0;
  let totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (totalMin < 0) totalMin += 24 * 60;
  const duracaoJornada = totalMin / 60;
  const apontado = f.tempo_total_horas || 0;
  return Math.max(0, Number((duracaoJornada - apontado).toFixed(2)));
}

// Formata o valor de uma barra/fatia só quando há algo relevante pra mostrar — evita poluir
// o gráfico com rótulos "0h" em toda barra vazia.
const horasLabel = (v: any) => (typeof v === "number" && v > 0 ? `${v}h` : "");

interface Props {
  fichas: FichaMaoObraItem[];
  apontamentos?: AtividadeJornada[];
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

export default function MaoDeObraDashboard({ fichas = [], apontamentos = [], colaboradores = [], calendario = [] }: Props) {
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

  // Período personalizado (De/Até): quando preenchido, vale mais que o mês/ano do calendário
  // Suzano acima — dá pra olhar uma janela de datas qualquer, sem ficar preso a um RF inteiro.
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
  const periodoPersonalizadoAtivo = Boolean(filtroDataInicio && filtroDataFim);

  // Período selecionado: usa o intervalo real do calendário Suzano (RF'XX) quando existe, senão cai pro mês civil.
  const selectedPeriodo = useMemo(() => {
    if (periodoPersonalizadoAtivo) {
      return { mes: null, ano: null, data_inicio: filtroDataInicio, data_fim: filtroDataFim };
    }

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
  }, [calendario, filterMes, filterAno, periodoPersonalizadoAtivo, filtroDataInicio, filtroDataFim]);

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
    const horasNaoApontadas = fichasFiltradas.reduce((acc, f) => acc + calcNaoApontado(f), 0);
    const produtividade = horasTotais > 0 ? Math.round((horasProdutivas / horasTotais) * 100) : 0;
    const colaboradoresAtivos = new Set(fichasFiltradas.map(f => f.mecanico_nome)).size;
    return {
      finalizadas,
      horasTotais: Number(horasTotais.toFixed(1)),
      horasProdutivas: Number(horasProdutivas.toFixed(1)),
      horasOciosas: Number(horasOciosas.toFixed(1)),
      horasNaoApontadas: Number(horasNaoApontadas.toFixed(1)),
      produtividade,
      colaboradoresAtivos
    };
  }, [fichasFiltradas]);

  // Horas por dia dentro do período selecionado
  const dadosPorDia = useMemo(() => {
    const map: Record<string, { produtivo: number; ocioso: number; naoApontado: number }> = {};
    fichasFiltradas.forEach(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (!d) return;
      if (!map[d]) map[d] = { produtivo: 0, ocioso: 0, naoApontado: 0 };
      map[d].produtivo += f.tempo_produtivo_horas || 0;
      map[d].ocioso += f.tempo_ocioso_horas || 0;
      map[d].naoApontado += calcNaoApontado(f);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, v]) => ({
        data: data.split("-").reverse().slice(0, 2).join("/"),
        produtivo: Number(v.produtivo.toFixed(2)),
        ocioso: Number(v.ocioso.toFixed(2)),
        naoApontado: Number(v.naoApontado.toFixed(2))
      }));
  }, [fichasFiltradas]);

  // Tendência mensal — todas as fichas, agrupadas pelo período Suzano de cada data_jornada
  const dadosPorMes = useMemo(() => {
    const map: Record<string, { ano: number; mes: number; produtivo: number; ocioso: number; naoApontado: number }> = {};
    (fichas || []).forEach(f => {
      const d = f.data_jornada || f.created_at?.split("T")[0];
      if (!d) return;
      const periodo = findPeriodoSuzano(d, calendario);
      const ano = periodo ? Number(periodo.ano) : Number(d.split("-")[0]);
      const mes = periodo ? Number(periodo.mes) : Number(d.split("-")[1]);
      const key = `${ano}-${String(mes).padStart(2, "0")}`;
      if (!map[key]) map[key] = { ano, mes, produtivo: 0, ocioso: 0, naoApontado: 0 };
      map[key].produtivo += f.tempo_produtivo_horas || 0;
      map[key].ocioso += f.tempo_ocioso_horas || 0;
      map[key].naoApontado += calcNaoApontado(f);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => ({
        mes: `${(MONTHS_PT[v.mes - 1] || "-").slice(0, 3)}/${String(v.ano).slice(2)}`,
        produtivo: Number(v.produtivo.toFixed(2)),
        ocioso: Number(v.ocioso.toFixed(2)),
        naoApontado: Number(v.naoApontado.toFixed(2))
      }));
  }, [fichas, calendario]);

  // Distribuição por tipo de atividade, no período selecionado.
  // Fonte primária é a lista de apontamentos individuais; cai para o JSONB
  // legado (ficha.atividades) só para fichas antigas sem nenhum apontamento próprio.
  const dadosPorTipo = useMemo(() => {
    const map: Record<string, number> = {};
    const jornadaIds = new Set(fichasFiltradas.map(f => f.id));
    const jornadasComApontamento = new Set<string>();

    (apontamentos || []).forEach(a => {
      if (!a.jornada_id || !jornadaIds.has(a.jornada_id)) return;
      jornadasComApontamento.add(a.jornada_id);
      const minutos = typeof a.tempo_gasto_minutos === "number" ? a.tempo_gasto_minutos : 0;
      if (!minutos) return;
      map[a.tipo_atividade] = (map[a.tipo_atividade] || 0) + minutos / 60;
    });

    fichasFiltradas.forEach(f => {
      if (jornadasComApontamento.has(f.id)) return;
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
  }, [fichasFiltradas, apontamentos]);

  // Ranking por colaborador — mostra, para cada um, quanto da carga horária da jornada
  // (início/fim apontados) foi produtivo, improdutivo, e quanto ficou sem nenhum registro.
  const ranking = useMemo(() => {
    const map: Record<string, { produtivo: number; ocioso: number; naoApontado: number; total: number }> = {};
    fichasFiltradas.forEach(f => {
      const nome = f.mecanico_nome || "Sem nome";
      if (!map[nome]) map[nome] = { produtivo: 0, ocioso: 0, naoApontado: 0, total: 0 };
      map[nome].produtivo += f.tempo_produtivo_horas || 0;
      map[nome].ocioso += f.tempo_ocioso_horas || 0;
      map[nome].naoApontado += calcNaoApontado(f);
      map[nome].total += f.tempo_total_horas || 0;
    });
    return Object.entries(map)
      .map(([nome, v]) => ({
        nome,
        produtivo: Number(v.produtivo.toFixed(1)),
        ocioso: Number(v.ocioso.toFixed(1)),
        naoApontado: Number(v.naoApontado.toFixed(1)),
        total: Number(v.total.toFixed(1)),
        pct: v.total > 0 ? Math.round((v.produtivo / v.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total);
  }, [fichasFiltradas]);

  // Proporção geral Produtivo x Improdutivo x Não Apontado, no período selecionado
  const dadosProdutivoImprodutivo = useMemo(
    () => [
      { name: "Produtivo", value: kpis.horasProdutivas },
      { name: "Improdutivo", value: kpis.horasOciosas },
      { name: "Não Apontado", value: kpis.horasNaoApontadas }
    ],
    [kpis]
  );

  // Horas por colaborador (produtivo x improdutivo x não apontado) — mesma base do ranking, em gráfico
  const dadosPorColaborador = useMemo(
    () => ranking.map(r => ({ nome: r.nome, produtivo: r.produtivo, ocioso: r.ocioso, naoApontado: r.naoApontado })),
    [ranking]
  );

  // Distribuição por Tipo de Manutenção (Corretiva Emergencial/Programada, Preventiva, Preditiva)
  const dadosPorTipoManutencao = useMemo(() => {
    const jornadaIds = new Set(fichasFiltradas.map(f => f.id));
    const map: Record<string, number> = {};
    (apontamentos || []).forEach(a => {
      if (!a.jornada_id || !jornadaIds.has(a.jornada_id) || !a.tipo_manutencao) return;
      const minutos = typeof a.tempo_gasto_minutos === "number" ? a.tempo_gasto_minutos : 0;
      map[a.tipo_manutencao] = (map[a.tipo_manutencao] || 0) + minutos / 60;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [fichasFiltradas, apontamentos]);

  const selectCls =
    "px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold outline-none";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-3">
        <select
          value={filterMes}
          onChange={e => setFilterMes(e.target.value)}
          disabled={periodoPersonalizadoAtivo}
          className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {MONTHS_PT.map(m => (
            <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <select
          value={filterAno}
          onChange={e => setFilterAno(e.target.value)}
          disabled={periodoPersonalizadoAtivo}
          className={`${selectCls} disabled:opacity-40 disabled:cursor-not-allowed`}
        >
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

        <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Período</span>
          <input
            type="date"
            value={filtroDataInicio}
            onChange={e => setFiltroDataInicio(e.target.value)}
            className={selectCls}
          />
          <span className="text-[10px] text-slate-400">até</span>
          <input
            type="date"
            value={filtroDataFim}
            onChange={e => setFiltroDataFim(e.target.value)}
            className={selectCls}
          />
          {periodoPersonalizadoAtivo && (
            <button
              type="button"
              onClick={() => { setFiltroDataInicio(""); setFiltroDataFim(""); }}
              title="Limpar período personalizado e voltar ao mês selecionado"
              className="px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        <span className="text-[10px] text-slate-400 font-semibold ml-auto">
          {periodoPersonalizadoAtivo ? "Período personalizado: " : "Período: "}
          {selectedPeriodo.data_inicio?.split("-").reverse().join("/")} — {selectedPeriodo.data_fim?.split("-").reverse().join("/")}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
        <KpiCard label="Jornadas Finalizadas" value={kpis.finalizadas} color="text-slate-900 dark:text-white" />
        <KpiCard label="Horas Apontadas" value={`${kpis.horasTotais}h`} color="text-slate-900 dark:text-white" />
        <KpiCard label="Horas Produtivas" value={`${kpis.horasProdutivas}h`} color="text-indigo-600 dark:text-indigo-400" />
        <KpiCard label="Horas Improdutivas" value={`${kpis.horasOciosas}h`} color="text-orange-600 dark:text-orange-400" />
        <KpiCard label="Horas Não Apontadas" value={`${kpis.horasNaoApontadas}h`} color="text-slate-500 dark:text-slate-400" />
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
                  <Bar dataKey="produtivo" name="Produtivo" stackId="a" fill={PRODUTIVO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="produtivo" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="ocioso" name="Improdutivo" stackId="a" fill={OCIOSO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="ocioso" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="naoApontado" name="Não Apontado" stackId="a" fill={NAO_APONTADO_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="naoApontado" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
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
                  <Bar dataKey="produtivo" name="Produtivo" stackId="a" fill={PRODUTIVO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="produtivo" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="ocioso" name="Improdutivo" stackId="a" fill={OCIOSO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="ocioso" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="naoApontado" name="Não Apontado" stackId="a" fill={NAO_APONTADO_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="naoApontado" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
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
                    label={({ name, value, percent }) => `${name}: ${value}h (${(percent * 100).toFixed(0)}%)`}
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

        {/* Produtivo x Improdutivo x Não Apontado (proporção geral) */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BarChart2 size={14} /> Produtivo x Improdutivo x Não Apontado
          </h3>
          <div className="h-64 w-full">
            {(kpis.horasTotais > 0 || kpis.horasNaoApontadas > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dadosProdutivoImprodutivo}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value, percent }) => `${name}: ${value}h (${(percent * 100).toFixed(0)}%)`}
                  >
                    <Cell fill={PRODUTIVO_COLOR} />
                    <Cell fill={OCIOSO_COLOR} />
                    <Cell fill={NAO_APONTADO_COLOR} />
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic flex items-center justify-center h-full">Sem apontamentos no período.</p>
            )}
          </div>
        </div>

        {/* Distribuição por Tipo de Manutenção */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <BarChart2 size={14} /> Por Tipo de Manutenção
          </h3>
          <div className="h-64 w-full">
            {dadosPorTipoManutencao.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorTipoManutencao} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} horizontal={false} />
                  <XAxis type="number" stroke="#888888" fontSize={10} />
                  <YAxis type="category" dataKey="name" stroke="#888888" fontSize={9} width={140} />
                  <Tooltip />
                  <Bar dataKey="value" name="Horas" fill={PRODUTIVO_COLOR} radius={[0, 4, 4, 0]} barSize={16}>
                    <LabelList dataKey="value" position="right" fontSize={10} formatter={horasLabel} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-slate-400 italic flex items-center justify-center h-full">Nenhuma atividade com tipo de manutenção informado.</p>
            )}
          </div>
        </div>

        {/* Horas por Colaborador (Produtivo x Improdutivo x Não Apontado) */}
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
          <h3 className="text-xs font-extrabold uppercase text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Users size={14} /> Horas por Colaborador
          </h3>
          <div className="h-64 w-full">
            {dadosPorColaborador.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosPorColaborador}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="nome" stroke="#888888" fontSize={9} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis stroke="#888888" fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="produtivo" name="Produtivo" stackId="a" fill={PRODUTIVO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="produtivo" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="ocioso" name="Improdutivo" stackId="a" fill={OCIOSO_COLOR} radius={[0, 0, 0, 0]}>
                    <LabelList dataKey="ocioso" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                  <Bar dataKey="naoApontado" name="Não Apontado" stackId="a" fill={NAO_APONTADO_COLOR} radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="naoApontado" position="inside" fill="#fff" fontSize={9} formatter={horasLabel} />
                  </Bar>
                </BarChart>
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
                    <th className="p-2 text-right">Improdutivo</th>
                    <th className="p-2 text-right">Não Apontado</th>
                    <th className="p-2 text-right">Total Apontado</th>
                    <th className="p-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {ranking.map(r => (
                    <tr key={r.nome}>
                      <td className="p-2 font-bold">{r.nome}</td>
                      <td className="p-2 text-right font-semibold text-indigo-600 dark:text-indigo-400">{r.produtivo}h</td>
                      <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400">{r.ocioso}h</td>
                      <td className="p-2 text-right font-semibold text-slate-500 dark:text-slate-400">{r.naoApontado}h</td>
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
