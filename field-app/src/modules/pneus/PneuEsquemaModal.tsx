"use client";

import React from "react";
import { X, Calendar, Gauge, AlertTriangle, CheckCircle, Clock, FileDown, Share2 } from "lucide-react";
import { gerarFichaPneusPDF } from "./pdfBoletim";
import { condicaoPorSulco, normalizarCondicaoPneu, sulcoTailwind, calcCondicaoPneu, CONDICAO_LABEL } from "@/src/models/pneus";

type Inspecao = {
  id: string;
  equipamento_id: string;
  data_inspecao: string;
  created_at?: string | null;
  km_atual: number | null;
  de: number | null; dd: number | null;
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null;
  estepe: number | null;
  // Sulco 1 (lado direito) e Sulco 3 (lado esquerdo) de cada posição — usados na ficha em PDF.
  de_s1?: number | null; de_s3?: number | null;
  dd_s1?: number | null; dd_s3?: number | null;
  tei_s1?: number | null; tei_s3?: number | null;
  tee_s1?: number | null; tee_s3?: number | null;
  tdi_s1?: number | null; tdi_s3?: number | null;
  tde_s1?: number | null; tde_s3?: number | null;
  tei1_s1?: number | null; tei1_s3?: number | null;
  tee1_s1?: number | null; tee1_s3?: number | null;
  tdi1_s1?: number | null; tdi1_s3?: number | null;
  tde1_s1?: number | null; tde1_s3?: number | null;
  estepe_s1?: number | null; estepe_s3?: number | null;
  condicao: string;
  registrado_por_nome?: string | null;
  equipamentos?: { placa: string; tipo?: string | null; modulo?: string | null; categoria?: string | null };
};

// ── Color helpers ────────────────────────────────────────────────────────────
// Faixa de sulco (mm) em 3 níveis (fonte única em src/models/pneus.ts): até 4mm crítico,
// 5-6mm recapagem, acima de 6mm bom.
function sulcoBg(v: number | null): string {
  return sulcoTailwind(v);
}

function sulcoGlow(v: number | null): string {
  if (v == null) return "";
  const c = condicaoPorSulco(v);
  if (c === "CRITICO") return "shadow-lg shadow-red-500/40";
  if (c === "RECAPAGEM") return "shadow-lg shadow-yellow-400/40";
  return "shadow-lg shadow-emerald-500/40";
}

function condColor(c: string) {
  const cond = normalizarCondicaoPneu(c, "BOM");
  return cond === "BOM" ? "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30"
       : cond === "RECAPAGEM" ? "text-yellow-600 bg-yellow-50 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400"
       : "text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:text-red-400";
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-");
  return `${d}/${m}/${y}`;
}

// ── Tire Cell ─────────────────────────────────────────────────────────────────
function Tire({ label, value, small }: { label: string; value: number | null; small?: boolean }) {
  const hasValue = value != null;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`
          ${small ? "w-9 h-12" : "w-10 h-14"}
          flex flex-col items-center justify-center rounded-lg border-2 transition-all
          ${hasValue
            ? `${sulcoBg(value)} border-transparent ${sulcoGlow(value)} cursor-default`
            : "bg-zinc-50 dark:bg-zinc-900 border-dashed border-zinc-300 dark:border-zinc-700"}
        `}
      >
        <span className={`font-black leading-none ${small ? "text-sm" : "text-base"}`}>
          {hasValue ? value : "—"}
        </span>
        {hasValue && (
          <span className="text-[8px] font-bold opacity-70 leading-tight">mm</span>
        )}
      </div>
      <span className="text-[8px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
    </div>
  );
}

// ── Axle pair (outer | inner) ─────────────────────────────────────────────────
function AxleSide({ outer, outerLabel, inner, innerLabel, reverse }: {
  outer: number | null; outerLabel: string;
  inner: number | null; innerLabel: string;
  reverse?: boolean;
}) {
  const items = [
    <Tire key="i" label={innerLabel} value={inner} />,
    <Tire key="o" label={outerLabel} value={outer} />,
  ];
  return (
    <div className={`flex items-center gap-1 ${reverse ? "flex-row-reverse" : "flex-row"}`}>
      {reverse ? items : items.reverse()}
    </div>
  );
}

// ── Truck body SVG element ────────────────────────────────────────────────────
function TruckBody({ hasEixo2, isLeve }: { hasEixo2: boolean; isLeve?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-between w-24 mx-3 select-none">
      {/* Cab */}
      <div className="w-16 h-8 bg-gradient-to-b from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 rounded-t-2xl rounded-b-sm shadow-inner flex items-center justify-center">
        <div className="w-10 h-4 bg-zinc-200 dark:bg-zinc-500 rounded-sm opacity-60" />
      </div>
      {/* Engine block */}
      <div className="w-20 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
      {/* Chassis */}
      <div className={`w-6 ${hasEixo2 ? "h-28" : "h-16"} bg-zinc-300 dark:bg-zinc-600 rounded-sm flex flex-col items-center justify-center gap-2`}>
        <div className="w-full h-1 bg-zinc-400 dark:bg-zinc-500 rounded" />
        {hasEixo2 && <div className="w-full h-1 bg-zinc-400 dark:bg-zinc-500 rounded" />}
      </div>
      {/* Rear bumper */}
      <div className="w-20 h-3 bg-zinc-200 dark:bg-zinc-700 rounded-sm" />
      {/* Spare label */}
      <div className="text-[8px] font-black text-zinc-400 uppercase tracking-widest mt-1">EST</div>
    </div>
  );
}

// ── Main Modal ───────────────────────────────────────────────────────────────
interface Props {
  inspecao: Inspecao | null;
  onClose: () => void;
}

export default function PneuEsquemaModal({ inspecao, onClose }: Props) {
  if (!inspecao) return null;

  const ins = inspecao;
  const placa = ins.equipamentos?.placa ?? "—";
  const modulo = ins.equipamentos?.modulo ?? "";
  const categoria = ins.equipamentos?.categoria ?? "PESADA";
  const isLeve = categoria.toUpperCase() === "LEVE";

  // Calcula a condição ao vivo a partir do Sulco 2 (meio) de cada posição, em vez de
  // confiar no campo salvo — assim bate com as cores das caixinhas do esquema mesmo em
  // boletins lançados antes de alguma mudança de regra. "PENDENTE" é um marcador sintético
  // (veículo nunca inspecionado, ver PneusClient), não uma condição de sulco de verdade.
  const isPendente = ins.condicao === "PENDENTE";
  const condicaoAtual = isPendente ? null : calcCondicaoPneu(ins);

  const hasEixo2 = !isLeve && (
    ins.tei1 != null || ins.tee1 != null || ins.tdi1 != null || ins.tde1 != null
  );

  const allValues = [ins.de, ins.dd, ins.tei, ins.tee, ins.tdi, ins.tde,
    ins.tei1, ins.tee1, ins.tdi1, ins.tde1, ins.estepe].filter(v => v != null) as number[];
  const avgSulco = allValues.length
    ? Math.round((allValues.reduce((a,b) => a+b, 0) / allValues.length) * 10) / 10
    : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-2xl">
              <span className="text-2xl">🚛</span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-zinc-900 dark:text-zinc-50 tracking-tight">{placa}</h2>
                <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                  isPendente
                    ? "text-zinc-500 bg-zinc-50 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                    : condColor(condicaoAtual!)
                }`}>
                  {isPendente ? "PENDENTE" : CONDICAO_LABEL[condicaoAtual!]}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
                {modulo && <span>📍 {modulo}</span>}
                <span className="flex items-center gap-1"><Calendar size={11} /> {fmtDate(ins.data_inspecao)}</span>
                {ins.km_atual && <span className="flex items-center gap-1"><Gauge size={11} /> {ins.km_atual.toLocaleString()} km</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="px-6 py-3 bg-zinc-50/80 dark:bg-zinc-900/60 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-6 text-xs font-bold shrink-0">
          {avgSulco != null && (
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${avgSulco >= 10 ? "bg-emerald-500" : avgSulco >= 6 ? "bg-yellow-400" : avgSulco >= 3 ? "bg-orange-400" : "bg-red-500"}`} />
              <span className="text-zinc-500">Média Sulco:</span>
              <span className="text-zinc-900 dark:text-zinc-50">{avgSulco} mm</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Posições:</span>
            <span className="text-zinc-900 dark:text-zinc-50">{allValues.length} preenchidas</span>
          </div>
          <div className="flex gap-3 ml-auto text-[9px] font-black text-zinc-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" /> &gt;6mm Bom</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-yellow-400 inline-block" /> 5-6mm Recap.</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-500 inline-block" /> ≤4mm Crít.</span>
          </div>
        </div>

        {/* Schematic */}
        <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col items-center gap-6">

            {/* ── FRENTE label */}
            <div className="flex items-center gap-3 w-full justify-center">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-3">▲ FRENTE</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* ── Eixo Frontal */}
            <div className="flex flex-col items-center gap-1 w-full">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Eixo Frontal</span>
              <div className="flex items-end justify-center gap-0">
                {/* Left side */}
                <div className="flex items-center">
                  <Tire label="DE" value={ins.de} />
                  <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                </div>
                {/* Truck front */}
                <div className="flex flex-col items-center w-32 relative">
                  <div className="w-full h-8 bg-gradient-to-b from-zinc-200 to-zinc-300 dark:from-zinc-700 dark:to-zinc-600 rounded-t-3xl rounded-b-sm flex items-center justify-center shadow-inner">
                    <div className="w-16 h-4 bg-zinc-100 dark:bg-zinc-500 rounded-sm opacity-70" />
                  </div>
                  <div className="w-10 h-16 bg-zinc-200 dark:bg-zinc-700 rounded-sm mt-0" />
                </div>
                {/* Right side */}
                <div className="flex items-center">
                  <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                  <Tire label="DD" value={ins.dd} />
                </div>
              </div>
            </div>

            {/* ── Eixo 1 */}
            <div className="flex flex-col items-center gap-1 w-full">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Eixo 1</span>
              <div className="flex items-center justify-center">
                {/* Left dual tires */}
                <div className="flex items-center gap-0.5">
                  <Tire label="TEE" value={ins.tee} />
                  <Tire label="TEI" value={ins.tei} />
                  <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                </div>
                {/* Chassis bar */}
                <div className="w-32 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-sm flex items-center justify-center">
                  <div className="w-4 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 border-2 border-zinc-200 dark:border-zinc-700 shadow" />
                </div>
                {/* Right dual tires */}
                <div className="flex items-center gap-0.5">
                  <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                  <Tire label="TDI" value={ins.tdi} />
                  <Tire label="TDE" value={ins.tde} />
                </div>
              </div>
            </div>

            {/* ── Eixo 2 (only for heavy trucks with data) */}
            {!isLeve && (
              <div className="flex flex-col items-center gap-1 w-full">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Eixo 2</span>
                <div className="flex items-center justify-center">
                  {/* Left dual tires */}
                  <div className="flex items-center gap-0.5">
                    <Tire label="TEE1" value={ins.tee1} />
                    <Tire label="TEI1" value={ins.tei1} />
                    <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                  </div>
                  {/* Chassis bar */}
                  <div className="w-32 h-3 bg-zinc-300 dark:bg-zinc-600 rounded-sm flex items-center justify-center">
                    <div className="w-4 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 border-2 border-zinc-200 dark:border-zinc-700 shadow" />
                  </div>
                  {/* Right dual tires */}
                  <div className="flex items-center gap-0.5">
                    <div className="w-6 h-1 bg-zinc-300 dark:bg-zinc-700 rounded mx-1" />
                    <Tire label="TDI1" value={ins.tdi1} />
                    <Tire label="TDE1" value={ins.tde1} />
                  </div>
                </div>
              </div>
            )}

            {/* ── TRASEIRA label */}
            <div className="flex items-center gap-3 w-full justify-center">
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-3">▼ TRASEIRA</span>
              <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            </div>

            {/* ── Estepe */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Estepe</span>
              <div className={`
                w-14 h-14 rounded-full border-4 flex flex-col items-center justify-center transition-all
                ${ins.estepe != null
                  ? `${sulcoBg(ins.estepe)} border-transparent ${sulcoGlow(ins.estepe)}`
                  : "bg-zinc-50 dark:bg-zinc-900 border-dashed border-zinc-300 dark:border-zinc-700"}
              `}>
                <span className="font-black text-lg leading-none">{ins.estepe ?? "—"}</span>
                {ins.estepe != null && <span className="text-[8px] font-bold opacity-70">mm</span>}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-3 flex-wrap shrink-0">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2 flex-wrap">
            <Clock size={11} />
            Inspeção: {fmtDate(ins.data_inspecao)}
            <span className="normal-case font-semibold text-zinc-400">
              · Registrado por {ins.registrado_por_nome || "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => gerarFichaPneusPDF(ins)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <FileDown size={14} /> Baixar PDF
            </button>
            <button
              onClick={() => gerarFichaPneusPDF(ins, "share")}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Share2 size={14} /> Compartilhar
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
