"use client";

import React from "react";
import { createPortal } from "react-dom";
import { X, Printer, Share2, Send, Mail, CheckCircle2, Clock } from "lucide-react";

export type FichaMaoObraItem = {
  id: string;
  numero_ficha: string;
  mecanico_nome: string;
  mecanico_matricula?: string;
  equipe?: string;
  supervisor?: string;
  modulo?: string;
  frente_trabalho?: string;
  equipamento_id?: string;
  placa: string;
  equipamento?: string;
  modelo?: string;
  cliente?: string;
  horimetro?: number;
  km?: number;
  tipo_manutencao: string;
  descricao_servico: string;
  atividades?: { id: string; descricao: string; checked: boolean; hora_inicio?: string; hora_fim?: string; tempo_gasto?: string }[];
  tempo_total_horas?: number;
  pecas?: { codigo: string; descricao: string; quantidade: number }[];
  fotos_antes?: string[];
  fotos_depois?: string[];
  observacoes?: string;
  assinatura_mecanico?: string;
  assinatura_supervisor?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  created_at: string;
  updated_at?: string;
};

interface FichaPDFModalProps {
  ficha: FichaMaoObraItem | null;
  onClose: () => void;
}

export default function FichaPDFModal({ ficha, onClose }: FichaPDFModalProps) {
  if (!ficha) return null;

  const dataFicha = new Date(ficha.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  const horaFicha = new Date(ficha.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
    `EUNAMAN FICHA:${ficha.numero_ficha} | PLACA:${ficha.placa} | MEC:${ficha.mecanico_nome}`
  )}`;

  const handlePrint = () => {
    window.print();
  };

  const shareText = `FICHA DIÁRIA DE MÃO DE OBRA - EUNAMAN\n\nFicha: ${ficha.numero_ficha}\nMecânico: ${ficha.mecanico_nome}\nPlaca: ${ficha.placa}\nTipo: ${ficha.tipo_manutencao}\nTempo Total: ${ficha.tempo_total_horas || 0}h\nStatus: ${ficha.status}`;

  const handleWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  const handleEmail = () => {
    const subject = `Ficha de Mão de Obra - ${ficha.numero_ficha} (${ficha.placa})`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ficha ${ficha.numero_ficha}`,
          text: shareText,
        });
      } catch (err) {
        console.log("Compartilhamento cancelado:", err);
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
                  Ficha Diária de Mão de Obra
                </p>
              </div>
            </div>

            <div className="text-right flex flex-col items-end gap-1">
              <span className="text-base font-black text-emerald-700">{ficha.numero_ficha}</span>
              <span className="text-[10px] text-slate-500 font-semibold">
                Data: {dataFicha} às {horaFicha}
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded font-black uppercase bg-slate-100 text-slate-700 border border-slate-300">
                Status: {ficha.status}
              </span>
            </div>
          </div>

          {/* Dados do Mecânico & Dados do Veículo (2 Colunas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Bloco Mecânico */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
                👨‍🔧 Dados do Mecânico
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
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

            {/* Bloco Veículo */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
                🚛 Dados do Veículo / Equipamento
              </h3>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">Placa</span>
                  <span className="font-black text-emerald-700 text-sm">{ficha.placa}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">Equipamento</span>
                  <span className="font-bold text-slate-800">{ficha.equipamento || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">Modelo</span>
                  <span className="font-bold text-slate-800">{ficha.modelo || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">Cliente</span>
                  <span className="font-bold text-slate-800">{ficha.cliente || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">Horímetro</span>
                  <span className="font-bold text-slate-800">{ficha.horimetro ? `${ficha.horimetro} h` : "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[9px] font-bold uppercase">KM</span>
                  <span className="font-bold text-slate-800">{ficha.km ? `${ficha.km} km` : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tipo de Manutenção e Serviço Executado */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-800">
                Tipo de Manutenção
              </span>
              <span className="px-3 py-1 bg-emerald-700 text-white font-extrabold text-xs rounded-lg uppercase">
                {ficha.tipo_manutencao}
              </span>
            </div>
            <div className="pt-2 border-t border-emerald-200/60">
              <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">
                Descrição do Serviço Executado
              </span>
              <p className="text-slate-800 font-semibold whitespace-pre-wrap leading-relaxed text-[11px]">
                {ficha.descricao_servico}
              </p>
            </div>
          </div>

          {/* Atividades Executadas */}
          {ficha.atividades && ficha.atividades.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1 flex items-center justify-between">
                <span>📋 Atividades Executadas</span>
                <span className="text-emerald-700 font-black">
                  Tempo Total: {ficha.tempo_total_horas || 0}h
                </span>
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Atividade</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-center">Início</th>
                      <th className="p-2 text-center">Término</th>
                      <th className="p-2 text-right">Tempo Gasto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ficha.atividades.map((atv, idx) => (
                      <tr key={idx} className={atv.checked ? "bg-emerald-50/30" : ""}>
                        <td className="p-2 font-semibold text-slate-800">{atv.descricao}</td>
                        <td className="p-2 text-center font-bold">
                          {atv.checked ? (
                            <span className="text-emerald-600 inline-flex items-center gap-1">
                              <CheckCircle2 size={12} /> Concluída
                            </span>
                          ) : (
                            <span className="text-slate-400">Pendente</span>
                          )}
                        </td>
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

          {/* Peças Utilizadas */}
          {ficha.pecas && ficha.pecas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
                🔩 Peças Utilizadas
              </h3>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-[10px]">
                  <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="p-2">Código</th>
                      <th className="p-2">Descrição da Peça</th>
                      <th className="p-2 text-right">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {ficha.pecas.map((peca, idx) => (
                      <tr key={idx}>
                        <td className="p-2 font-mono font-bold text-slate-700">{peca.codigo || "—"}</td>
                        <td className="p-2 font-semibold text-slate-800">{peca.descricao}</td>
                        <td className="p-2 text-right font-black text-emerald-700">{peca.quantidade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Evidências Fotográficas */}
          {((ficha.fotos_antes && ficha.fotos_antes.length > 0) || (ficha.fotos_depois && ficha.fotos_depois.length > 0)) && (
            <div className="space-y-3 pt-2">
              <h3 className="text-[11px] font-extrabold text-slate-800 uppercase border-b border-slate-200 pb-1">
                📷 Evidências Fotográficas (Estampadas com Marca D'água)
              </h3>

              {ficha.fotos_antes && ficha.fotos_antes.length > 0 && (
                <div>
                  <span className="text-[10px] font-black uppercase text-amber-700 block mb-1.5">
                    Fotos ANTES da Manutenção ({ficha.fotos_antes.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ficha.fotos_antes.map((src, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Antes ${i+1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ficha.fotos_depois && ficha.fotos_depois.length > 0 && (
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-700 block mb-1.5">
                    Fotos DEPOIS da Manutenção ({ficha.fotos_depois.length})
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {ficha.fotos_depois.map((src, i) => (
                      <div key={i} className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Depois ${i+1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Observações */}
          {ficha.observacoes && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[9px] font-bold uppercase text-slate-500 block mb-1">
                Observações Adicionais
              </span>
              <p className="text-slate-800 font-medium text-[10px] whitespace-pre-wrap">
                {ficha.observacoes}
              </p>
            </div>
          )}

          {/* Assinaturas Digitais & QR Code (Rodapé da Ficha) */}
          <div className="pt-4 border-t-2 border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            {/* Assinatura Mecânico */}
            <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl bg-slate-50/50">
              {ficha.assinatura_mecanico ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={ficha.assinatura_mecanico} alt="Assinatura Mecânico" className="h-14 object-contain mb-1" />
              ) : (
                <div className="h-14 flex items-center justify-center text-slate-300 text-[10px]">Sem Assinatura</div>
              )}
              <div className="w-full border-t border-slate-400 pt-1 text-center">
                <span className="text-[10px] font-black text-slate-800 block">{ficha.mecanico_nome}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">Assinatura do Mecânico</span>
              </div>
            </div>

            {/* Assinatura Supervisor */}
            <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-xl bg-slate-50/50">
              {ficha.assinatura_supervisor ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={ficha.assinatura_supervisor} alt="Assinatura Supervisor" className="h-14 object-contain mb-1" />
              ) : (
                <div className="h-14 flex items-center justify-center text-slate-300 text-[10px]">Não assinado pelo supervisor</div>
              )}
              <div className="w-full border-t border-slate-400 pt-1 text-center">
                <span className="text-[10px] font-black text-slate-800 block">{ficha.supervisor || "Supervisor"}</span>
                <span className="text-[8px] font-bold text-slate-400 uppercase block">Assinatura do Supervisor</span>
              </div>
            </div>

            {/* QR Code Audit & Rodapé Info */}
            <div className="flex items-center justify-end gap-3 p-2 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-800 block">Validação Digital</span>
                <span className="text-[8px] text-slate-500 block font-mono">ID: {ficha.id.slice(0, 8)}</span>
                <span className="text-[8px] text-emerald-600 font-bold block">Sistema EUNAMAN</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR Code" className="w-14 h-14 rounded border border-slate-300" />
            </div>
          </div>

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
