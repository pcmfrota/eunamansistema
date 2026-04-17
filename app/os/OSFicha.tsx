"use client";

import React, { useEffect } from "react";
import { X, Printer } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
export type OSFichaData = {
  id: string;
  numero_os: string;
  placa: string | null;
  modulo: string | null;
  status: string | null;
  data_abertura: string;
  data_fechamento: string | null;
  horas_manutencao: number | null;
  descricao: string | null;
  horimetro: number | null;
  operacao_tipo: string | null;
  local: string | null;
  classe: string | null;
  foi_enviado_reserva: boolean | null;
  qual_reserva?: string | null;
  horas_reserva_chegou?: string | null;
  horario_parada?: string | null;
  motivo: string | null;
  sistema: string | null;
  sub_sistema: string | null;
  componente: string | null;
  observacoes: string | null;
  equipamento_id: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtDT(s: string | null | undefined) {
  if (!s) return "—";
  const clean = s.slice(0, 16);
  if (!clean.includes("T")) return s;
  const [datePart, timePart] = clean.split("T");
  const [y, m, d] = datePart.split("-");
  return `${d}/${m}/${y} ${timePart}`;
}

function calcHoras(abertura: string, fechamento: string | null): string {
  if (!fechamento) return "—";
  const diff = Math.floor(
    (new Date(fechamento).getTime() - new Date(abertura).getTime()) / 60000
  );
  if (diff <= 0) return "—";
  const h = Math.floor(diff / 60);
  const min = diff % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// ─── OSFichaModal  ────────────────────────────────────────────────────────────
interface OSFichaModalProps {
  os: OSFichaData;
  onClose: () => void;
}

export default function OSFichaModal({ os, onClose }: OSFichaModalProps) {
  // Fecha com ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const horasCalc =
    os.horas_manutencao != null
      ? `${os.horas_manutencao}h`
      : calcHoras(os.data_abertura, os.data_fechamento);

  const handlePrint = () => {
    const printContent = document.getElementById("ficha-os-print");
    if (!printContent) return;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>O.S Nº ${os.numero_os}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; background: #fff; color: #000; padding: 16px; }
          .ficha { border: 2px solid #000; max-width: 820px; margin: 0 auto; }
          .header-top { display: flex; align-items: center; border-bottom: 2px solid #000; padding: 8px 12px; gap: 12px; }
          .logo-box { width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; }
          .logo-box svg { width: 56px; height: 56px; }
          .header-title { flex: 1; text-align: center; }
          .header-title h1 { font-size: 16px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
          .header-title p { font-size: 10px; color: #555; margin-top: 2px; }
          .os-num { min-width: 100px; text-align: right; font-weight: bold; font-size: 13px; }
          .section { border-bottom: 1px solid #000; }
          .section-title { background: #1a5c1a; color: #fff; font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; padding: 3px 8px; }
          .fields-grid { display: grid; padding: 6px 8px; gap: 4px 0; }
          .field-row { display: flex; gap: 8px; margin-bottom: 3px; }
          .field { display: flex; flex-direction: column; gap: 1px; flex: 1; }
          .field label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
          .field span { font-size: 11px; font-weight: 700; border-bottom: 1px dotted #999; padding-bottom: 1px; min-height: 16px; }
          .desc-box { padding: 6px 8px; }
          .desc-box label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
          .desc-box p { font-size: 11px; font-weight: 600; min-height: 40px; margin-top: 3px; border: 1px dotted #ccc; padding: 4px; border-radius: 2px; }
          .obs-box { padding: 6px 8px; }
          .obs-box label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
          .obs-box p { font-size: 11px; min-height: 30px; margin-top: 3px; border: 1px dotted #ccc; padding: 4px; border-radius: 2px; }
          .assinaturas { display: flex; }
          .assin-box { flex: 1; border-right: 1px solid #000; padding: 10px 8px; }
          .assin-box:last-child { border-right: none; }
          .assin-box label { font-size: 9px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 20px; }
          .assin-line { border-bottom: 1px solid #000; margin-top: 8px; }
          .assin-sub { font-size: 9px; text-align: center; color: #666; margin-top: 3px; }
          .status-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-weight: 800; font-size: 11px; }
          .status-fechada { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
          .status-aberta { background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd; }
          .status-andamento { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
          .tag { display: inline-block; background: #f0fdf4; border: 1px solid #86efac; color: #166534; padding: 1px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 2px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 400);
  };

  const statusClass =
    os.status === "Fechada" || os.status === "Concluída"
      ? "status-fechada"
      : os.status === "Em Andamento"
      ? "status-andamento"
      : "status-aberta";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      {/* Backdrop close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Container */}
      <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-[#1a5c1a] shrink-0">
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 80 80" className="w-10 h-10" fill="none">
              <circle cx="40" cy="40" r="38" fill="#fff" />
              <text x="40" y="50" textAnchor="middle" fontSize="32" fontWeight="900" fill="#1a5c1a">E</text>
            </svg>
            <div>
              <h1 className="text-white font-black text-base tracking-widest uppercase">
                Ficha de O.S
              </h1>
              <p className="text-green-200 text-[11px]">Eunaman — Controle de Manutenção</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#1a5c1a] font-bold rounded-xl text-sm hover:bg-green-50 transition-all shadow-sm"
            >
              <Printer size={16} />
              Imprimir O.S
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-green-800 text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable ficha */}
        <div className="overflow-y-auto flex-1 bg-gray-50 p-4">
          {/* ── CONTEÚDO IMPRIMÍVEL ── */}
          <div id="ficha-os-print">
            <div className="ficha border-2 border-gray-900 bg-white max-w-full text-black">

              {/* Cabeçalho */}
              <div className="header-top flex items-center border-b-2 border-gray-900 p-2 gap-3">
                {/* Logo SVG inline */}
                <div className="logo-box w-14 h-14 flex items-center justify-center shrink-0">
                  <svg viewBox="0 0 80 80" className="w-14 h-14" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="40" cy="40" r="38" fill="#1a5c1a"/>
                    <path d="M40 8 L45 16 L55 12 L52 22 L62 24 L56 32 L62 40 L54 42 L56 52 L46 50 L44 60 L40 52 L36 60 L34 50 L24 52 L26 42 L18 40 L24 32 L18 24 L28 22 L25 12 L35 16 Z" fill="none" stroke="#fff" strokeWidth="2"/>
                    <circle cx="40" cy="40" r="12" fill="#fff"/>
                    <text x="40" y="45" textAnchor="middle" fontSize="16" fontWeight="900" fill="#1a5c1a" fontFamily="Arial">E</text>
                  </svg>
                </div>
                <div className="flex-1 text-center">
                  <h1 className="text-[15px] font-black tracking-widest uppercase text-gray-900">
                    ORDEM DE MANUTENÇÃO
                  </h1>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    EUNAMAN — CONTROLE DE MANUTENÇÃO DE FROTAS
                  </p>
                </div>
                <div className="min-w-[90px] text-right">
                  <p className="text-[9px] text-gray-500 uppercase font-semibold">Nº O.S</p>
                  <p className="text-[13px] font-black text-gray-900 font-mono">
                    {os.numero_os}
                  </p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                    os.status === "Fechada" || os.status === "Concluída"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : os.status === "Em Andamento"
                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}>
                    {os.status || "Aberta"}
                  </span>
                </div>
              </div>

              {/* Bloco 1 — Identificação do Equipamento */}
              <div className="border-b border-gray-900">
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Identificação do Equipamento
                </div>
                <div className="grid grid-cols-4 gap-0 px-3 py-2">
                  <FieldPrint label="Placa" value={os.placa || "—"} bold />
                  <FieldPrint label="Módulo / Operação" value={os.modulo
                    ? `${os.modulo}${os.operacao_tipo ? ` — ${os.operacao_tipo}` : ""}`
                    : os.operacao_tipo || "—"
                  } />
                  <FieldPrint label="Local" value={os.local || "—"} />
                  <FieldPrint label="Horímetro" value={os.horimetro != null ? String(os.horimetro) : "—"} />
                </div>
              </div>

              {/* Bloco 2 — Datas e Tempos */}
              <div className="border-b border-gray-900">
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Datas e Tempos
                </div>
                <div className="grid grid-cols-4 gap-0 px-3 py-2">
                  {os.horario_parada && (
                    <FieldPrint label="Horário Real da Parada" value={fmtDT(os.horario_parada)} />
                  )}
                  <FieldPrint label="Início Manutenção" value={fmtDT(os.data_abertura)} />
                  <FieldPrint label="Fechamento da O.S" value={fmtDT(os.data_fechamento)} highlight={!!os.data_fechamento} />
                  <FieldPrint label="Tempo Total" value={horasCalc} bold highlight />
                </div>
              </div>

              {/* Bloco 3 — Classificação */}
              <div className="border-b border-gray-900">
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Classificação da Manutenção
                </div>
                <div className="grid grid-cols-4 gap-0 px-3 py-2">
                  <FieldPrint label="Tipo" value={os.classe || "CORRETIVA"} bold />
                  <FieldPrint label="Sistema" value={os.sistema || "—"} />
                  <FieldPrint label="Sub-Sistema" value={os.sub_sistema || "—"} />
                  <FieldPrint label="Componente" value={os.componente || "—"} />
                </div>
                <div className="grid grid-cols-2 gap-0 px-3 pb-2">
                  <FieldPrint label="Motivo da Parada" value={os.motivo || "—"} />
                  <div className="px-2 flex flex-col gap-1">
                    <label className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                      Reserva Enviada?
                    </label>
                    <span className={`text-[11px] font-black ${os.foi_enviado_reserva ? "text-orange-700" : "text-gray-500"}`}>
                      {os.foi_enviado_reserva ? "✅ SIM" : "NÃO"}
                    </span>
                    {os.foi_enviado_reserva && os.qual_reserva && (
                      <span className="text-[10px] text-orange-600 font-semibold">
                        Reserva: {os.qual_reserva}
                        {os.horas_reserva_chegou ? ` — Chegou: ${fmtDT(os.horas_reserva_chegou)}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Bloco 4 — Descrição */}
              <div className="border-b border-gray-900">
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Descrição da Atividade
                </div>
                <div className="px-3 py-2 min-h-[56px]">
                  <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-wrap">
                    {os.descricao || "—"}
                  </p>
                </div>
              </div>

              {/* Bloco 5 — Observações */}
              <div className="border-b border-gray-900">
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Observações / Pendências
                </div>
                <div className="px-3 py-2 min-h-[40px]">
                  <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {os.observacoes || "—"}
                  </p>
                </div>
              </div>

              {/* Bloco 6 — Assinaturas */}
              <div>
                <div className="section-title bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  Controle e Assinaturas
                </div>
                <div className="flex divide-x divide-gray-900">
                  {[
                    { label: "Executante / Mecânico", sub: "Nome e Matrícula" },
                    { label: "Encarregado / Supervisor", sub: "Visto e Matrícula" },
                    { label: "PCM / Planejamento", sub: "Data de Encerramento" },
                    { label: "Operador / Motorista", sub: "Recebimento" },
                  ].map((a) => (
                    <div key={a.label} className="flex-1 px-3 py-3">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-6">{a.label}</p>
                      <div className="border-b border-gray-800 mt-2" />
                      <p className="text-[9px] text-center text-gray-400 mt-1">{a.sub}</p>
                    </div>
                  ))}
                </div>

                {/* Rodapé */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-300">
                  <p className="text-[9px] text-gray-400">
                    Gerado em: {new Date().toLocaleString("pt-BR")}
                  </p>
                  <p className="text-[9px] text-gray-500 font-semibold">
                    EUNAMAN — Sistema de Controle de Manutenção
                  </p>
                  <p className="text-[9px] text-gray-400 font-mono">
                    O.S: {os.numero_os}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .ficha { border: 2px solid #000 !important; }
          .section-title { background: #1a5c1a !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-componente: campo da ficha ─────────────────────────────────────────
function FieldPrint({
  label,
  value,
  bold = false,
  highlight = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="px-2 mb-2 flex flex-col gap-0.5">
      <label className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
        {label}
      </label>
      <span
        className={`text-[12px] border-b border-dotted border-gray-400 pb-0.5 ${
          bold ? "font-black" : "font-semibold"
        } ${highlight ? "text-[#1a5c1a]" : "text-gray-800"}`}
      >
        {value}
      </span>
    </div>
  );
}
