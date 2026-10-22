"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, FileText, Download, Share2, Loader2, Camera, Trash2,
  Maximize2, ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";
import { ChecklistComboio, salvarChecklistComboio, excluirChecklistComboio } from "./actions";
import { getComboioConfig, ChecklistGroup, ChecklistItem } from "@/app/checklist-mecanicos/checklistConfig";
import { baixarOuCompartilharPdf, preCarregarHtml2Pdf } from "@/lib/pdf-share";

// Redimensiona/comprime pro mesmo padrão já usado nas fotos de O.S/Backlog (máx. 800px,
// JPEG 60%) — evita payloads gigantes indo pro banco e pra fila de sincronização offline.
function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        let w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h *= MAX / w; w = MAX; } }
        else { if (h > MAX) { w *= MAX / h; h = MAX; } }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.6));
        } else {
          resolve(src);
        }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const TIPO_LABEL: Record<string, string> = { RECEBIMENTO: "Recebimento", DEVOLUCAO: "Devolução" };
const TIPO_BADGE: Record<string, string> = {
  RECEBIMENTO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400",
  DEVOLUCAO: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

export default function ChecklistComboioClient({
  isVisitante, initialChecklists, equipamentos,
}: { isVisitante: boolean; initialChecklists: ChecklistComboio[]; equipamentos: any[] }) {
  const { isOnline } = useOffline();
  const [checklists, setChecklists] = useState<ChecklistComboio[]>(initialChecklists);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<ChecklistComboio | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState<"download" | "share" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fotoExpandida, setFotoExpandida] = useState<string | null>(null);

  useEffect(() => { preCarregarHtml2Pdf(); }, []);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [tipoChecklist, setTipoChecklist] = useState<"RECEBIMENTO" | "DEVOLUCAO" | "">("");
  const [placa, setPlaca] = useState("");
  const [nucleo, setNucleo] = useState("");
  const [mes, setMes] = useState("");
  const [turno, setTurno] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [motorista, setMotorista] = useState("");
  const [matriculaMotorista, setMatriculaMotorista] = useState("");
  const [km, setKm] = useState("");
  const [dataChecklist, setDataChecklist] = useState(() => new Date().toISOString().slice(0, 10));
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, string>>({});
  const [pendencias, setPendencias] = useState("");
  const [executanteNome, setExecutanteNome] = useState("");
  const [executanteMt, setExecutanteMt] = useState("");
  const [supervisorNome, setSupervisorNome] = useState("");
  const [supervisorMt, setSupervisorMt] = useState("");

  const resetForm = () => {
    setTipoChecklist(""); setPlaca(""); setNucleo(""); setMes(""); setTurno("");
    setMarcaModelo(""); setMotorista(""); setMatriculaMotorista(""); setKm("");
    setDataChecklist(new Date().toISOString().slice(0, 10));
    setRespostas({}); setFotos({}); setPendencias("");
    setExecutanteNome(""); setExecutanteMt(""); setSupervisorNome(""); setSupervisorMt("");
  };

  const handlePlacaChange = (val: string) => {
    setPlaca(val);
    const eq = equipamentos.find(e => e.placa?.toLowerCase() === val.toLowerCase());
    if (eq) {
      setNucleo(eq.local || eq.area || eq.modulo || "");
      setMarcaModelo(eq.modelo || "");
    }
  };

  const handleAnswer = (key: string, value: string) => setRespostas(prev => ({ ...prev, [key]: value }));

  const handleFoto = async (itemId: string, file: File | undefined) => {
    if (!file) return;
    const dataUrl = await comprimirImagem(file);
    setFotos(prev => ({ ...prev, [itemId]: dataUrl }));
  };

  const removerFoto = (itemId: string) => setFotos(prev => { const next = { ...prev }; delete next[itemId]; return next; });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tipoChecklist || !placa || !dataChecklist) {
      alert("Preencha o Tipo de Checklist, a Placa e a Data.");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        tipo_checklist: tipoChecklist as "RECEBIMENTO" | "DEVOLUCAO",
        empresa: "EUNAMAN",
        placa: placa.toUpperCase(),
        nucleo: nucleo || null,
        mes: mes || null,
        turno: turno || null,
        marca_modelo: marcaModelo || null,
        motorista: motorista || null,
        matricula_motorista: matriculaMotorista || null,
        km: km ? parseFloat(km) : null,
        data_checklist: dataChecklist,
        respostas,
        fotos,
        pendencias_adicionais: pendencias || null,
        executante_nome: executanteNome || null,
        executante_mt: executanteMt || null,
        supervisor_nome: supervisorNome || null,
        supervisor_mt: supervisorMt || null,
      };

      if (isOnline) {
        const res = await salvarChecklistComboio(payload);
        if (res && "error" in res) throw new Error(res.error);
        const saved = (res as any).data;
        setChecklists(prev => [saved, ...prev]);
        await localDb.put("checklist_comboio", saved);
      } else {
        const tempId = `temp_cc_${Date.now()}`;
        const newItem = { id: tempId, ...payload, status: "Fechado", filial_id: "MATRIZ", _isPendingSync: true };
        await localDb.put("checklist_comboio", newItem);
        await localDb.addToQueue("checklist_comboio", "create", payload);
        setChecklists(prev => [newItem as any, ...prev]);
        alert("✅ Checklist salvo localmente! Sincronizará automaticamente quando restabelecer conexão.");
      }

      window.dispatchEvent(new CustomEvent("offline-db-updated-checklist_comboio"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
      setModalOpen(false);
      resetForm();
    } catch (err: any) {
      alert("Erro ao salvar: " + (err.message || String(err)));
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
        const res = await excluirChecklistComboio(id);
        if (res && "error" in res) { alert(res.error); return; }
        await localDb.delete("checklist_comboio", id);
      } else {
        await localDb.delete("checklist_comboio", id);
        await localDb.addToQueue("checklist_comboio", "delete", { id });
      }
      setChecklists(prev => prev.filter(c => c.id !== id));
      window.dispatchEvent(new CustomEvent("offline-db-updated-checklist_comboio"));
      window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
    } catch (err: any) {
      alert("Erro ao excluir: " + (err.message || String(err)));
    }
  };

  const handleExportPDF = (checklist: ChecklistComboio, modo: "download" | "share" = "download") => {
    setViewChecklist(checklist);
    setExportandoPdf(modo);
    setTimeout(async () => {
      try {
        const element = document.getElementById("ficha-checklist-comboio-print");
        if (!element) { alert("Erro ao localizar a ficha para gerar o PDF."); return; }
        const filename = `Checklist_Comboio_${TIPO_LABEL[checklist.tipo_checklist]}_${checklist.placa}.pdf`;
        await baixarOuCompartilharPdf(
          element, filename,
          `Checklist Comboio — ${checklist.placa}`,
          `Checklist de ${TIPO_LABEL[checklist.tipo_checklist]} (Comboio) da placa ${checklist.placa}`,
          modo
        );
      } finally {
        setExportandoPdf(null);
      }
    }, 500);
  };

  // ── Renderização dos itens (mesmo padrão visual do Checklist Mecânicos, com
  // uma seção de foto anexada em TODO item, conforme pedido) ──────────────────
  const FotoSlot = ({ itemId, readOnlyFotos }: { itemId: string; readOnlyFotos: Record<string, string> | null }) => {
    const fotosObj = readOnlyFotos || fotos;
    const foto = fotosObj[itemId];
    const isReadOnly = readOnlyFotos !== null;
    return (
      <div className="mt-2 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-700">
        {foto ? (
          <div className="flex items-center gap-2">
            <div className="relative group w-12 h-12 rounded overflow-hidden border border-zinc-200 dark:border-zinc-700 cursor-zoom-in" onClick={() => setFotoExpandida(foto)}>
              <img src={foto} alt="Evidência" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Maximize2 size={12} className="text-white opacity-0 group-hover:opacity-100" />
              </div>
            </div>
            {!isReadOnly && (
              <button type="button" onClick={() => removerFoto(itemId)} className="text-red-500 hover:text-red-700 text-[10px] font-bold flex items-center gap-1">
                <Trash2 size={11} /> Remover
              </button>
            )}
          </div>
        ) : isReadOnly ? (
          <span className="text-[10px] text-zinc-400">Sem foto anexada</span>
        ) : (
          <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
            <Camera size={13} /> Anexar Foto
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFoto(itemId, e.target.files?.[0])} />
          </label>
        )}
      </div>
    );
  };

  const renderItem = (item: ChecklistItem, readOnlyObj: Record<string, string> | null = null, readOnlyFotos: Record<string, string> | null = null) => {
    const isReadOnly = readOnlyObj !== null;
    const resps = readOnlyObj || respostas;
    const rowCls = "p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full";

    if (item.type === "pneus") {
      const posicoes = ["DD", "DE", "TD1E", "TD1I", "TD2E", "TD2I", "TE1E", "TE1I", "TE2E", "TE2I"];
      return (
        <div key={item.id} className={rowCls}>
          <span className="text-sm font-bold dark:text-zinc-200 block mb-3 border-b pb-1 border-zinc-200 dark:border-zinc-700">{item.label}</span>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {posicoes.map(pos => (
              <div key={pos} className="flex flex-col items-center bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                <span className="text-xs font-bold mb-1">{pos}</span>
                <div className="flex gap-1">
                  {(["N", "M", "F"] as const).map(v => (
                    <label key={v} className={`text-[10px] flex flex-col items-center ${isReadOnly ? "" : "cursor-pointer"}`}>
                      <input type="radio" name={`pneu_${item.id}_${pos}`} checked={resps[`pneu_${pos}`] === v} onChange={() => !isReadOnly && handleAnswer(`pneu_${pos}`, v)} disabled={isReadOnly} />
                      <span className={`mt-1 font-bold ${v === "N" ? "text-green-600" : v === "M" ? "text-yellow-600" : "text-red-600"}`}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ""} onChange={e => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
          <FotoSlot itemId={item.id} readOnlyFotos={readOnlyFotos} />
        </div>
      );
    }

    const radios = (key: string) => (
      <>
        <label className="text-xs"><input type="radio" checked={resps[key] === "C"} onChange={() => !isReadOnly && handleAnswer(key, "C")} disabled={isReadOnly} /> <span className="text-green-600 font-bold">C</span></label>
        <label className="text-xs"><input type="radio" checked={resps[key] === "NC"} onChange={() => !isReadOnly && handleAnswer(key, "NC")} disabled={isReadOnly} /> <span className="text-red-600 font-bold">NC</span></label>
        <label className="text-xs"><input type="radio" checked={resps[key] === "NA"} onChange={() => !isReadOnly && handleAnswer(key, "NA")} disabled={isReadOnly} /> <span className="text-zinc-500 font-bold">NA</span></label>
      </>
    );

    if (item.type === "barras" || item.type === "cinto") {
      const lados = item.type === "barras" ? ["Lateral Direita", "Lateral Esquerda", "Traseira"] : ["Motorista", "Passageiro"];
      const prefix = item.type;
      return (
        <div key={item.id} className={rowCls}>
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="flex flex-wrap gap-4">
            {lados.map(lado => {
              const key = `${prefix}_${lado.replace(" ", "_").toLowerCase()}`;
              return (
                <div key={lado} className="flex items-center gap-2">
                  <span className="text-xs w-24">{lado}:</span>
                  {radios(key)}
                </div>
              );
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ""} onChange={e => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
          <FotoSlot itemId={item.id} readOnlyFotos={readOnlyFotos} />
        </div>
      );
    }

    if (item.type === "iluminacao") {
      const luzes = ["Lado Direito Dianteiro", "Lado Esquerdo Dianteiro", "Lado Direito Traseiro", "Lado Esquerdo Traseiro"];
      return (
        <div key={item.id} className={rowCls}>
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {luzes.map(luz => {
              const key = `luz_${luz.replace(/ /g, "_").toLowerCase()}`;
              return (
                <div key={luz} className="flex justify-between items-center bg-white dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-medium">{luz}</span>
                  <div className="flex gap-2">{radios(key)}</div>
                </div>
              );
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ""} onChange={e => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="mt-2 w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
          <FotoSlot itemId={item.id} readOnlyFotos={readOnlyFotos} />
        </div>
      );
    }

    if (item.type === "multi" && item.subItems) {
      return (
        <div key={item.id} className={rowCls}>
          <span className="text-sm font-bold dark:text-zinc-200 block mb-2">{item.label}</span>
          <div className="flex flex-wrap gap-2 md:gap-4 mb-2">
            {item.subItems.map(sub => {
              const key = `${item.id}_${sub.id}`;
              return (
                <div key={sub.id} className="flex items-center gap-2 bg-white dark:bg-zinc-950 p-1 px-2 rounded border border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] uppercase font-semibold">{sub.label}:</span>
                  {radios(key)}
                </div>
              );
            })}
          </div>
          <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ""} onChange={e => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
          <FotoSlot itemId={item.id} readOnlyFotos={readOnlyFotos} />
        </div>
      );
    }

    // standard
    return (
      <div key={item.id} className="p-3 bg-zinc-50 dark:bg-zinc-900 border dark:border-zinc-800 rounded-lg col-span-full md:col-span-1 flex flex-col justify-between">
        <span className="text-sm font-medium dark:text-zinc-200 mb-2 leading-tight">{item.label}</span>
        <div className="flex items-center gap-3 mb-2">{radios(item.id)}</div>
        <input type="text" placeholder="Obs..." value={resps[`${item.id}_obs`] || ""} onChange={e => !isReadOnly && handleAnswer(`${item.id}_obs`, e.target.value)} disabled={isReadOnly} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded px-2 py-1 text-xs outline-none" />
        <FotoSlot itemId={item.id} readOnlyFotos={readOnlyFotos} />
      </div>
    );
  };

  const config: ChecklistGroup[] = getComboioConfig();

  return (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-[96rem] mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <ClipboardCheck className="text-blue-500" size={24} /> Checklist Comboio — Entrega/Recebimento
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Checklist padrão de devolução e recebimento de caminhão comboio, com evidência fotográfica por item</p>
        </div>
        {!isVisitante && (
          <button onClick={() => { resetForm(); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm">
            <Plus size={15} /> Novo Checklist
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 dark:border-zinc-800">
                {["Data", "Tipo", "Placa", "Núcleo", "Motorista", "Ações"].map(h => (
                  <th key={h} className={cn("px-3 py-3 text-[11px] font-semibold text-blue-500 uppercase tracking-wider", h === "Ações" ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900">
              {checklists.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-16 text-center text-zinc-400 text-sm">Nenhum checklist encontrado</td></tr>
              ) : checklists.map(c => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">{c.data_checklist?.split("-").reverse().join("/")}</td>
                  <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", TIPO_BADGE[c.tipo_checklist])}>{TIPO_LABEL[c.tipo_checklist]}</span></td>
                  <td className="px-3 py-2.5 font-semibold text-zinc-800 dark:text-zinc-200">{c.placa}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.nucleo || "-"}</td>
                  <td className="px-3 py-2.5 text-zinc-600 dark:text-zinc-400">{c.motorista || "-"}</td>
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
          <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 w-full max-w-5xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="sticky top-0 bg-white dark:bg-zinc-950 z-10 pb-4 mb-4 border-b dark:border-zinc-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold dark:text-white">Novo Checklist Comboio</h2>
                <p className="text-xs text-zinc-500">Preencha conforme o formulário físico — todo item aceita evidência fotográfica</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800">
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Tipo de Checklist *</label>
                  <select value={tipoChecklist} onChange={e => setTipoChecklist(e.target.value as any)} required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione...</option>
                    <option value="RECEBIMENTO">Recebimento (caminhão novo)</option>
                    <option value="DEVOLUCAO">Devolução (devolver caminhão)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Placa (Comboio) *</label>
                  <input list="placas-comboio" value={placa} onChange={e => handlePlacaChange(e.target.value)} required placeholder="ABC-1234" className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
                  <datalist id="placas-comboio">
                    {equipamentos.map((eq, i) => <option key={i} value={eq.placa}>{eq.placa} ({eq.local || eq.area})</option>)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Núcleo</label>
                  <input value={nucleo} onChange={e => setNucleo(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Data *</label>
                  <input type="date" value={dataChecklist} onChange={e => setDataChecklist(e.target.value)} required className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Mês</label>
                  <input value={mes} onChange={e => setMes(e.target.value)} placeholder="Ex: Outubro" className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Turno</label>
                  <select value={turno} onChange={e => setTurno(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione...</option>
                    <option value="1">1º Turno</option>
                    <option value="2">2º Turno</option>
                    <option value="3">3º Turno</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Marca/Modelo</label>
                  <input value={marcaModelo} onChange={e => setMarcaModelo(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Km</label>
                  <input type="number" step="0.1" value={km} onChange={e => setKm(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Motorista</label>
                  <input value={motorista} onChange={e => setMotorista(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Matrícula do Motorista</label>
                  <input value={matriculaMotorista} onChange={e => setMatriculaMotorista(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div className="space-y-8">
                {config.map(group => (
                  <div key={group.id} className="space-y-3">
                    <div className="bg-zinc-200 dark:bg-zinc-800 px-3 py-2 rounded">
                      <h3 className="text-sm font-bold dark:text-white uppercase tracking-wider">{group.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map(item => renderItem(item, null, null))}
                    </div>
                  </div>
                ))}

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800">
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-1">Pendências Adicionais</label>
                  <textarea value={pendencias} onChange={e => setPendencias(e.target.value)} rows={3} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-3 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500 resize-y" placeholder="Outras observações não cobertas pelos itens acima..." />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-xl border dark:border-zinc-800">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Executante Check-list</label>
                      <input value={executanteNome} onChange={e => setExecutanteNome(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">MT</label>
                      <input value={executanteMt} onChange={e => setExecutanteMt(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">Supervisor Manutenção</label>
                      <input value={supervisorNome} onChange={e => setSupervisorNome(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="w-24">
                      <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">MT</label>
                      <input value={supervisorMt} onChange={e => setSupervisorMt(e.target.value)} className="w-full bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg p-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-zinc-950 py-4 border-t dark:border-zinc-800 flex justify-end gap-3 z-10">
                <button type="button" onClick={() => setModalOpen(false)} className="px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-bold hover:bg-zinc-300">Cancelar</button>
                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-60">
                  {loading && <Loader2 className="animate-spin" size={18} />} Salvar Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visualizador / área de impressão (PDF) */}
      {viewChecklist && (
        <div className="fixed inset-0 z-[100] flex justify-center bg-zinc-100 dark:bg-zinc-950 overflow-y-auto">
          <div className="w-full max-w-4xl bg-white p-8 min-h-screen shadow-xl relative">
            <div className="absolute top-4 right-4 flex gap-2 flex-wrap justify-end">
              <button onClick={() => handleExportPDF(viewChecklist, "download")} disabled={!!exportandoPdf} className="px-4 py-2 bg-blue-600 text-white rounded font-bold text-sm shadow hover:bg-blue-700 flex items-center gap-2 disabled:opacity-60">
                <Download size={16} /> {exportandoPdf === "download" ? "Gerando..." : "Baixar PDF"}
              </button>
              <button onClick={() => handleExportPDF(viewChecklist, "share")} disabled={!!exportandoPdf} className="px-4 py-2 bg-emerald-600 text-white rounded font-bold text-sm shadow hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-60">
                <Share2 size={16} /> {exportandoPdf === "share" ? "Gerando..." : "Enviar WhatsApp"}
              </button>
              <button onClick={() => setViewChecklist(null)} className="p-2 bg-zinc-200 text-zinc-600 rounded hover:bg-zinc-300 shadow"><X size={20} /></button>
            </div>

            <div id="ficha-checklist-comboio-print">
              <div className="border-b-2 border-zinc-900 pb-4 mb-6">
                <h1 className="text-2xl font-black text-center uppercase tracking-widest text-zinc-900">
                  Checklist Comboio — {TIPO_LABEL[viewChecklist.tipo_checklist]}
                </h1>
                <p className="text-center text-xs text-zinc-500 mt-1">EUNAMAN — ENTREGA/RECEBIMENTO</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 p-4 border rounded bg-zinc-50 border-zinc-300 text-zinc-800 text-xs">
                <div><span className="font-bold">Placa:</span> {viewChecklist.placa}</div>
                <div><span className="font-bold">Núcleo:</span> {viewChecklist.nucleo || "-"}</div>
                <div><span className="font-bold">Data:</span> {viewChecklist.data_checklist?.split("-").reverse().join("/")}</div>
                <div><span className="font-bold">Mês:</span> {viewChecklist.mes || "-"}</div>
                <div><span className="font-bold">Turno:</span> {viewChecklist.turno || "-"}</div>
                <div><span className="font-bold">Marca/Modelo:</span> {viewChecklist.marca_modelo || "-"}</div>
                <div><span className="font-bold">Motorista:</span> {viewChecklist.motorista || "-"}</div>
                <div><span className="font-bold">Matrícula:</span> {viewChecklist.matricula_motorista || "-"}</div>
                <div><span className="font-bold">Km:</span> {viewChecklist.km ?? "-"}</div>
              </div>

              <div className="space-y-6 text-zinc-800">
                {config.map(group => (
                  <div key={group.id} className="space-y-2">
                    <h3 className="font-bold bg-zinc-200 p-1 px-2 border-l-4 border-zinc-500 uppercase text-xs">{group.title}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map(item => renderItem(item, viewChecklist.respostas || {}, viewChecklist.fotos || {}))}
                    </div>
                  </div>
                ))}

                {viewChecklist.pendencias_adicionais && (
                  <div className="mt-8">
                    <h3 className="font-bold bg-zinc-200 p-1 px-2 border-l-4 border-zinc-500 uppercase text-xs mb-2">Pendências Adicionais</h3>
                    <div className="border border-zinc-300 p-3 whitespace-pre-wrap text-sm">{viewChecklist.pendencias_adicionais}</div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-10 pt-4 border-t border-zinc-300 text-xs">
                  <div><span className="font-bold">Executante Check-list:</span> {viewChecklist.executante_nome || "-"} {viewChecklist.executante_mt ? `(MT: ${viewChecklist.executante_mt})` : ""}</div>
                  <div><span className="font-bold">Supervisor Manutenção:</span> {viewChecklist.supervisor_nome || "-"} {viewChecklist.supervisor_mt ? `(MT: ${viewChecklist.supervisor_mt})` : ""}</div>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-zinc-400 border-t pt-3">
                Documento gerado automaticamente pelo EUNAMAN Sistema.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox de foto */}
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
