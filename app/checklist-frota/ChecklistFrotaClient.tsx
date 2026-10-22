"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, X, FileText, Download, Share2, Loader2, Camera, Trash2,
  ClipboardCheck, AlertTriangle, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";
import { ChecklistFrota, salvarChecklistFrota, excluirChecklistFrota } from "./actions";
import {
  FROTAS, FrotaKey, TIPOS, TipoChecklist, ID_FIELDS, GERAL, SIGS, SECTIONS,
  itemKey, secoesParaFrota, criarItensVazios, criarGeralVazio,
  Foto, ItemResposta, Avaria, Assinatura, Resultado, RESULTADO_LABEL, calcularResultado,
} from "./checklistFrotaConfig";

// ── Compressão de foto (1280px / JPEG 70%) ──────────────────────────────────
function compress(file: File): Promise<Foto | null> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      let w = img.naturalWidth, h = img.naturalHeight;
      const r = Math.min(1, max / Math.max(w, h));
      w = Math.round(w * r); h = Math.round(h * r);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve({ d: c.toDataURL("image/jpeg", 0.7), w, h });
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}
async function readFiles(files: FileList | null): Promise<Foto[]> {
  if (!files) return [];
  const out: Foto[] = [];
  for (const f of Array.from(files)) { const p = await compress(f); if (p) out.push(p); }
  return out;
}

type ChecklistState = {
  frotaTipo: FrotaKey;
  tipo: TipoChecklist;
  id: Record<string, string>;
  geral: Record<number, Foto[]>;
  items: Record<string, ItemResposta>;
  avarias: Avaria[];
  obs: string;
  assinaturas: Record<string, Assinatura>;
};

function estadoVazio(): ChecklistState {
  return { frotaTipo: "comboio", tipo: "DEVOLUCAO", id: {}, geral: criarGeralVazio(), items: criarItensVazios(), avarias: [], obs: "", assinaturas: {} };
}

function estadoDeRegistro(c: ChecklistFrota): ChecklistState {
  return {
    frotaTipo: c.frota_tipo,
    tipo: c.tipo_checklist,
    id: {
      placa: c.placa || "", frota: c.frota || "", modelo: c.marca_modelo || "", nucleo: c.nucleo || "",
      km: c.km != null ? String(c.km) : "", horimetro: c.horimetro != null ? String(c.horimetro) : "",
      regdiesel: c.registradora_diesel != null ? String(c.registradora_diesel) : "",
      reginsumo: c.registradora_insumo != null ? String(c.registradora_insumo) : "",
      saldo: c.saldo_tanque != null ? String(c.saldo_tanque) : "", local: c.local || "",
      data: c.data_checklist || "", hora: c.hora || "", mecanico: c.mecanico || "",
      matricula: c.matricula_mecanico || "", recebedor: c.responsavel_recebe || "",
    },
    geral: c.fotos_gerais || {},
    items: c.respostas || {},
    avarias: c.avarias || [],
    obs: c.observacoes_gerais || "",
    assinaturas: c.assinaturas || {},
  };
}

const TIPO_LABEL: Record<string, string> = { ENTRADA: "Entrada", DEVOLUCAO: "Devolução", RECEBIMENTO: "Recebimento" };
const RESULTADO_COLOR: Record<Resultado, string> = {
  LIBERADO: "bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  RESSALVAS: "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  INTERDITADO: "bg-red-50 border-red-400 text-red-700 dark:bg-red-900/20 dark:text-red-400",
};
const RESULTADO_ICON: Record<Resultado, any> = { LIBERADO: ShieldCheck, RESSALVAS: AlertTriangle, INTERDITADO: ShieldAlert };

// Mapeia a frota (chave minúscula do config) pro valor usado na coluna `tipo` de
// equipamentos (cadastro de Base de Frotas), pra filtrar a lista de placas sugeridas.
const FROTA_PARA_TIPO_EQUIPAMENTO: Record<FrotaKey, string> = {
  comboio: "COMBOIO", pipa: "PIPA", multifuncional: "MULTIFUNCIONAL", munck: "MUNCK",
};

// ── PDF customizado (jsPDF) ───────────────────────────────────────────────────
const COLORS: Record<string, [number, number, number]> = {
  C: [30, 122, 70], N: [30, 122, 70], NC: [194, 50, 31], F: [194, 50, 31], NA: [110, 120, 114], M: [180, 130, 0],
};
const LABEL: Record<string, string> = { C: "C", NC: "NC", NA: "NA", N: "Normal", M: "Meia vida", F: "Fim de vida" };
const RESULT_COLOR_PDF: Record<Resultado, [number, number, number]> = {
  LIBERADO: [30, 122, 70], RESSALVAS: [180, 130, 0], INTERDITADO: [194, 50, 31],
};
const BRAND: [number, number, number] = [30, 90, 60];

function fmtDataBr(d: string) {
  if (!d) return "-";
  const [a, m, dd] = d.split("-");
  return dd && m && a ? `${dd}/${m}/${a}` : d;
}

async function buildPDF(S: ChecklistState, resultado: Resultado): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 12, CW = W - 2 * M, BOTTOM = 284;
  let y = 0;

  function newPage() { doc.addPage(); y = 14; }
  function ensure(h: number) { if (y + h > BOTTOM) newPage(); }
  function section(t: string) {
    ensure(12);
    doc.setFillColor(...BRAND); doc.rect(M, y, CW, 7, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text(t, M + 3, y + 4.9); y += 10; doc.setTextColor(23, 34, 28);
  }
  function photoGrid(list: { p: Foto; cap?: string }[], cols: number) {
    const gap = 3, cw = (CW - gap * (cols - 1)) / cols;
    let col = 0, rowH = 0;
    list.forEach(({ p, cap }) => {
      let w = cw, h = cw * p.h / p.w;
      const maxH = cols === 2 ? 75 : cw * 1.1;
      if (h > maxH) { h = maxH; w = h * p.w / p.h; }
      const need = h + (cap ? 5 : 0) + 2;
      if (col === 0) ensure(need); else if (y + need > BOTTOM) { newPage(); col = 0; rowH = 0; }
      const x = M + col * (cw + gap) + (cw - w) / 2;
      doc.addImage(p.d, "JPEG", x, y, w, h, undefined, "FAST");
      if (cap) { doc.setFontSize(8.5); doc.setTextColor(91, 106, 97); doc.setFont("helvetica", "normal"); doc.text(cap, M + col * (cw + gap), y + h + 3.8); }
      rowH = Math.max(rowH, need); col++;
      if (col === cols) { y += rowH + 1; col = 0; rowH = 0; }
    });
    if (col) y += rowH + 1;
  }

  const secoes = secoesParaFrota(S.frotaTipo, S.tipo);

  // header
  doc.setFillColor(...BRAND); doc.rect(0, 0, W, 24, "F");
  doc.setFillColor(242, 183, 5); doc.rect(0, 24, W, 1.6, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.text(`Checklist de ${TIPO_LABEL[S.tipo].toLowerCase()} - ${FROTAS[S.frotaTipo]}`, M, 11);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`Placa ${S.id.placa || "-"}   |   Data ${fmtDataBr(S.id.data)}${S.id.hora ? " " + S.id.hora : ""}   |   Mecanico ${S.id.mecanico || "-"}`, M, 18);
  y = 32; doc.setTextColor(23, 34, 28);

  // resultado
  const rc = RESULT_COLOR_PDF[resultado];
  ensure(12);
  doc.setFillColor(...rc); doc.roundedRect(M, y, CW, 10, 1.5, 1.5, "F");
  doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`RESULTADO: ${RESULTADO_LABEL[resultado].toUpperCase()}`, M + CW / 2, y + 6.5, { align: "center" });
  y += 15; doc.setTextColor(23, 34, 28);

  // identificação
  section("Identificacao");
  const rows = ID_FIELDS.filter(f => f.k !== "data" && f.k !== "hora");
  doc.setFontSize(9.5);
  for (let i = 0; i < rows.length; i += 2) {
    ensure(7);
    [rows[i], rows[i + 1]].forEach((f, c) => {
      if (!f) return;
      const x = M + c * (CW / 2);
      doc.setFont("helvetica", "normal"); doc.setTextColor(91, 106, 97); doc.text(f.l, x, y);
      doc.setFont("helvetica", "bold"); doc.setTextColor(23, 34, 28); doc.text(String(S.id[f.k] || "-"), x + 48, y);
    });
    y += 6;
  }

  // resumo
  let c = 0, nc = 0, na = 0, sem = 0;
  secoes.forEach(({ sec, itens }) => { if (sec.tire) return; itens.forEach(it => { const v = S.items[itemKey(sec.t, it.t)]?.s; if (v === "C") c++; else if (v === "NC") nc++; else if (v === "NA") na++; else sem++; }); });
  y += 2; ensure(14);
  const boxes: [string, number, [number, number, number]][] = [["Conforme", c, COLORS.C], ["Nao conforme", nc, COLORS.NC], ["Nao se aplica", na, COLORS.NA], ["Sem resposta", sem, [150, 150, 150]]];
  const bw = (CW - 9) / 4;
  boxes.forEach((b, i) => {
    const x = M + i * (bw + 3);
    doc.setDrawColor(...b[2]); doc.setLineWidth(0.6); doc.roundedRect(x, y, bw, 12, 1.5, 1.5, "S");
    doc.setTextColor(...b[2]); doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(String(b[1]), x + 4, y + 8.2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.text(b[0], x + 14, y + 7.8);
  });
  y += 18; doc.setTextColor(23, 34, 28);

  // fotos gerais
  if (GERAL.some((_, gi) => (S.geral[gi] || []).length)) {
    section("Fotos gerais");
    const items: { p: Foto; cap: string }[] = [];
    GERAL.forEach((g, gi) => (S.geral[gi] || []).forEach(p => items.push({ p, cap: g })));
    photoGrid(items, 2);
  }

  // seções de itens
  secoes.forEach(({ sec, itens }) => {
    section(sec.t);
    itens.forEach(it => {
      const key = itemKey(sec.t, it.t);
      const resp = S.items[key] || { s: "", obs: "", reparado: false, photos: [] };
      const lbl = (it.critical ? "[CRITICO] " : "") + it.t;
      doc.setFontSize(9.5); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(lbl, CW - 34);
      let obsTxt = resp.obs ? "Obs: " + resp.obs : "";
      if ((resp.s === "NC" || resp.s === "F") && resp.reparado) obsTxt += (obsTxt ? " " : "") + "[REPARADO]";
      const obsLines = obsTxt ? doc.splitTextToSize(obsTxt, CW - 34) : [];
      const h = Math.max(lines.length, 1) * 4.4 + obsLines.length * 4.2 + 2.6;
      ensure(h);
      doc.setTextColor(23, 34, 28); doc.text(lines, M, y + 3.6);
      const v = resp.s; const col2 = v ? COLORS[v] : [160, 160, 160] as [number, number, number];
      doc.setFillColor(...col2); doc.roundedRect(W - M - 28, y, 28, 5.6, 1, 1, "F");
      doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(8.5);
      doc.text(v ? LABEL[v] : "sem resposta", W - M - 14, y + 3.9, { align: "center" });
      if (obsLines.length) {
        const red = (v === "NC" || v === "F") && !resp.reparado;
        doc.setFont("helvetica", "italic"); doc.setFontSize(9);
        doc.setTextColor(red ? 194 : 91, red ? 50 : 106, red ? 31 : 97);
        doc.text(obsLines, M, y + 3.6 + lines.length * 4.4);
      }
      y += h;
      doc.setDrawColor(213, 220, 215); doc.setLineWidth(0.2); doc.line(M, y - 1, W - M, y - 1);
      if (resp.photos?.length) { y += 1; photoGrid(resp.photos.map(p => ({ p })), 4); }
    });
    y += 3;
  });

  // avarias
  if (S.avarias.length) {
    section("Avarias encontradas");
    S.avarias.forEach((a, i) => {
      doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(23, 34, 28);
      const t = doc.splitTextToSize(`${i + 1}. ${a.local || "Local nao informado"}${a.desc ? " - " + a.desc : ""}`, CW);
      ensure(t.length * 4.4 + 3); doc.text(t, M, y + 3.6); y += t.length * 4.4 + 2;
      if (a.photos?.length) photoGrid(a.photos.map(p => ({ p })), 3);
    });
  }

  // observações + assinaturas
  section("Observacoes e assinaturas");
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(23, 34, 28);
  const ol = doc.splitTextToSize(S.obs || "Sem observacoes.", CW);
  ensure(ol.length * 4.4 + 4); doc.text(ol, M, y + 3.6); y += ol.length * 4.4 + 6;

  const SH = 26, colW = (CW - 10) / 2;
  let scol = 0;
  SIGS.forEach(s => {
    const sig = S.assinaturas[s.k];
    if (scol === 0) ensure(SH + 13);
    const x = M + scol * (colW + 10);
    if (sig?.dataUrl) {
      const w = colW * 0.85;
      doc.addImage(sig.dataUrl, "PNG", x, y + SH - Math.min(w, SH), w, Math.min(w, SH));
    }
    doc.setDrawColor(23, 34, 28); doc.setLineWidth(0.3); doc.line(x, y + SH + 1, x + colW, y + SH + 1);
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(23, 34, 28); doc.text(s.p, x, y + SH + 5);
    doc.setFont("helvetica", "normal");
    const nm = sig?.nome || "", mt = sig?.matricula || "";
    doc.text((nm ? "Nome: " + nm : "Nome: ____________________") + (mt ? " - Mat. " + mt : ""), x, y + SH + 9);
    scol++; if (scol === 2) { scol = 0; y += SH + 15; }
  });
  if (scol) y += SH + 15;

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.setFont("helvetica", "normal");
    doc.text(`Placa ${S.id.placa || "-"}  |  Gerado em ${new Date().toLocaleString("pt-BR")}`, M, 292);
    doc.text(`Pagina ${i} de ${n}`, W - M, 292, { align: "right" });
  }
  return doc;
}

// ── Assinatura por toque/mouse ────────────────────────────────────────────────
function SignaturePad({ value, onChange }: { value: string | null; onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasRef = useRef(false);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const resize = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      cv.width = rect.width * dpr; cv.height = rect.height * dpr;
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#111";
      hasRef.current = false;
      if (value) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height); img.src = value; hasRef.current = true; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white w-full h-32 touch-none"
        onPointerDown={e => {
          drawingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const ctx = canvasRef.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.beginPath(); ctx.moveTo(x, y);
        }}
        onPointerMove={e => {
          if (!drawingRef.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const [x, y] = pos(e);
          ctx.lineTo(x, y); ctx.stroke();
          hasRef.current = true;
        }}
        onPointerUp={() => { drawingRef.current = false; if (hasRef.current) onChange(canvasRef.current!.toDataURL("image/png")); }}
        onPointerCancel={() => { drawingRef.current = false; }}
      />
      <div className="flex justify-between items-center mt-1">
        <span className="text-[11px] text-zinc-400">Assine com o dedo ou mouse</span>
        <button
          type="button"
          onClick={() => {
            const cv = canvasRef.current!;
            const ctx = cv.getContext("2d")!;
            const rect = cv.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
            hasRef.current = false;
            onChange(null);
          }}
          className="text-[11px] font-bold text-red-500 hover:text-red-700"
        >
          Limpar
        </button>
      </div>
    </div>
  );
}

function FotoMultiSlot({ photos, onAdd, onRemove, onExpand, readOnly }: {
  photos: Foto[]; onAdd?: (files: FileList | null) => void; onRemove?: (i: number) => void; onExpand: (d: string) => void; readOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {photos.map((p, i) => (
        <div key={i} className="relative w-14 h-14 rounded overflow-hidden border border-zinc-200 dark:border-zinc-700 group">
          <img src={p.d} alt="" className="w-full h-full object-cover cursor-zoom-in" onClick={() => onExpand(p.d)} />
          {!readOnly && onRemove && (
            <button type="button" onClick={() => onRemove(i)} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[10px] leading-4 text-center">×</button>
          )}
        </div>
      ))}
      {!readOnly && onAdd && (
        <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline h-14 px-2 border border-dashed border-blue-300 dark:border-blue-800 rounded">
          <Camera size={13} /> {photos.length > 0 ? `+${photos.length}` : "Foto"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => { onAdd(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

export default function ChecklistFrotaClient({
  isVisitante, initialChecklists, equipamentos,
}: { isVisitante: boolean; initialChecklists: ChecklistFrota[]; equipamentos: any[] }) {
  const { isOnline } = useOffline();
  const [checklists, setChecklists] = useState<ChecklistFrota[]>(initialChecklists);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<ChecklistFrota | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState<"download" | "share" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  const [S, setS] = useState<ChecklistState>(estadoVazio());

  const setId = (k: string, v: string) => setS(prev => ({ ...prev, id: { ...prev.id, [k]: k === "placa" ? v.toUpperCase() : v } }));
  const setItemStatus = (key: string, v: string) => setS(prev => ({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], s: prev.items[key].s === v ? "" : v, reparado: prev.items[key].s === v ? false : prev.items[key].reparado } } }));
  const setItemObs = (key: string, v: string) => setS(prev => ({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], obs: v } } }));
  const setItemReparado = (key: string, v: boolean) => setS(prev => ({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], reparado: v } } }));
  const addItemFotos = async (key: string, files: FileList | null) => {
    const novas = await readFiles(files);
    setS(prev => ({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], photos: [...prev.items[key].photos, ...novas] } } }));
  };
  const delItemFoto = (key: string, i: number) => setS(prev => ({ ...prev, items: { ...prev.items, [key]: { ...prev.items[key], photos: prev.items[key].photos.filter((_, x) => x !== i) } } }));

  const addGeralFotos = async (gi: number, files: FileList | null) => {
    const novas = await readFiles(files);
    setS(prev => ({ ...prev, geral: { ...prev.geral, [gi]: [...(prev.geral[gi] || []), ...novas] } }));
  };
  const delGeralFoto = (gi: number, i: number) => setS(prev => ({ ...prev, geral: { ...prev.geral, [gi]: (prev.geral[gi] || []).filter((_, x) => x !== i) } }));

  const addAvaria = () => setS(prev => ({ ...prev, avarias: [...prev.avarias, { local: "", desc: "", photos: [] }] }));
  const delAvaria = (i: number) => setS(prev => ({ ...prev, avarias: prev.avarias.filter((_, x) => x !== i) }));
  const setAvariaCampo = (i: number, campo: "local" | "desc", v: string) => setS(prev => ({ ...prev, avarias: prev.avarias.map((a, x) => x === i ? { ...a, [campo]: v } : a) }));
  const addAvariaFotos = async (i: number, files: FileList | null) => {
    const novas = await readFiles(files);
    setS(prev => ({ ...prev, avarias: prev.avarias.map((a, x) => x === i ? { ...a, photos: [...a.photos, ...novas] } : a) }));
  };
  const delAvariaFoto = (i: number, fi: number) => setS(prev => ({ ...prev, avarias: prev.avarias.map((a, x) => x === i ? { ...a, photos: a.photos.filter((_, y) => y !== fi) } : a) }));

  const setAssinatura = (k: string, dataUrl: string | null) => setS(prev => ({ ...prev, assinaturas: { ...prev.assinaturas, [k]: { nome: prev.assinaturas[k]?.nome || "", matricula: prev.assinaturas[k]?.matricula || "", dataUrl } } }));

  const marcarPendentesComoC = (secaoTitulo: string, itens: { t: string }[], tire: boolean) => {
    setS(prev => {
      const novos = { ...prev.items };
      itens.forEach(it => {
        const key = itemKey(secaoTitulo, it.t);
        if (!novos[key]?.s) novos[key] = { ...novos[key], s: tire ? "N" : "C" };
      });
      return { ...prev, items: novos };
    });
  };

  const equipamentosFiltrados = useMemo(
    () => equipamentos.filter(e => e.tipo === FROTA_PARA_TIPO_EQUIPAMENTO[S.frotaTipo]),
    [equipamentos, S.frotaTipo]
  );

  const handlePlacaChange = (val: string) => {
    setId("placa", val);
    const eq = equipamentos.find(e => e.placa?.toLowerCase() === val.toLowerCase());
    if (eq) { setId("nucleo", eq.local || eq.area || eq.modulo || ""); setId("modelo", eq.modelo || ""); }
  };

  const secoesAtuais = useMemo(() => secoesParaFrota(S.frotaTipo, S.tipo), [S.frotaTipo, S.tipo]);

  const progresso = useMemo(() => {
    let t = 0, n = 0;
    secoesAtuais.forEach(({ sec, itens }) => { t += itens.length; itens.forEach(it => { if (S.items[itemKey(sec.t, it.t)]?.s) n++; }); });
    return { n, t };
  }, [secoesAtuais, S.items]);

  const resultadoAtual = useMemo(() => calcularResultado(S.frotaTipo, S.tipo, S.items), [S.frotaTipo, S.tipo, S.items]);

  const abrirNovo = () => { setS(estadoVazio()); setErroMsg(null); setModalOpen(true); };

  const handleSalvar = async () => {
    setErroMsg(null);
    const faltando = ID_FIELDS.filter(f => f.req && !S.id[f.k]?.trim()).map(f => f.l);
    if (faltando.length) { setErroMsg("Preencha: " + faltando.join(", ") + "."); return; }
    const ncSemObs: string[] = [];
    secoesAtuais.forEach(({ sec, itens }) => itens.forEach(it => {
      const r = S.items[itemKey(sec.t, it.t)];
      if ((r?.s === "NC" || r?.s === "F") && !r.obs?.trim()) ncSemObs.push(it.t);
    }));
    if (ncSemObs.length) { setErroMsg(`Há ${ncSemObs.length} item(ns) com problema sem descrição. Escreva o que foi encontrado antes de salvar.`); return; }

    setLoading(true);
    try {
      const assinaturasFinal: Record<string, Assinatura> = {};
      SIGS.forEach(sig => {
        assinaturasFinal[sig.k] = {
          nome: S.id[sig.k] || S.assinaturas[sig.k]?.nome || "",
          matricula: S.id[sig.m] || S.assinaturas[sig.k]?.matricula || "",
          dataUrl: S.assinaturas[sig.k]?.dataUrl || null,
        };
      });

      const payload = {
        tipo_checklist: S.tipo,
        frota_tipo: S.frotaTipo,
        placa: S.id.placa,
        frota: S.id.frota || null,
        marca_modelo: S.id.modelo || null,
        nucleo: S.id.nucleo || null,
        km: S.id.km ? parseFloat(S.id.km) : null,
        horimetro: S.id.horimetro ? parseFloat(S.id.horimetro) : null,
        registradora_diesel: S.id.regdiesel ? parseFloat(S.id.regdiesel) : null,
        registradora_insumo: S.id.reginsumo ? parseFloat(S.id.reginsumo) : null,
        saldo_tanque: S.id.saldo ? parseFloat(S.id.saldo) : null,
        local: S.id.local || null,
        data_checklist: S.id.data,
        hora: S.id.hora || null,
        mecanico: S.id.mecanico || null,
        matricula_mecanico: S.id.matricula || null,
        responsavel_recebe: S.id.recebedor || null,
        respostas: S.items,
        fotos_gerais: S.geral,
        avarias: S.avarias,
        assinaturas: assinaturasFinal,
        observacoes_gerais: S.obs || null,
        resultado: resultadoAtual,
      };

      if (isOnline) {
        const res = await salvarChecklistFrota(payload);
        if (res && "error" in res) throw new Error(res.error);
        const saved = (res as any).data;
        setChecklists(prev => [saved, ...prev]);
        await localDb.put("checklist_frota", saved);
      } else {
        const tempId = `temp_cf_${Date.now()}`;
        const newItem = { id: tempId, ...payload, status: "Fechado", filial_id: "MATRIZ", _isPendingSync: true };
        await localDb.put("checklist_frota", newItem);
        await localDb.addToQueue("checklist_frota", "create", payload);
        setChecklists(prev => [newItem as any, ...prev]);
        alert("✅ Checklist salvo localmente! Sincronizará automaticamente quando restabelecer conexão.");
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-checklist_frota"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      setModalOpen(false);
    } catch (err: any) {
      setErroMsg("Erro ao salvar: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    try {
      if (isOnline) {
        const res = await excluirChecklistFrota(id);
        if (res && "error" in res) { alert(res.error); return; }
        await localDb.delete("checklist_frota", id);
      } else {
        await localDb.delete("checklist_frota", id);
        await localDb.addToQueue("checklist_frota", "delete", { id });
      }
      setChecklists(prev => prev.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent("offline-db-updated-checklist_frota"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  };

  const handleExportPDF = async (checklist: ChecklistFrota, modo: "download" | "share") => {
    setExportandoPdf(modo);
    try {
      const estado = estadoDeRegistro(checklist);
      const resultado = checklist.resultado || calcularResultado(estado.frotaTipo, estado.tipo, estado.items);
      const doc = await buildPDF(estado, resultado);
      const blob: Blob = doc.output("blob");
      const filename = `Checklist_${TIPO_LABEL[checklist.tipo_checklist]}_${FROTAS[checklist.frota_tipo]}_${checklist.placa}_${checklist.data_checklist}.pdf`.replace(/ç/g, "c").replace(/ã/g, "a");
      await salvarOuCompartilharBlob(blob, filename, `Checklist — ${checklist.placa}`, `Checklist de ${TIPO_LABEL[checklist.tipo_checklist]} (${FROTAS[checklist.frota_tipo]}) da placa ${checklist.placa}`, modo);
    } catch (err: any) {
      alert("Erro ao gerar o PDF: " + (err.message || String(err)));
    } finally {
      setExportandoPdf(null);
    }
  };

  const renderItemLive = (sec: { t: string; tire?: boolean }, it: { t: string; critical?: boolean }) => {
    const key = itemKey(sec.t, it.t);
    const resp = S.items[key] || { s: "", obs: "", reparado: false, photos: [] };
    const vals = sec.tire ? ["N", "M", "F"] : ["C", "NC", "NA"];
    const problema = resp.s === "NC" || resp.s === "F";
    return (
      <div key={key} className="border-t border-zinc-100 dark:border-zinc-800 py-3 first:border-t-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex-1 min-w-[160px] text-sm font-medium dark:text-zinc-200 flex items-center gap-1.5">
            {it.critical && <AlertTriangle size={13} className="text-red-500 shrink-0" />}
            {it.t}
          </span>
          <div className="flex gap-1.5">
            {vals.map(v => (
              <button key={v} type="button" onClick={() => setItemStatus(key, v)} className={cn(
                "min-w-[44px] h-9 rounded-lg border-2 text-xs font-bold transition-colors",
                resp.s === v
                  ? v === "NC" || v === "F" ? "bg-red-50 border-red-500 text-red-600 dark:bg-red-900/20"
                  : v === "NA" || v === "M" ? "bg-zinc-100 border-zinc-400 text-zinc-600 dark:bg-zinc-800"
                  : "bg-emerald-50 border-emerald-500 text-emerald-600 dark:bg-emerald-900/20"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-500"
              )}>{v}</button>
            ))}
          </div>
        </div>
        {(resp.s || resp.obs) && (
          <input
            type="text" value={resp.obs} onChange={e => setItemObs(key, e.target.value)}
            placeholder={problema ? "Descreva o problema (obrigatório)" : "Observação"}
            className={cn("mt-2 w-full text-xs rounded-lg border px-3 py-2 outline-none bg-white dark:bg-zinc-950",
              problema && !resp.obs ? "border-red-400 bg-red-50 dark:bg-red-900/10" : "border-zinc-200 dark:border-zinc-700")}
          />
        )}
        {problema && (
          <label className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer w-fit">
            <input type="checkbox" checked={resp.reparado} onChange={e => setItemReparado(key, e.target.checked)} className="rounded" />
            Reparado {it.critical && <span className="text-red-500">(crítico — sem reparo interdita o equipamento)</span>}
          </label>
        )}
        <FotoMultiSlot photos={resp.photos} onAdd={f => addItemFotos(key, f)} onRemove={i => delItemFoto(key, i)} onExpand={setFotoExpandida} />
      </div>
    );
  };

  const renderItemView = (sec: { t: string; tire?: boolean }, it: { t: string; critical?: boolean }, estado: ChecklistState) => {
    const key = itemKey(sec.t, it.t);
    const resp = estado.items[key] || { s: "", obs: "", reparado: false, photos: [] };
    const v = resp.s;
    const color = !v ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : (v === "NC" || v === "F") ? "bg-red-600 text-white" : (v === "NA" || v === "M") ? "bg-zinc-500 text-white" : "bg-emerald-600 text-white";
    return (
      <div key={key} className="border-t border-zinc-100 py-2.5 first:border-t-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-700 flex items-center gap-1">{it.critical && <AlertTriangle size={11} className="text-red-500" />}{it.t}</span>
          <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap", color)}>{v ? LABEL[v] : "sem resposta"}</span>
        </div>
        {resp.obs && <p className="text-[11px] text-red-600 italic mt-1">Obs: {resp.obs}{resp.reparado ? " — REPARADO" : ""}</p>}
        {resp.photos?.length > 0 && <FotoMultiSlot photos={resp.photos} onExpand={setFotoExpandida} readOnly />}
      </div>
    );
  };

  const ResultadoBanner = ({ resultado }: { resultado: Resultado }) => {
    const Icon = RESULTADO_ICON[resultado];
    return (
      <div className={cn("flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold", RESULTADO_COLOR[resultado])}>
        <Icon size={18} /> Resultado: {RESULTADO_LABEL[resultado]}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ClipboardCheck className="text-blue-500" size={24} /> Checklist de Frota
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Entrada, devolução e recebimento de Comboio, Pipa, Multifuncional e Munck — com foto por item</p>
        </div>
        {!isVisitante && (
          <button onClick={abrirNovo} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> Novo Checklist
          </button>
        )}
      </div>

      {/* Lista / histórico */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Data", "Frota", "Tipo", "Placa", "Mecânico", "Resultado", "Ações"].map(h => (
                  <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider", h === "Ações" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {checklists.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum checklist encontrado</td></tr>
              ) : checklists.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{c.data_checklist?.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{FROTAS[c.frota_tipo] || c.frota_tipo}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{TIPO_LABEL[c.tipo_checklist]}</td>
                  <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{c.placa}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.mecanico || "-"}</td>
                  <td className="px-3 py-2.5">
                    {c.resultado ? (
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap", RESULTADO_COLOR[c.resultado as Resultado])}>{RESULTADO_LABEL[c.resultado as Resultado]}</span>
                    ) : "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button title="Ver / Gerar PDF" onClick={() => setViewChecklist(c)} className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"><FileText size={14} /></button>
                      {!isVisitante && (
                        <button title="Excluir" onClick={() => setDeletingId(c.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">{checklists.length} checklist(s)</div>
      </div>

      {/* Modal de preenchimento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b dark:border-zinc-800 flex justify-between items-center gap-4 bg-white dark:bg-zinc-950">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold dark:text-white">Novo Checklist de Frota</h2>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-1.5 flex-1 max-w-[200px] bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 transition-all" style={{ width: `${progresso.t ? progresso.n / progresso.t * 100 : 0}%` }} />
                  </div>
                  <span className="text-[11px] font-bold text-zinc-500">{progresso.n} de {progresso.t}</span>
                </div>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full shrink-0"><X size={20} /></button>
            </div>

            <div className="overflow-y-auto p-5 space-y-6">
              {/* Frota + Tipo + identificação */}
              <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800">
                <p className="text-[11px] font-bold uppercase text-zinc-500 mb-1.5">Frota</p>
                <div className="flex border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden mb-4 flex-wrap">
                  {(Object.keys(FROTAS) as FrotaKey[]).map(k => (
                    <button key={k} type="button" onClick={() => setS(prev => ({ ...prev, frotaTipo: k }))} className={cn("flex-1 min-w-[90px] py-2.5 text-sm font-bold", S.frotaTipo === k ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400")}>
                      {FROTAS[k]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] font-bold uppercase text-zinc-500 mb-1.5">Tipo de checklist</p>
                <div className="flex border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden mb-4 max-w-md">
                  {TIPOS.map(t => (
                    <button key={t.k} type="button" onClick={() => setS(prev => ({ ...prev, tipo: t.k }))} className={cn("flex-1 py-2.5 text-sm font-bold", S.tipo === t.k ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400")}>
                      {t.l}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ID_FIELDS.map(f => (
                    <div key={f.k}>
                      <label className={cn("block text-[11px] font-bold text-zinc-600 dark:text-zinc-400 mb-1", f.req && "after:content-['_*'] after:text-red-500")}>{f.l}</label>
                      {f.k === "placa" ? (
                        <>
                          <input list="placas-frota" value={S.id.placa || ""} onChange={e => handlePlacaChange(e.target.value)} placeholder="ABC-1234" className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
                          <datalist id="placas-frota">{equipamentosFiltrados.map((eq, i) => <option key={i} value={eq.placa}>{eq.placa} ({eq.local || eq.area})</option>)}</datalist>
                        </>
                      ) : (
                        <input type={f.type || "text"} value={S.id[f.k] || ""} onChange={e => setId(f.k, e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <ResultadoBanner resultado={resultadoAtual} />

              {/* Fotos gerais */}
              <details open className="bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl">
                <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-zinc-700 dark:text-zinc-300">Fotos gerais do caminhão</summary>
                <div className="p-4 pt-0">
                  <p className="text-xs text-zinc-400 mb-3">Uma foto de cada lado, do painel com o km, do horímetro e do implemento.</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {GERAL.map((g, gi) => (
                      <div key={gi} className="border border-dashed border-zinc-200 dark:border-zinc-700 rounded-lg p-3">
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 block mb-1">{g}</span>
                        <FotoMultiSlot photos={S.geral[gi] || []} onAdd={f => addGeralFotos(gi, f)} onRemove={i => delGeralFoto(gi, i)} onExpand={setFotoExpandida} />
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              {/* Seções de itens (filtradas por frota + tipo) */}
              {secoesAtuais.map(({ sec, itens }, si) => (
                <details key={sec.t} open={si === 0} className="bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl">
                  <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-zinc-700 dark:text-zinc-300 flex items-center justify-between gap-2">
                    <span>{sec.t}</span>
                    <span className="flex items-center gap-2">
                      <button type="button" onClick={e => { e.preventDefault(); marcarPendentesComoC(sec.t, itens, !!sec.tire); }} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                        Marcar pendentes como {sec.tire ? "N" : "C"}
                      </button>
                      <span className="text-[10px] font-bold text-zinc-400">{itens.filter(it => S.items[itemKey(sec.t, it.t)]?.s).length}/{itens.length}</span>
                    </span>
                  </summary>
                  <div className="px-4 pb-3">
                    {sec.tire && <p className="text-xs text-zinc-400 mb-1">N = normal, M = meia vida, F = fim de vida.</p>}
                    {itens.map(it => renderItemLive(sec, it))}
                  </div>
                </details>
              ))}

              {/* Avarias */}
              <details className="bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl">
                <summary className="px-4 py-3 cursor-pointer font-bold text-sm text-zinc-700 dark:text-zinc-300">Avarias encontradas <span className="text-[10px] font-bold text-zinc-400">{S.avarias.length}</span></summary>
                <div className="p-4 pt-0 space-y-3">
                  <p className="text-xs text-zinc-400">Descreva cada amassado, risco, trinca ou peça faltando e fotografe de perto.</p>
                  {S.avarias.map((a, i) => (
                    <div key={i} className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-3">
                      <div className="flex gap-2 items-center mb-2">
                        <strong className="text-xs text-zinc-400 w-5">{i + 1}</strong>
                        <input value={a.local} onChange={e => setAvariaCampo(i, "local", e.target.value)} placeholder="Local (ex.: lateral direita, para-choque)" className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <input value={a.desc} onChange={e => setAvariaCampo(i, "desc", e.target.value)} placeholder="Descrição da avaria" className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none" />
                        <button type="button" onClick={() => delAvaria(i)} className="text-red-500 hover:text-red-700 text-xs font-bold shrink-0">Remover</button>
                      </div>
                      <FotoMultiSlot photos={a.photos} onAdd={f => addAvariaFotos(i, f)} onRemove={fi => delAvariaFoto(i, fi)} onExpand={setFotoExpandida} />
                    </div>
                  ))}
                  <button type="button" onClick={addAvaria} className="border-2 border-blue-500 text-blue-600 dark:text-blue-400 rounded-lg px-4 py-2 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-900/20">+ Adicionar avaria</button>
                </div>
              </details>

              {/* Observações + assinaturas */}
              <div className="bg-white dark:bg-zinc-950 border dark:border-zinc-800 rounded-xl p-4 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Observações gerais</label>
                  <textarea value={S.obs} onChange={e => setS(prev => ({ ...prev, obs: e.target.value }))} rows={3} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-sm outline-none resize-y" />
                </div>
                {SIGS.map(sig => (
                  <div key={sig.k} className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                    <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">Assinatura: {sig.l}</h3>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input value={S.id[sig.k] || ""} onChange={e => setId(sig.k, e.target.value)} placeholder="Nome" className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none" />
                      <input value={S.id[sig.m] || ""} onChange={e => setId(sig.m, e.target.value)} placeholder="Matrícula" className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2 text-xs outline-none" />
                    </div>
                    <SignaturePad value={S.assinaturas[sig.k]?.dataUrl || null} onChange={d => setAssinatura(sig.k, d)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t dark:border-zinc-800 bg-white dark:bg-zinc-950">
              {erroMsg && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-semibold">{erroMsg}</div>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-zinc-300">Cancelar</button>
                <button type="button" onClick={handleSalvar} disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-60">
                  {loading && <Loader2 className="animate-spin" size={18} />} Salvar Checklist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visualização (histórico) */}
      {viewChecklist && (() => {
        const estado = estadoDeRegistro(viewChecklist);
        const secoesView = secoesParaFrota(estado.frotaTipo, estado.tipo);
        const resultado = viewChecklist.resultado as Resultado || calcularResultado(estado.frotaTipo, estado.tipo, estado.items);
        return (
          <div className="fixed inset-0 z-[100] flex justify-center bg-zinc-100 dark:bg-zinc-950 overflow-y-auto">
            <div className="w-full max-w-3xl bg-white p-6 min-h-screen shadow-xl relative">
              <div className="flex justify-between items-start gap-3 flex-wrap mb-4 sticky top-0 bg-white pb-3 z-10">
                <h1 className="text-lg font-black uppercase text-zinc-900">Checklist de {TIPO_LABEL[estado.tipo].toLowerCase()} — {FROTAS[estado.frotaTipo]} {estado.id.placa}</h1>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => handleExportPDF(viewChecklist, "download")} disabled={!!exportandoPdf} className="px-3 py-2 bg-blue-600 text-white rounded font-bold text-xs shadow hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-60">
                    <Download size={14} /> {exportandoPdf === "download" ? "Gerando..." : "Baixar PDF"}
                  </button>
                  <button onClick={() => handleExportPDF(viewChecklist, "share")} disabled={!!exportandoPdf} className="px-3 py-2 bg-emerald-600 text-white rounded font-bold text-xs shadow hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-60">
                    <Share2 size={14} /> {exportandoPdf === "share" ? "Gerando..." : "WhatsApp"}
                  </button>
                  <button onClick={() => setViewChecklist(null)} className="p-2 bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300 shadow"><X size={18} /></button>
                </div>
              </div>

              <div className="mb-4"><ResultadoBanner resultado={resultado} /></div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5 p-3 border rounded bg-zinc-50 border-zinc-200 text-zinc-800 text-xs">
                {ID_FIELDS.filter(f => f.k !== "data" && f.k !== "hora").map(f => (
                  <div key={f.k}><span className="font-bold">{f.l}:</span> {estado.id[f.k] || "-"}</div>
                ))}
                <div><span className="font-bold">Data:</span> {fmtDataBr(estado.id.data)} {estado.id.hora}</div>
              </div>

              {Object.values(estado.geral).some(l => l?.length) && (
                <div className="mb-5">
                  <h3 className="font-bold bg-zinc-200 p-1.5 px-2 text-xs uppercase mb-2">Fotos gerais</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {GERAL.map((g, gi) => (estado.geral[gi] || []).length > 0 && (
                      <div key={gi}>
                        <span className="text-[11px] text-zinc-500 block mb-1">{g}</span>
                        <FotoMultiSlot photos={estado.geral[gi]} onExpand={setFotoExpandida} readOnly />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {secoesView.map(({ sec, itens }) => (
                <div key={sec.t} className="mb-5">
                  <h3 className="font-bold bg-zinc-200 p-1.5 px-2 text-xs uppercase mb-1">{sec.t}</h3>
                  {itens.map(it => renderItemView(sec, it, estado))}
                </div>
              ))}

              {estado.avarias.length > 0 && (
                <div className="mb-5">
                  <h3 className="font-bold bg-zinc-200 p-1.5 px-2 text-xs uppercase mb-2">Avarias encontradas</h3>
                  {estado.avarias.map((a, i) => (
                    <div key={i} className="border border-zinc-200 rounded-lg p-2 mb-2">
                      <p className="text-xs font-bold">{i + 1}. {a.local || "Local não informado"}</p>
                      {a.desc && <p className="text-xs text-zinc-600">{a.desc}</p>}
                      <FotoMultiSlot photos={a.photos} onExpand={setFotoExpandida} readOnly />
                    </div>
                  ))}
                </div>
              )}

              {estado.obs && (
                <div className="mb-5">
                  <h3 className="font-bold bg-zinc-200 p-1.5 px-2 text-xs uppercase mb-2">Observações gerais</h3>
                  <p className="text-xs whitespace-pre-wrap border border-zinc-200 p-2 rounded">{estado.obs}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mt-6 pt-3 border-t border-zinc-200">
                {SIGS.map(sig => {
                  const a = estado.assinaturas[sig.k];
                  return (
                    <div key={sig.k} className="text-xs">
                      <p className="font-bold text-zinc-700">{sig.l}</p>
                      {a?.dataUrl ? <img src={a.dataUrl} alt="assinatura" className="h-10 my-1" /> : <p className="text-zinc-400 italic my-1">Sem assinatura</p>}
                      <p className="text-zinc-500">{a?.nome || "-"} {a?.matricula ? `(Mat. ${a.matricula})` : ""}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lightbox */}
      {fotoExpandida && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-zinc-950/95 backdrop-blur-sm p-4" onClick={() => setFotoExpandida(null)}>
          <button onClick={() => setFotoExpandida(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2"><X size={24} /></button>
          <img src={fotoExpandida} alt="Evidência ampliada" className="max-w-full max-h-full rounded-lg object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {/* Confirmação de exclusão */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Tem certeza que deseja excluir este checklist?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancelar</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
