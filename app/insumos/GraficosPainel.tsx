"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import {
  getConsumoDieselPorDia, getConsumoPorEquipamento, getConsumoPorInsumo, getConsumoPorCategoriaVeiculo,
  PontoDia, PontoEquipamento, PontoInsumo, PontoCategoria,
} from "./graficosActions";
import { INSUMO_LABEL } from "./config";

const CHART_COLORS = ["#2563eb", "#16a34a", "#f59e0b", "#8b5cf6", "#0891b2", "#dc2626", "#64748b", "#db2777"];
const inputCls = "px-3 py-2 text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 outline-none focus:border-amber-500";

function primeiroDiaDoMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function formatarLitros(v: number) {
  return `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L`;
}
function formatarDiaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

export default function GraficosPainel() {
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes());
  const [dataFim, setDataFim] = useState(hoje());
  const [porDia, setPorDia] = useState<PontoDia[]>([]);
  const [porEquipamento, setPorEquipamento] = useState<PontoEquipamento[]>([]);
  const [porInsumo, setPorInsumo] = useState<PontoInsumo[]>([]);
  const [porCategoria, setPorCategoria] = useState<PontoCategoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      getConsumoDieselPorDia(dataInicio, dataFim),
      getConsumoPorEquipamento(dataInicio, dataFim),
      getConsumoPorInsumo(dataInicio, dataFim),
      getConsumoPorCategoriaVeiculo(dataInicio, dataFim),
    ]).then(([dia, equip, insumo, categoria]) => {
      if (!ativo) return;
      setPorDia(dia); setPorEquipamento(equip); setPorInsumo(insumo); setPorCategoria(categoria);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [dataInicio, dataFim]);

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-wrap gap-2 items-center">
        <input type="date" className={inputCls} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        <span className="text-xs text-zinc-400">até</span>
        <input type="date" className={inputCls} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>

      {carregando ? (
        <div className="p-8 text-center text-sm text-zinc-400">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 lg:col-span-2">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Consumo de Diesel por Dia</h3>
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={porDia} margin={{ left: 5, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis dataKey="dia" tickFormatter={formatarDiaCurto} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={58} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatarLitros(v)} labelFormatter={formatarDiaCurto} />
                  <Line type="monotone" dataKey="litros" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {porDia.length === 0 && <div className="text-center text-xs text-zinc-400 pt-2">Nenhum lançamento de diesel no período.</div>}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Top 10 Equipamentos (Diesel)</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porEquipamento} layout="vertical" margin={{ left: 0, right: 55, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                  <YAxis dataKey="equipamento" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                  <Tooltip formatter={(v: number) => formatarLitros(v)} />
                  <Bar dataKey="litros" radius={[0, 4, 4, 0]} barSize={14} fill="#f59e0b">
                    <LabelList dataKey="litros" position="right" formatter={formatarLitros} style={{ fontSize: 9, fill: "#52525b" }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {porEquipamento.length === 0 && <div className="text-center text-xs text-zinc-400 pt-2">Sem dados no período.</div>}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-3">Consumo por Tipo de Insumo</h3>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porInsumo} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                  <YAxis dataKey="insumo_tipo" type="category" tickFormatter={(t) => INSUMO_LABEL[t as keyof typeof INSUMO_LABEL] || t} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={110} />
                  <Tooltip formatter={(v: number) => v.toLocaleString("pt-BR")} labelFormatter={(t) => INSUMO_LABEL[t as keyof typeof INSUMO_LABEL] || t} />
                  <Bar dataKey="quantidade" radius={[0, 4, 4, 0]} barSize={14}>
                    <LabelList dataKey="quantidade" position="right" formatter={(v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} style={{ fontSize: 9, fill: "#52525b" }} />
                    {porInsumo.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {porInsumo.length === 0 && <div className="text-center text-xs text-zinc-400 pt-2">Sem dados no período.</div>}
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 lg:col-span-2">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-1">Consumo de Diesel por Categoria de Veículo</h3>
            <p className="text-[10px] text-zinc-400 mb-3">Cruza o equipamento lançado com o Cadastro de Máquinas Suzano (frente HV/FW/Gruas).</p>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porCategoria} layout="vertical" margin={{ left: 0, right: 65, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                  <XAxis type="number" hide domain={[0, (dataMax: number) => dataMax * 1.2]} />
                  <YAxis dataKey="categoria" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={140} />
                  <Tooltip formatter={(v: number) => formatarLitros(v)} />
                  <Bar dataKey="litros" radius={[0, 4, 4, 0]} barSize={16}>
                    <LabelList dataKey="litros" position="right" formatter={formatarLitros} style={{ fontSize: 9, fill: "#52525b" }} />
                    {porCategoria.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {porCategoria.length === 0 && <div className="text-center text-xs text-zinc-400 pt-2">Sem dados no período.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
