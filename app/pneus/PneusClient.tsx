"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Plus, Circle, ShieldAlert, AlertTriangle, Search, Printer } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { excluirInspecao, excluirInspecoesMassivo } from "./actions";
import { useAuth } from "@/components/auth-context";
import PneusModal from "./PneusModal";
import PneusImportModal from "./PneusImportModal";
import PneusAIReport from "./PneusAIReport";
import { Sparkles, CalendarCheck, Archive } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type Equipamento = { id: string; placa: string; tipo?: string | null; modulo?: string | null };
type Inspecao = {
  id: string;
  equipamento_id: string;
  data_inspecao: string;
  km_atual: number | null;
  de: number | null; dd: number | null;
  tei: number | null; tee: number | null; tdi: number | null; tde: number | null;
  tei1: number | null; tee1: number | null; tdi1: number | null; tde1: number | null;
  estepe: number | null;
  condicao: string;
  equipamentos?: { placa: string; tipo?: string | null };
};

const POSICOES = ["de","dd","tei","tee","tdi","tde","tei1","tee1","tdi1","tde1","estepe"] as const;
type Pos = typeof POSICOES[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sulcoColor(v: number | null): string {
  if (v == null) return "bg-zinc-100 dark:bg-zinc-800 text-zinc-400";
  if (v < 3) return "bg-red-500 text-white"; // < 3mm (Trocar)
  if (v <= 5) return "bg-orange-400 text-white"; // 3-5mm (Crítico)
  if (v <= 9) return "bg-yellow-400 text-zinc-900"; // 6-9mm (Atenção)
  return "bg-emerald-500 text-white"; // >= 10mm (Bom)
}

function condBadge(c: string) {
  const map: Record<string, string> = {
    BOM: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
    REGULAR: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    ATENCAO: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    CRITICO: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    TROCAR: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  return map[c] || map.BOM;
}

const COND_COLOR: Record<string, string> = {
  BOM: "#22c55e", REGULAR: "#facc15", ATENCAO: "#facc15", CRITICO: "#f97316", TROCAR: "#ef4444",
};

function fmtDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const [datePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

type Tab = "dashboard" | "lista" | "historico";

export default function PneusClient({
  equipamentos,
  inspecoes,
}: {
  equipamentos: Equipamento[];
  inspecoes: Inspecao[];
}) {
  const router = useRouter();
  const { profile } = useAuth();
  const isVisitante = profile?.role === "visitante";

  const [tab, setTab] = useState<Tab>("dashboard");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAIReportOpen, setIsAIReportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Inspecao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Pré-carrega SheetJS via CDN para Export e Import
  useEffect(() => {
    if (!(window as any).XLSX) {
      const script = document.createElement("script");
      script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
      document.head.appendChild(script);
    }
    if (!(window as any).html2pdf) {
      const script2 = document.createElement("script");
      script2.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      document.head.appendChild(script2);
    }
  }, []);

  // ── Batch Actions ──
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === inspecoes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(inspecoes.map(i => i.id)));
  };
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Confirmar exclusão de ${selectedIds.size} registros?`)) return;
    const res = await excluirInspecoesMassivo(Array.from(selectedIds));
    if (res && "error" in res) alert(res.error); else setSelectedIds(new Set());
  };
  const handleDelete = async (id: string) => {
    if (!confirm("Confirmar exclusão definitiva?")) return;
    const res = await excluirInspecao(id);
    if (res && "error" in res) alert(res.error);
  };

  // ── Search & Filter ── (Default: Current Month)
  const [search, setSearch] = useState("");
  const [searchStatus, setSearchStatus] = useState("");
  const [dateInicio, setDateInicio] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateFim, setDateFim] = useState(() => {
    const d = new Date();
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });

  const filteredInspecoesRows = inspecoes.filter(i => {
    const matchesSearch = !search || i.equipamentos?.placa?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !searchStatus || i.condicao === searchStatus;
    const iDate = i.data_inspecao.split('T')[0];
    const matchesDate = (!dateInicio || iDate >= dateInicio) && (!dateFim || iDate <= dateFim);
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleClearFilters = () => {
    setSearch("");
    setSearchStatus("");
    const d = new Date();
    setDateInicio(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    setDateFim(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
  };

  // ── Dashboard Logic (Latest per Plate) ──
  // Ponto 4: "Sempre que lançar um novo... deixar o mais recente no dashboard"
  const latestByEq = Object.values(filteredInspecoesRows.reduce((acc, current) => {
    // Como os dados veem do Supabase ordenados do mais recente (DESC),
    // a PRIMEIRA ocorrência é garantidamente o último boletim lançado
    if (!acc[current.equipamento_id]) {
      acc[current.equipamento_id] = current;
    }
    return acc;
  }, {} as Record<string, Inspecao>));

  const counts = { BOM: 0, REGULAR: 0, ATENCAO: 0, CRITICO: 0, TROCAR: 0 };
  latestByEq.forEach(ins => { 
    if (ins.condicao in counts) (counts as any)[ins.condicao]++; 
    else if (ins.condicao === 'REGULAR') counts.ATENCAO++;
  });
  const total = latestByEq.length || 1;
  const criticos = latestByEq.filter(i => i.condicao === "CRITICO" || i.condicao === "TROCAR");
  const pieData = Object.entries(counts).map(([name, value]) => ({ name, value })).filter(d => d.value > 0);
  
  const globalLatestDate = latestByEq.length > 0 
    ? latestByEq.reduce((latest, current) => {
        const d = current.data_inspecao;
        return !latest || d > latest ? d : latest;
      }, "") 
    : null;

  const posMedia = POSICOES.map(pos => {
    const vals = latestByEq.map(i => i[pos]).filter(v => v != null) as number[];
    return { pos: pos.toUpperCase(), media: vals.length ? Math.round((vals.reduce((a,b)=>a+b,0)/vals.length)*10)/10 : 0 };
  }).filter(d => d.media > 0);

  const exportExcel = () => {
    const XLSXLib = (window as any).XLSX;
    if (!XLSXLib) {
      alert('Aguarde o carregamento da biblioteca Excel e tente novamente.');
      return;
    }
    const rows = inspecoes.map(i => ({
      Placa: i.equipamentos?.placa, Data: fmtDate(i.data_inspecao), Km: i.km_atual, Condicao: i.condicao,
      DE: i.de, DD: i.dd, TEI: i.tei, TEE: i.tee, TDI: i.tdi, TDE: i.tde, ESTEPE: i.estepe
    }));
    const ws = XLSXLib.utils.json_to_sheet(rows);
    const wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, ws, "Pneus");
    XLSXLib.writeFile(wb, "Relatorio_Pneus.xlsx");
  };

   const downloadBoletimPDF = (ins: Inspecao) => {
    if (!(window as any).html2pdf) {
      alert("Aguarde o carregamento do gerador de PDF."); return;
    }
    const html = `
      <div style="padding: 10px; font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10px; width: 100%; box-sizing: border-box; background: #fff;">
         <!-- Header -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 2px solid #166534;">
            <tr>
               <td style="width: 25%; border-right: 2px solid #166534; text-align: center; padding: 5px;">
                  <div style="font-size: 18px; font-weight: 900; letter-spacing: -1px; color: #000;">EUNAMAN</div>
               </td>
               <td style="width: 50%; border-right: 2px solid #166534; text-align: center; vertical-align: middle; color: #000;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px;">BOLETIM DE PNEUS</h1>
               </td>
               <td style="width: 25%; padding: 5px; font-size: 9px; line-height: 1.2; color: #000;">
                  <div>Doc. Nº.:</div>
                  <div>Página: 1</div>
                  <div>Versão: 1.0</div>
                  <div style="color: red; font-weight: bold; text-align: left; margin-top: 5px;">${ins.id.split('-')[0].toUpperCase()}</div>
               </td>
            </tr>
         </table>

         <!-- Info Sec -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 2px solid #166534; color: #000;">
            <tr>
               <td style="border: 1px solid #166534; padding: 4px; width: 15%; vertical-align: top;">
                  <div style="font-size: 8px;">Ordem de Serviço:</div>
               </td>
               <td style="border: 1px solid #166534; padding: 4px; width: 15%; vertical-align: top;">
                  <div style="font-size: 8px;">Origem:</div>
                  <div style="margin-top:2px;">[ &nbsp; ] INTERNA</div>
                  <div style="margin-top:2px;">[ &nbsp; ] CAMPO</div>
               </td>
               <td style="border: 1px solid #166534; padding: 0; width: 70%; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse; height: 100%;">
                     <tr>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 45%;"><div style="font-size: 8px;">FUNCIONÁRIO:</div></td>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 15%;"><div style="font-size: 8px;">ID:</div></td>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 20%; color: #000;"><div style="font-size: 8px;">Data Entrada:</div><div style="font-weight:bold">${fmtDate(ins.data_inspecao)}</div></td>
                        <td style="border-bottom: 1px solid #166534; padding: 4px; width: 20%;"><div style="font-size: 8px;">Hora:</div></td>
                     </tr>
                     <tr>
                        <td colspan="2" style="border-right: 1px solid #166534; padding: 4px; color: #000;"><div style="font-size: 8px;">EQUIPAMENTO:</div><div style="font-weight:bold; font-size: 14px;">${ins.equipamentos?.placa || ''}</div></td>
                        <td style="border-right: 1px solid #166534; padding: 4px;"><div style="font-size: 8px;">Data Saída:</div></td>
                        <td style="padding: 4px;"><div style="font-size: 8px;">Hora:</div></td>
                     </tr>
                  </table>
               </td>
            </tr>
         </table>

         <!-- Desmontados Header -->
         <div style="background-color: #f0fdf4; border: 2px solid #166534; text-align: center; font-weight: bold; padding: 4px; margin-bottom: 5px; color: #000;">P N E U S &nbsp; &nbsp; D E S M O N T A D O S</div>
         
         <!-- Tabela Desmontados -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #166534; font-size: 8px; text-align: center; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">POSIÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">TIPO DE<br>INTERVENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">MOTIVO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">CAUSA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 1</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 2</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 3</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">PRESSÃO<br>MEDIDA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 14%;">PRESSÃO<br>CALIBRADA</th>
            </tr>
            ${[
               { lbl: '1º EIXO DE', val: ins.de }, { lbl: '1º EIXO DD', val: ins.dd },
               { lbl: '2º EIXO TEE', val: ins.tee }, { lbl: '2º EIXO TEI', val: ins.tei },
               { lbl: '2º EIXO TDI', val: ins.tdi }, { lbl: '2º EIXO TDE', val: ins.tde },
               { lbl: '3º EIXO TEE', val: ins.tee1 }, { lbl: '3º EIXO TEI', val: ins.tei1 },
               { lbl: '3º EIXO TDI', val: ins.tdi1 }, { lbl: '3º EIXO TDE', val: ins.tde1 },
               { lbl: '98 STEP', val: ins.estepe }
            ].map((r, i) => r.val != null || i < 2 ? `
               <tr>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: bold; background-color: #f8fafc; color: #000;">${r.lbl}</td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: 900; font-size: 10px; color: #000;">${r.val != null ? r.val : ''}</td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
               </tr>
            ` : '').join('')}
         </table>

         <!-- Montados Header -->
         <div style="background-color: #f0fdf4; border: 2px solid #166534; border-bottom: none; text-align: center; font-weight: bold; padding: 4px; color: #000;">P N E U S &nbsp; &nbsp; M O N T A D O S</div>
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #166534; font-size: 8px; text-align: center; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">POSIÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">TIPO DE<br>INTERVENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">MOTIVO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">CAUSA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 1</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 2</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 3</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">PRESSÃO<br>MEDIDA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 14%;">PRESSÃO<br>CALIBRADA</th>
            </tr>
            ${[
               { lbl: '1º EIXO DE' }, { lbl: '1º EIXO DD' },
               { lbl: '2º EIXO TEE' }, { lbl: '2º EIXO TEI' },
               { lbl: '98 STEP' }
            ].map(r => `
               <tr>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: bold; background-color: #f8fafc; color: #000;">${r.lbl}</td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
               </tr>
            `).join('')}
         </table>

         <!-- Legends / Dictionary -->
         <table style="width: 100%; border-collapse: collapse; border: 2px solid #166534; font-size: 7px; margin-bottom: 10px; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 25%;">EVENTO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 50%;">MOTIVO DA RETIRADA / MANUTENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 25%;">TIPO DE REPARO</th>
            </tr>
            <tr>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="margin-bottom:2px;">[ 1 ] MOVIMENTAÇÃO</div>
                  <div style="margin-bottom:2px;">[ 2 ] CONSERTO</div>
                  <div style="margin-bottom:2px;">[ 3 ] INVENTÁRIO</div>
                  <div style="margin-bottom:2px;">[ 4 ] CALIBRAGEM / MEDIÇÃO</div>
                  <div style="margin-bottom:2px;">[ 5 ] RETIRADA RECAPAGEM</div>
               </td>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="column-count: 2; column-gap: 15px;">
                     <div style="margin-bottom:2px;">[ 1 ] RODOU FURADO</div>
                     <div style="margin-bottom:2px;">[ 2 ] RODOU BAIXA PRESSÃO</div>
                     <div style="margin-bottom:2px;">[ 3 ] DESGASTE IRREGULAR</div>
                     <div style="margin-bottom:2px;">[ 4 ] TALÕES DANIFICADO</div>
                     <div style="margin-bottom:2px;">[ 5 ] IMPACTO DE FRANCO</div>
                     <div style="margin-bottom:2px;">[ 6 ] PERFURAÇÃO OBJETOS</div>
                     <div style="margin-bottom:2px;">[ 7 ] SEPARAÇÃO DE BANDA</div>
                     <div style="margin-bottom:2px;">[ 19] RECAPAGEM</div>
                     <div style="margin-bottom:2px;">[ 20] RODÍZIO DE PNEU</div>
                     <div style="margin-bottom:2px;">[ 31] INVENTÁRIO</div>
                  </div>
               </td>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="column-count: 1;">
                     <div style="margin-bottom:2px;">[ 1 ] PREGO</div>
                     <div style="margin-bottom:2px;">[ 2 ] PARAFUSO</div>
                     <div style="margin-bottom:2px;">[ 3 ] FERRO</div>
                     <div style="margin-bottom:2px;">[ 4 ] RODA QUEBRADA</div>
                     <div style="margin-bottom:2px;">[ 7 ] CORTE PNEU</div>
                  </div>
               </td>
            </tr>
         </table>

         <div style="display: flex; gap: 10px; font-size: 8px; color: #000;">
            <div style="border: 2px solid #166534; padding: 6px; flex: 1;">
               <b>STATUS DIAGNOSTICADO:</b> <span style="background-color: ${ins.condicao === 'CRITICO' || ins.condicao === 'TROCAR' ? '#fee2e2' : '#dcfce7'}; padding: 2px 4px; border: 1px solid #166534;">${ins.condicao}</span>
            </div>
            <div style="border: 2px solid #166534; padding: 6px; flex: 2; display: flex; flex-direction: column; justify-content: flex-end;">
               <div style="border-top: 1px solid #166534; margin-top: 20px; text-align: center;">Assinatura do Mecânico / Encarregado</div>
            </div>
         </div>
      </div>
    `;
    const element = document.createElement("div");
    element.innerHTML = html;
    (window as any).html2pdf().set({
      margin: [5, 5, 5, 5],
      filename: `Boletim_${ins.equipamentos?.placa}_${fmtDate(ins.data_inspecao).replace(/\//g, '-')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(element).save();
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[100rem] mx-auto w-full h-full animate-in fade-in duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white dark:bg-zinc-950 p-6 md:p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative overflow-hidden group">
         <div className="absolute top-0 right-0 w-48 h-48 bg-orange-500/5 blur-3xl rounded-full -mr-20 -mt-20 group-hover:bg-orange-500/10 transition-colors" />
         
         <div className="flex items-center gap-5 relative z-10">
            <div className="p-4 bg-orange-500 text-white rounded-2xl shadow-xl shadow-orange-500/20">
              <Circle size={28} fill="currentColor" fillOpacity={0.2} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Boletim de Pneus</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 font-bold flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                 Monitoramento e Inspeção de Frotas
              </p>
            </div>
         </div>

          <div className="flex flex-wrap items-center gap-3 relative z-10">
            {/* Filtro por Placa */}
            <div className="relative group">
               <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
               <input 
                 type="text" 
                 placeholder="PLACA..." 
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 className="pl-12 pr-6 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-xs font-black uppercase tracking-widest focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 outline-none transition-all w-44"
               />
            </div>

            {/* Filtro por Data */}
            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-3 py-1.5 gap-2">
              <input 
                type="date" 
                value={dateInicio}
                onChange={e => setDateInicio(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-600 dark:text-zinc-400"
              />
              <span className="text-zinc-300 font-bold">/</span>
              <input 
                type="date" 
                value={dateFim}
                onChange={e => setDateFim(e.target.value)}
                className="bg-transparent text-[10px] font-black uppercase outline-none text-zinc-600 dark:text-zinc-400"
              />
            </div>

            {/* Filtro por Status */}
            <select 
              value={searchStatus}
              onChange={e => setSearchStatus(e.target.value)}
              className="px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[10px] font-black uppercase tracking-widest outline-none transition-all cursor-pointer"
            >
              <option value="">TODOS STATUS</option>
              {Object.keys(counts).map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {(search || searchStatus) && (
              <button 
                onClick={handleClearFilters}
                className="px-4 py-3 text-[10px] font-black text-red-500 uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/20 rounded-2xl transition-all"
              >
                Limpar
              </button>
            )}

            <button onClick={exportExcel} className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
               <Download size={16} /> Exportar
            </button>

            {!isVisitante && (
              <button 
                  onClick={() => alert("Histórico da quinzena arquivado com sucesso. Iniciando novo ciclo...")}
                  className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-orange-600 border border-orange-200 dark:border-orange-900/50 rounded-2xl hover:bg-orange-50 dark:hover:bg-orange-950/20 transition-all"
              >
                 <Archive size={16} /> Fechar Ciclo
              </button>
            )}
            
            {!isVisitante ? (
              <>
                <button onClick={() => setIsImportOpen(true)} className="flex items-center gap-2 px-4 py-3 text-xs font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-sm">
                   <Upload size={16} /> Importar
                </button>
                <button onClick={() => { setEditingItem(null); setIsModalOpen(true); }} className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl text-xs font-black shadow-lg shadow-orange-500/30 transition-all active:scale-95 group">
                   <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                   Registrar
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2 px-5 py-3 bg-zinc-100 dark:bg-zinc-900 rounded-2xl text-zinc-500 text-xs font-bold border border-zinc-200 dark:border-zinc-800 shadow-inner">
                 <ShieldAlert size={16} className="text-orange-500" />
                 VISUALIZAÇÃO
              </div>
            )}
         </div>
      </div>

      {criticos.length > 0 && (
        <div className="flex items-center gap-4 px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 shadow-sm animate-pulse">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span className="text-sm font-bold tracking-tight">
            ALERTA: {criticos.length} pneus em estado crítico ou troca imediata detectados na frota.
          </span>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl w-fit border border-zinc-200 dark:border-zinc-800">
           {(["dashboard", "lista", "historico"] as Tab[]).map((t) => (
             <button 
               key={t} onClick={() => setTab(t)}
               className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${tab === t ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-md" : "text-zinc-500 hover:text-zinc-700 hover:bg-white/50"}`}
             >
               {t}
             </button>
           ))}
        </div>

        {tab === "dashboard" && (
          <div className="space-y-6">
            {/* Matrix Table - NOW PRINCIPAL AT THE TOP */}
            <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-700">
               <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <button 
                      onClick={() => setIsAIReportOpen(true)}
                      className="flex items-center gap-3 px-6 py-4 bg-zinc-900 dark:bg-orange-500/10 text-white dark:text-orange-400 border border-zinc-800 dark:border-orange-500/30 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all group overflow-hidden relative"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                      <Sparkles size={20} className="text-orange-500 animate-pulse" />
                      RELATÓRIO IA
                    </button>
                    <div>
                      <h3 className="font-black text-zinc-800 dark:text-zinc-200 tracking-tight text-lg">Painel de Monitoramento Detalhado</h3>
                      <p className="text-[11px] font-bold text-zinc-400 uppercase flex items-center gap-2">
                        <CalendarCheck size={14} className="text-emerald-500" />
                        Última Atualização: <span className="text-zinc-900 dark:text-zinc-50">{fmtDate(globalLatestDate)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 text-[10px] font-black uppercase tracking-tighter text-zinc-400">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Bom</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" /> Crítico</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500" /> Trocar</span>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-[10px]">
                   <thead>
                     <tr className="bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
                       <th className="px-6 py-4 font-black uppercase tracking-widest text-zinc-400 text-left">Veículo</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center">Data</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={2}>Frontal</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 1</th>
                       <th className="px-4 py-4 font-black uppercase tracking-widest text-zinc-400 text-center" colSpan={4}>Eixo 2</th>
                       <th className="px-6 py-4 font-black uppercase tracking-widest text-zinc-400 text-center">Step</th>
                     </tr>
                     <tr className="bg-zinc-50/30 dark:bg-zinc-900/30">
                       <th className="px-6 py-2" />
                       <th className="px-4 py-2" />
                       {["DE","DD","TEI","TEE","TDI","TDE","TEI1","TEE1","TDI1","TDE1","EST"].map(l => (
                         <th key={l} className="px-1 py-2 text-center text-orange-500/70 font-black">{l}</th>
                       ))}
                     </tr>
                   </thead>
                    <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                      {latestByEq.map((ins: any) => (
                       <tr key={ins.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors group">
                         <td className="px-6 py-4">
                            <span className="block text-sm text-zinc-900 dark:text-zinc-50 font-black">{ins.equipamentos?.placa}</span>
                            <span className="text-[9px] text-zinc-400 block tracking-widest">{ins.km_atual || ins.horimetro_registro || 0} {ins.km_atual ? 'KM' : 'H'}</span>
                         </td>
                         <td className="px-4 py-4 text-center">
                            <span className="text-[10px] font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                              {ins.data_inspecao.split('T')[0].split('-').slice(1, 3).reverse().join('/')}
                            </span>
                         </td>
                         {POSICOES.map(pos => (
                           <td key={pos} className="px-1 py-4 text-center">
                              {ins[pos] != null ? <span className={`inline-block w-8 py-1.5 rounded-lg border-b-2 text-center shadow-sm ${sulcoColor(ins[pos])}`}>{ins[pos]}</span> : <span className="text-zinc-200 dark:text-zinc-800 opacity-20">••</span>}
                           </td>
                         ))}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {Object.entries(counts).map(([label, val]) => (
                <div key={label} className="bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow group">
                   <div className="flex items-center justify-between mb-4">
                      <span className={`p-2.5 rounded-xl ${label === 'BOM' ? 'bg-emerald-50 text-emerald-500' : label === 'REGULAR' ? 'bg-yellow-50 text-yellow-500' : 'bg-red-50 text-red-500'}`}>
                         <Circle size={20} fill="currentColor" fillOpacity={0.2} />
                      </span>
                      <span className="text-[10px] font-black text-zinc-400 uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Consolidado</span>
                   </div>
                   <div className="text-3xl font-black text-zinc-900 dark:text-zinc-50">{val}</div>
                   <p className="text-xs font-bold text-zinc-500 mt-1">{label} - {Math.round((val/total)*100)}%</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
               <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[400px]">
                 <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-8 flex items-center gap-2">📊 Distribuição das Condições</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} dataKey="value" paddingAngle={5}>
                        {pieData.map((entry) => <Cell key={entry.name} fill={COND_COLOR[entry.name]} />)}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}
                        itemStyle={{ fontWeight: 'bold' }}
                      />
                    </PieChart>
                 </ResponsiveContainer>
               </div>

               <div className="bg-white dark:bg-zinc-950 p-8 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm min-h-[400px]">
                 <h3 className="font-bold text-zinc-800 dark:text-zinc-200 mb-8 flex items-center gap-2">📈 Média de Desgaste (Sulcos)</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={posMedia} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" opacity={0.5} />
                      <XAxis dataKey="pos" tick={{ fontSize: 9, fontWeight: 800, fill: '#71717a' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f4f4f5', radius: 10 }} contentStyle={{ borderRadius: '12px' }} />
                      <Bar dataKey="media" fill="#f97316" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                 </ResponsiveContainer>
               </div>
            </div>


          </div>
        )}

        {tab === "lista" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-between items-center">
               <div className="flex items-center gap-4">
                  {selectedIds.size > 0 && !isVisitante && (
                    <button onClick={handleBatchDelete} className="px-4 py-2 bg-red-500 text-white rounded-xl text-xs font-black shadow-lg shadow-red-500/20 active:scale-95 transition-all">Excluir {selectedIds.size}</button>
                  )}
               </div>
             </div>
             <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 w-10"><input type="checkbox" onChange={toggleSelectAll} checked={inspecoes.length > 0 && selectedIds.size === inspecoes.length} /></th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Placa</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Data</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">KM</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">Status</th>
                      <th colSpan={3} className="px-4 py-4 font-black uppercase text-zinc-400 text-right">Controle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {latestByEq.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors group">
                        <td className="px-6 py-4"><input type="checkbox" checked={selectedIds.has(ins.id)} onChange={() => toggleSelect(ins.id)} /></td>
                        <td className="px-4 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black">{ins.equipamentos?.placa}</td>
                        <td className="px-4 py-4 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{ins.km_atual || '??'}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                        <td className="px-4 py-4 text-right" colSpan={3}>
                           {!isVisitante && (
                              <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => downloadBoletimPDF(ins)} className="p-2 text-zinc-400 hover:text-orange-500" title="Imprimir PDF"><Printer size={16} /></button>
                                <button onClick={() => { setEditingItem(ins); setIsModalOpen(true); }} className="p-2 text-zinc-400 hover:text-blue-500"><Plus size={16} /></button>
                                <button onClick={() => handleDelete(ins.id)} className="p-2 text-zinc-400 hover:text-red-500"><Plus size={16} className="rotate-45" /></button>
                              </div>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}

        {tab === "historico" && (
           <div className="bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden animate-in fade-in duration-500">
             <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
               <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">Histórico Completo de Inspeções</h4>
             </div>
             <div className="overflow-x-auto min-h-[300px]">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-4 font-black uppercase text-zinc-400">Placa</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400">Data</th>
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">KM</th>
                      {POSICOES.map(p => <th key={p} className="px-2 py-4 font-black uppercase text-zinc-400 text-center">{p}</th>)}
                      <th className="px-4 py-4 font-black uppercase text-zinc-400 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900 font-bold">
                    {filteredInspecoesRows.map(ins => (
                      <tr key={ins.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-6 py-4 text-zinc-900 dark:text-zinc-100 text-sm font-black">{ins.equipamentos?.placa}</td>
                        <td className="px-4 py-4 text-zinc-500">{fmtDate(ins.data_inspecao)}</td>
                        <td className="px-4 py-4 text-center font-black text-blue-600">{ins.km_atual || '??'}</td>
                        {POSICOES.map(p => (
                           <td key={p} className="px-2 py-4 text-center">
                             <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${sulcoColor(ins[p])}`}>
                               {ins[p] || '-'}
                             </span>
                           </td>
                        ))}
                        <td className="px-4 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-black tracking-widest border ${condBadge(ins.condicao)}`}>{ins.condicao}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
           </div>
        )}
      </div>

      {/* Modals */}
      <PneusModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        equipamentos={equipamentos}
        editData={editingItem}
        onSuccess={() => router.refresh()}
      />
      
      <PneusImportModal 
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => router.refresh()}
      />

      {isAIReportOpen && (
        <PneusAIReport 
          inspecoes={inspecoes} 
          onClose={() => setIsAIReportOpen(false)} 
        />
      )}
    </div>
  );
}
