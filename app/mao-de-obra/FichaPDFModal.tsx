"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X, Printer, Share2, Send, Mail, Clock } from "lucide-react";
import { isAtividadeProdutiva } from "./tiposAtividade";

export type AtividadeJornada = {
  id: string;
  tipo_atividade: string;
  placa?: string;
  descricao: string;
  hora_inicio?: string;
  hora_fim?: string;
  tempo_gasto?: string;
};

export type FichaMaoObraItem = {
  id: string;
  numero_ficha: string;
  mecanico_nome: string;
  mecanico_matricula?: string;
  equipe?: string;
  supervisor?: string;
  modulo?: string;
  frente_trabalho?: string;
  data_jornada?: string;
  hora_inicio_jornada?: string;
  hora_fim_jornada?: string;
  atividades?: AtividadeJornada[];
  tempo_total_horas?: number;
  tempo_produtivo_horas?: number;
  tempo_ocioso_horas?: number;
  observacoes?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  // Campos legados (fichas antigas anteriores ao apontamento de jornada) — mantidos só para leitura.
  placa?: string;
  tipo_manutencao?: string;
  descricao_servico?: string;
};

interface FichaPDFModalProps {
  ficha: FichaMaoObraItem | null;
  onClose: () => void;
}

function formatHoras(h?: number): string {
  return `${(h || 0).toFixed(2)}h`;
}

export default function FichaPDFModal({ ficha, onClose }: FichaPDFModalProps) {
  if (!ficha) return null;

  const dataJornada = ficha.data_jornada || ficha.created_at?.split("T")[0];
  const dataFormatada = dataJornada
    ? new Date(dataJornada + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "—";

  const atividades = ficha.atividades || [];

  // Duração da jornada (início/fim do dia) menos a soma das atividades apontadas — tempo sem nenhum registro.
  const tempoNaoApontado = React.useMemo(() => {
    if (!ficha.hora_inicio_jornada || !ficha.hora_fim_jornada) return 0;
    const [h1, m1] = ficha.hora_inicio_jornada.split(":").map(Number);
    const [h2, m2] = ficha.hora_fim_jornada.split(":").map(Number);
    if ([h1, m1, h2, m2].some(v => isNaN(v))) return 0;
    let totalMin = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (totalMin < 0) totalMin += 24 * 60;
    const duracaoJornada = totalMin / 60;
    const apontado = ficha.tempo_total_horas || 0;
    return Math.max(0, Number((duracaoJornada - apontado).toFixed(2)));
  }, [ficha]);

  const handlePrint = () => {
    window.print();
  };

  const shareText = `📋 *APONTAMENTO DIÁRIO DE MÃO DE OBRA - EUNAMAN*

*Ficha:* ${ficha.numero_ficha}
*Data:* ${dataFormatada}
*Colaborador:* ${ficha.mecanico_nome} ${ficha.mecanico_matricula ? `(${ficha.mecanico_matricula})` : ""}
*Módulo / Frente:* ${ficha.modulo || "-"} / ${ficha.frente_trabalho || "-"}
*Horas Apontadas:* ${formatHoras(ficha.tempo_total_horas)}
*Produtivo:* ${formatHoras(ficha.tempo_produtivo_horas)} · *Ocioso:* ${formatHoras(ficha.tempo_ocioso_horas)}
*Status:* ${ficha.status}`;

  const handleWhatsApp = () => {
    const encodedText = encodeURIComponent(shareText);
    const waUrl = `https://wa.me/?text=${encodedText}`;

    try {
      const win = window.open(waUrl, "_blank", "noopener,noreferrer");
      if (!win || win.closed || typeof win.closed === "undefined") {
        window.location.href = waUrl;
      }
    } catch (_) {
      window.location.href = waUrl;
    }
  };

  const handleEmail = () => {
    const subject = `Apontamento de Mão de Obra - ${ficha.numero_ficha} (${ficha.mecanico_nome})`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
    window.location.href = url;
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Ficha ${ficha.numero_ficha}`,
          text: shareText,
        });
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          handleWhatsApp();
        }
      }
    } else {
      handleWhatsApp();
    }
  };

  return createPortal(
    <>
      {/* Visualização de Impressão Nativa (CSS @media print) */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area, #print-area * {
            visibility: visible !important;
          }
          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: white !important;
            color: black !important;
            padding: 10mm !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-start p-2 sm:p-6 overflow-y-auto no-print">
        {/* Barra Superior de Ações */}
        <div className="sticky top-0 z-50 flex items-center justify-between w-full max-w-4xl bg-slate-900/90 text-white p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-2xl backdrop-blur-md mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm sm:text-base text-emerald-400">
              {ficha.numero_ficha}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {ficha.status}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow active:scale-95"
            >
              <Printer size={15} />
              <span>Imprimir / PDF</span>
            </button>
            <button
              onClick={handleWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-xl transition shadow active:scale-95"
            >
              <Send size={15} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow active:scale-95"
            >
              <Mail size={15} />
              <span>E-mail</span>
            </button>
            <button
              onClick={handleNativeShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition border border-slate-700 active:scale-95"
            >
              <Share2 size={15} />
              <span>Compartilhar</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Documento Impresso / Visualização da Ficha */}
        <div
          id="print-area"
          className="w-full max-w-4xl bg-white text-slate-900 rounded-2xl p-6 sm:p-10 shadow-2xl border border-slate-200 text-xs font-sans space-y-6"
        >
          {/* Cabeçalho Oficial */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center font-black text-white text-xl shadow">
                E
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900">EUNAMAN</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Apontamento Diário de Mão de Obra
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-base font-black text-emerald-700">{ficha.numero_ficha}</span>
              <span className="text-[10px] text-slate-500 font-semibold">
                Data: {dataFormatada}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
                Status: {ficha.status}
              </span>
            </div>
          </div>

          {/* Dados do Colaborador */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
              👨‍🔧 Dados do Colaborador
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Nome</span>
                <span className="font-black text-slate-800">{ficha.mecanico_nome}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Matrícula</span>
                <span className="font-bold text-slate-800">{ficha.mecanico_matricula || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Equipe</span>
                <span className="font-bold text-slate-800">{ficha.equipe || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Supervisor</span>
                <span className="font-bold text-slate-800">{ficha.supervisor || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Módulo</span>
                <span className="font-bold text-slate-800">{ficha.modulo || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-bold uppercase">Frente</span>
                <span className="font-bold text-slate-800">{ficha.frente_trabalho || "—"}</span>
              </div>
            </div>
          </div>

          {/* Resumo de Tempo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
              <span className="text-[9px] font-bold uppercase text-slate-400 block">Jornada</span>
              <span className="font-black text-slate-800 text-sm">
                {ficha.hora_inicio_jornada || "—"} - {ficha.hora_fim_jornada || "—"}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-[9px] font-bold uppercase text-emerald-700 block">Apontado</span>
              <span className="font-black text-emerald-800 text-sm">{formatHoras(ficha.tempo_total_horas)}</span>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-center">
              <span className="text-[9px] font-bold uppercase text-blue-700 block">Produtivo</span>
              <span className="font-black text-blue-800 text-sm">{formatHoras(ficha.tempo_produtivo_horas)}</span>
            </div>
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
              <span className="text-[9px] font-bold uppercase text-amber-700 block">Ocioso</span>
              <span className="font-black text-amber-800 text-sm">{formatHoras(ficha.tempo_ocioso_horas)}</span>
            </div>
          </div>
          {tempoNaoApontado > 0 && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[10px] font-bold text-red-700 flex items-center gap-2">
              <Clock size={13} />
              {formatHoras(tempoNaoApontado)} da jornada sem nenhuma atividade apontada.
            </div>
          )}

          {/* Atividades Executadas */}
          {atividades.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
                📋 Atividades do Dia
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Categoria</th>
                      <th className="p-2">Placa</th>
                      <th className="p-2">Descrição</th>
                      <th className="p-2 text-center">Início</th>
                      <th className="p-2 text-center">Término</th>
                      <th className="p-2 text-right">Duração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atividades.map((atv, idx) => (
                      <tr key={idx} className={isAtividadeProdutiva(atv.tipo_atividade) ? "" : "bg-amber-50/40"}>
                        <td className="p-2 font-semibold text-slate-800">{atv.tipo_atividade}</td>
                        <td className="p-2 font-mono font-bold text-slate-600">{atv.placa || "—"}</td>
                        <td className="p-2 text-slate-700">{atv.descricao || "—"}</td>
                        <td className="p-2 text-center font-medium text-slate-600">{atv.hora_inicio || "—"}</td>
                        <td className="p-2 text-center font-medium text-slate-600">{atv.hora_fim || "—"}</td>
                        <td className="p-2 text-right font-bold text-slate-800">{atv.tempo_gasto || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Observações */}
          {ficha.observacoes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">
                Observações Gerais
              </span>
              <p className="text-slate-800 font-medium text-[10px] whitespace-pre-wrap">
                {ficha.observacoes}
              </p>
            </div>
          )}

          {/* Rodapé Oficial do Documento */}
          <div className="text-center text-[8px] text-slate-400 border-t border-slate-100 pt-2 font-medium">
            Documento gerado automaticamente pelo Sistema EUNAMAN em {new Date().toLocaleString("pt-BR")} · Versão 1.0
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
