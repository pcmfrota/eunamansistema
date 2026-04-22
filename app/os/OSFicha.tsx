"use client";

import React, { useEffect, useState } from "react";
import { X, Printer, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

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
  horas_impacto_do?: number; // Novo campo
  // fallback fields from OrdemServicoResumo
  veiculo_placa?: string | null;
  equipamento?: { placa?: string | null } | null;
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

function formatMinutesToHms(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseLocal(dateStr: string | null): number {
  if (!dateStr) return 0;
  // Tenta formato ISO: YYYY-MM-DDTHH:mm:ss
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
      parseInt(match[4]),
      parseInt(match[5])
    ).getTime();
  }
  // Tenta formato PT-BR: DD/MM/YYYY HH:mm
  const matchBR = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})/);
  if (matchBR) {
    return new Date(
      parseInt(matchBR[3]),
      parseInt(matchBR[2]) - 1,
      parseInt(matchBR[1]),
      parseInt(matchBR[4]),
      parseInt(matchBR[5])
    ).getTime();
  }
  return new Date(dateStr).getTime();
}

function getPlaca(os: OSFichaData): string {
  const p = (
    os.placa ||
    os.veiculo_placa ||
    os.equipamento?.placa ||
    ""
  ).trim().toUpperCase();
  return p || "—";
}

// ─── Logo Eunaman SVG ─────────────────────────────────────────────────────────
function EunamanLogo({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Gear outer */}
      <path
        d="M60 8
          L66 18 L78 14 L78 26 L90 28 L86 40 L96 48 L88 56
          L92 68 L80 70 L78 82 L66 80 L60 90
          L54 80 L42 82 L40 70 L28 68 L32 56
          L24 48 L34 40 L30 28 L42 26 L42 14 L54 18 Z"
        fill="none"
        stroke="#1a5c1a"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {/* Inner circle */}
      <circle cx="60" cy="49" r="26" fill="#1a5c1a" />
      {/* E letter */}
      <text
        x="60"
        y="62"
        textAnchor="middle"
        fontSize="32"
        fontWeight="900"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        E
      </text>
      {/* EUNAMAN text */}
      <text
        x="60"
        y="102"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fill="#1a1a1a"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >
        EUNAMAN
      </text>
      {/* Forest Support Expert */}
      <text
        x="60"
        y="114"
        textAnchor="middle"
        fontSize="7"
        fontWeight="700"
        fill="#1a5c1a"
        fontFamily="Arial, sans-serif"
        letterSpacing="1"
      >
        FOREST SUPPORT EXPERT
      </text>
    </svg>
  );
}

// ─── OSFichaModal  ────────────────────────────────────────────────────────────
interface OSFichaModalProps {
  os: OSFichaData;
  onClose: () => void;
}

export default function OSFichaModal({ os, onClose }: OSFichaModalProps) {
  const [minutosDO, setMinutosDO] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Cálculo dinâmico de DO caso não venha pronto
  useEffect(() => {
    // Se já temos o valor calculado (vindo da action/dashboard), usamos ele
    if (os.horas_impacto_do !== undefined && os.horas_impacto_do !== null) {
      setMinutosDO(Math.round(os.horas_impacto_do * 60));
      return;
    }

    async function fetchAndCalc() {
      try {
        const placaRaw = getPlaca(os);
        if (placaRaw === "—") return;

        const supabase = createClient();
        // Fallback: Busca na tabela de equipamentos para pegar a escala correta (id_escala)
        const { data: equipInfo } = await supabase
          .from("equipamentos")
          .select(`
            id_escala,
            escalas_trabalho:id_escala (
              periodo_inicio,
              periodo_fim,
              carga_horaria
            )
          `)
          .eq("placa", placaRaw.toUpperCase())
          .single();

        const escala = equipInfo?.escalas_trabalho as any;

        const start = parseLocal(os.horario_parada || os.data_abertura);
        const endRaw = os.data_fechamento ? parseLocal(os.data_fechamento) : new Date().getTime();
        
        let endDO = endRaw;
        if (os.horas_reserva_chegou) {
          const resChegou = parseLocal(os.horas_reserva_chegou);
          if (resChegou > start && resChegou < endRaw) {
            endDO = resChegou;
          }
        }

        if (!escala || (!escala.periodo_inicio && !escala.periodo_fim)) {
          setMinutosDO(Math.floor((endDO - start) / 60000));
          return;
        }

        // Se tem escala com horários, calcula interseção
        let totalMin = 0;
        const dInicio = new Date(start);
        const dFim = new Date(endDO);
        
        const [hS, minS] = (escala.periodo_inicio || "00:00").split(":").map(Number);
        const [hE, minE] = (escala.periodo_fim || "23:59").split(":").map(Number);

        for (let day = new Date(dInicio.getFullYear(), dInicio.getMonth(), dInicio.getDate()); day <= dFim; day.setDate(day.getDate() + 1)) {
          const y = day.getFullYear();
          const m = day.getMonth();
          const d = day.getDate();

          let sS = new Date(y, m, d, hS, minS || 0).getTime();
          let sE = new Date(y, m, d, hE, minE || 0).getTime();
          if (sE <= sS) sE += 86400000;

          const interS = Math.max(start, sS);
          const interE = Math.min(endDO, sE);

          if (interS < interE) {
            totalMin += Math.floor((interE - interS) / 60000);
          }
        }
        setMinutosDO(totalMin);
      } catch (err) {
        console.error("Erro ao calcular DO na ficha:", err);
      }
    }

    fetchAndCalc();
  }, [os]);

  const inicioParaCalc = os.horario_parada || os.data_abertura;
  const horasCalc =
    os.horas_manutencao != null
      ? formatMinutesToHms(Math.round(os.horas_manutencao * 60))
      : calcHoras(inicioParaCalc, os.data_fechamento);

  const placa = getPlaca(os);

  const handlePrint = () => {
    const logoSVG = `<svg width="90" height="130" viewBox="0 0 200 290" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 10 l10 18 20-6v20l20 4-6 18 16 12-12 14 8 20-20 4-4 20-18-6-14 14-14-14-18 6-4-20-20-4 8-20-12-14 16-12-6-18 20-4V22l20 6Z" fill="#2d8a2d"/>
      <circle cx="100" cy="102" r="52" fill="#1a5c1a"/>
      <circle cx="100" cy="102" r="48" fill="none" stroke="#ffffff" stroke-width="2"/>
      <text x="100" y="125" text-anchor="middle" font-size="72" font-weight="900" fill="#ffffff" font-family="Arial Black,Arial,sans-serif">E</text>
      <text x="100" y="220" text-anchor="middle" font-size="30" font-weight="900" fill="#111111" font-family="Arial Black,Arial,sans-serif" letter-spacing="3">EUNAMAN</text>
      <text x="100" y="248" text-anchor="middle" font-size="13" font-weight="700" fill="#2d8a2d" font-family="Arial,sans-serif" letter-spacing="2">FOREST SUPPORT EXPERT</text>
    </svg>`;

    const statusColor = (os.status === "Fechada" || os.status === "Concluída")
      ? { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" }
      : os.status === "Em Andamento"
      ? { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" }
      : { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" };

    const rows = (label: string, value: string, bold = false, green = false) =>
      `<div style="padding:0 8px 8px 8px;display:flex;flex-direction:column;gap:2px;flex:1;">
        <label style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${label}</label>
        <span style="font-size:12px;font-weight:${bold ? '900' : '600'};color:${green ? '#1a5c1a' : '#111827'};border-bottom:1px dotted #9ca3af;padding-bottom:2px;">${value}</span>
      </div>`;

    const secTitle = (t: string) =>
      `<div style="background:#1a5c1a;color:#fff;font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;padding:4px 10px;">${t}</div>`;

    const win = window.open("", "_blank", "width=900,height=750");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
      <meta charset="UTF-8"/>
      <title>O.S ${os.numero_os}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;font-size:11px;background:#fff;color:#000;}
        @page{size:A4 portrait;margin:10mm;}
        @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact;}}
      </style>
    </head><body>
      <div style="border:2px solid #111;max-width:800px;margin:0 auto;">

        <!-- Cabeçalho -->
        <div style="display:flex;align-items:center;border-bottom:2px solid #111;padding:10px 14px;gap:14px;">
          <div style="width:72px;height:72px;flex-shrink:0;">${logoSVG}</div>
          <div style="flex:1;text-align:center;">
            <h1 style="font-size:17px;font-weight:900;letter-spacing:3px;text-transform:uppercase;">ORDEM DE MANUTENÇÃO</h1>
            <p style="font-size:10px;color:#6b7280;margin-top:3px;">EUNAMAN — CONTROLE DE MANUTENÇÃO DE FROTAS</p>
          </div>
          <div style="min-width:120px;text-align:right;">
            <p style="font-size:9px;color:#6b7280;text-transform:uppercase;font-weight:600;">Nº O.S</p>
            <p style="font-size:14px;font-weight:900;font-family:monospace;">${os.numero_os}</p>
            <span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:10px;font-weight:800;margin-top:4px;background:${statusColor.bg};color:${statusColor.text};border:1px solid ${statusColor.border};">${os.status || "Aberta"}</span>
          </div>
        </div>

        <!-- Identificação -->
        <div style="border-bottom:1px solid #111;">
          ${secTitle("Identificação do Equipamento")}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows("Placa", placa, true)}
            ${rows("Módulo / Operação", os.modulo ? `${os.modulo}${os.operacao_tipo ? ` — ${os.operacao_tipo}` : ''}` : os.operacao_tipo || "—")}
            ${rows("Local", os.local || "—")}
            ${rows("Horímetro", os.horimetro != null ? String(os.horimetro) : "—")}
          </div>
        </div>

        <!-- Datas -->
        <div style="border-bottom:1px solid #111;">
          ${secTitle("Datas e Tempos")}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${os.horario_parada ? rows("Horário Real da Parada", fmtDT(os.horario_parada)) : ""}
            ${rows("Início Manutenção", fmtDT(os.data_abertura))}
            ${rows("Fechamento da O.S", fmtDT(os.data_fechamento), false, true)}
            ${rows("Tempo Total", horasCalc, true, true)}
          </div>
        </div>

        <!-- Classificação -->
        <div style="border-bottom:1px solid #111;">
          ${secTitle("Classificação da Manutenção")}
          <div style="display:flex;padding:8px 2px 4px 2px;">
            ${rows("Tipo", os.classe || "CORRETIVA", true)}
            ${rows("Sistema", os.sistema || "—")}
            ${rows("Sub-Sistema", os.sub_sistema || "—")}
            ${rows("Componente", os.componente || "—")}
          </div>
          <div style="display:flex;padding:0 2px 8px 2px;">
            ${rows("Motivo da Parada", os.motivo || "—")}
            ${rows("Reserva Enviada?", os.foi_enviado_reserva ? "✅ SIM" : "NÃO", true, os.foi_enviado_reserva ? true : false)}
          </div>
        </div>

        <!-- Descrição -->
        <div style="border-bottom:1px solid #111;">
          ${secTitle("Descrição da Atividade")}
          <div style="padding:8px 10px;min-height:56px;">
            <p style="font-size:11px;font-weight:600;color:#b45309;line-height:1.6;">${os.descricao || "—"}</p>
          </div>
        </div>

        <!-- Observações -->
        <div style="border-bottom:1px solid #111;">
          ${secTitle("Observações / Pendências")}
          <div style="padding:8px 10px;min-height:40px;">
            <p style="font-size:11px;color:#374151;line-height:1.5;">${os.observacoes || "—"}</p>
          </div>
        </div>

        <!-- Assinaturas -->
        <div>
          ${secTitle("Controle e Assinaturas")}
          <div style="display:flex;border-bottom:1px solid #333;">
            ${[
              { l: "Executante / Mecânico", s: "Nome e Matrícula" },
              { l: "Encarregado / Supervisor", s: "Visto e Matrícula" },
              { l: "PCM / Planejamento", s: "Data de Encerramento" },
              { l: "Operador / Motorista", s: "Recebimento" },
            ].map((a, i) => `
              <div style="flex:1;padding:10px 8px;${i < 3 ? 'border-right:1px solid #333;' : ''}">
                <p style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:24px;">${a.l}</p>
                <div style="border-bottom:1px solid #111;"></div>
                <p style="font-size:9px;text-align:center;color:#9ca3af;margin-top:4px;">${a.s}</p>
              </div>`).join("")}
          </div>
          <div style="display:flex;justify-content:space-between;padding:5px 10px;background:#f9fafb;border-top:1px solid #d1d5db;">
            <p style="font-size:9px;color:#9ca3af;">Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
            <p style="font-size:9px;color:#6b7280;font-weight:700;">EUNAMAN — Sistema de Controle de Manutenção</p>
            <p style="font-size:9px;color:#9ca3af;font-family:monospace;">O.S: ${os.numero_os}</p>
          </div>
        </div>

      </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };


  return (
    <>

      <div id="ficha-print-root" className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        {/* Backdrop close */}
        <div className="absolute inset-0 no-print" onClick={onClose} />

        {/* Container */}
        <div className="relative z-10 w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

          {/* Toolbar — oculto no print */}
          <div className="no-print flex items-center justify-between px-5 py-3 bg-[#1a5c1a] shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white rounded-full p-1 flex items-center justify-center w-10 h-10 overflow-hidden">
                <EunamanLogo size={36} />
              </div>
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
            <div id="ficha-os-print">
              <div className="border-2 border-gray-900 bg-white text-black">

                {/* ── Cabeçalho ── */}
                <div className="flex items-center border-b-2 border-gray-900 p-3 gap-4">
                  <div className="shrink-0 flex items-center justify-center w-20 h-28">
                    <EunamanLogo size={80} />
                  </div>
                  <div className="flex-1 text-center">
                    <h1 className="text-[17px] font-black tracking-widest uppercase text-gray-900">
                      ORDEM DE MANUTENÇÃO
                    </h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                      EUNAMAN — CONTROLE DE MANUTENÇÃO DE FROTAS
                    </p>
                  </div>
                  <div className="min-w-[110px] text-right">
                    <p className="text-[9px] text-gray-500 uppercase font-semibold">Nº O.S</p>
                    <p className="text-[13px] font-black text-gray-900 font-mono">{os.numero_os}</p>
                    <span
                      className={`status-badge-print inline-block px-2 py-0.5 rounded-full text-[10px] font-bold mt-1 ${
                        os.status === "Fechada" || os.status === "Concluída"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                          : os.status === "Em Andamento"
                          ? "bg-amber-100 text-amber-800 border border-amber-300"
                          : "bg-blue-100 text-blue-800 border border-blue-300"
                      }`}
                    >
                      {os.status || "Aberta"}
                    </span>
                  </div>
                </div>

                {/* ── Bloco 1 — Identificação do Equipamento ── */}
                <div className="border-b border-gray-900">
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
                    Identificação do Equipamento
                  </div>
                  <div className="grid grid-cols-4 px-2 py-2">
                    <FP label="Placa" value={placa} bold />
                    <FP
                      label="Módulo / Operação"
                      value={
                        os.modulo
                          ? `${os.modulo}${os.operacao_tipo ? ` — ${os.operacao_tipo}` : ""}`
                          : os.operacao_tipo || "—"
                      }
                    />
                    <FP label="Local" value={os.local || "—"} />
                    <FP label="Horímetro" value={os.horimetro != null ? String(os.horimetro) : "—"} />
                  </div>
                </div>

                {/* ── Bloco 2 — Datas e Tempos ── */}
                <div className="border-b border-gray-900">
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
                    Datas e Tempos
                  </div>
                  <div className="grid grid-cols-4 px-2 py-2">
                    {os.horario_parada && (
                      <FP label="Horário Real da Parada" value={fmtDT(os.horario_parada)} />
                    )}
                    <FP label="Início Manutenção" value={fmtDT(os.data_abertura)} />
                    <FP label="Fechamento da O.S" value={fmtDT(os.data_fechamento)} highlight={!!os.data_fechamento} />
                    <FP label="Tempo Total" value={horasCalc} bold highlight />
                  </div>
                </div>

                {/* ── Bloco 3 — Classificação ── */}
                <div className="border-b border-gray-900">
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
                    Classificação da Manutenção
                  </div>
                  <div className="grid grid-cols-4 px-2 py-2">
                    <FP label="Tipo" value={os.classe || "CORRETIVA"} bold />
                    <FP label="Sistema" value={os.sistema || "—"} />
                    <FP label="Sub-Sistema" value={os.sub_sistema || "—"} />
                    <FP label="Componente" value={os.componente || "—"} />
                  </div>
                  <div className="grid grid-cols-2 px-2 pb-2">
                    <FP label="Motivo da Parada" value={os.motivo || "—"} />
                    <div className="px-2 flex flex-col gap-1">
                      <label className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">
                        Reserva Enviada?
                      </label>
                      <span className={`text-[12px] font-black border-b border-dotted border-gray-400 pb-0.5 ${os.foi_enviado_reserva ? "text-orange-700" : "text-gray-500"}`}>
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

                {/* ── Bloco 4 — Descrição ── */}
                <div className="border-b border-gray-900">
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
                    Descrição da Atividade
                  </div>
                  <div className="px-3 py-2 min-h-[56px]">
                    <p className="desc-text-print text-[11px] text-amber-700 font-semibold leading-relaxed whitespace-pre-wrap">
                      {os.descricao || "—"}
                    </p>
                  </div>
                </div>

                {/* ── Bloco 5 — Observações ── */}
                <div className="border-b border-gray-900">
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
                    Observações / Pendências
                  </div>
                  <div className="px-3 py-2 min-h-[40px]">
                    <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {os.observacoes || "—"}
                    </p>
                  </div>
                </div>

                {/* ── Bloco Novo — Memória de Cálculo PCM ── */}
                <div className="no-print border-b border-gray-900 bg-blue-50/50">
                  <div className="bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 flex items-center gap-2">
                    <Clock size={12} /> Cálculo de Disponibilidade PCM
                  </div>
                  <div className="px-3 py-3 grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
                    <div>
                      <p className="font-bold text-blue-800 mb-1 italic uppercase">Impacto desta O.S:</p>
                      <ul className="space-y-1 text-zinc-700">
                        <li><span className="font-bold">Horas de Indisp. Mecânica (DM):</span> {horasCalc}</li>
                        <li><span className="font-bold">Horas de Indisp. Operacional (DO):</span> {minutosDO != null ? formatMinutesToHms(minutosDO) : "Calculando..."}</li>
                      </ul>
                      <p className="mt-2 text-zinc-500 text-[9px]">
                        *A DO considera apenas o tempo entre abertura e fechamento que coincidiu com o turno operacional do veículo.
                      </p>
                    </div>
                    <div className="bg-white/70 p-3 rounded border border-blue-200">
                      <p className="font-bold text-zinc-800 mb-1 text-[9px] uppercase tracking-tighter">Regras PCM (Exemplo Turno 08h-16h):</p>
                      <p className="text-zinc-500 leading-tight">
                        Se quebrar às 13:00h, conta 3h de DO (até o fim do turno). Se quebrar após as 16:00h, o impacto na DO é zero.
                      </p>
                    </div>
                  </div>
                </div>

                {/* ── Bloco 6 — Assinaturas ── */}
                <div>
                  <div className="section-title-print bg-[#1a5c1a] text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5">
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
      </div>
    </>
  );
}

// ─── Sub-componente: campo da ficha ─────────────────────────────────────────
function FP({
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
