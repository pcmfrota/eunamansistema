"use client";

import React, { useState, useEffect } from "react";
import { Edit2, Save, X, Calendar as CalendarIcon, ShieldAlert, FileSpreadsheet, Download } from "lucide-react";
import { saveCalendario, limparDuplicatasCalendario } from "./actions";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";

import { useAuth } from "@/components/auth-context";
import { useOffline } from "@/components/offline-provider";
import { localDb } from "@/lib/offline-db";

function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) return resolve((window as any).XLSX);
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Falha ao carregar biblioteca de exportação."));
    document.head.appendChild(script);
  });
}

const MESES_NOME = [
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function CalendarioClient({ initialData }: { initialData: any[] }) {
  const { profile } = useAuth();
  const { isOnline } = useOffline();
  const isVisitante = profile?.role === "visitante";

  const [data, setData] = useState(initialData);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  async function handleExportExcel() {
    setIsExporting(true);
    try {
      const XLSX = await loadXLSX();
      const rows = data.map((item) => ({
        "Mês": MESES_NOME[item.mes] || item.mes,
        "Ano": item.ano,
        "Data Inicial": new Date(item.data_inicio + "T12:00:00").toLocaleDateString("pt-BR"),
        "Data Final": new Date(item.data_fim + "T12:00:00").toLocaleDateString("pt-BR"),
        "Qtd. Dias": item.total_dias,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Calendário Suzano");
      XLSX.writeFile(wb, "Calendario_Suzano.xlsx");
    } catch (error: any) {
      alert(error?.message || "Erro ao exportar Excel!");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportPDF() {
    setIsGeneratingPdf(true);
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.top = "-9999px";
    container.style.width = "700px";
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#000000";
    container.style.fontFamily = "Arial, sans-serif";
    container.style.padding = "20px";
    container.style.boxSizing = "border-box";

    container.innerHTML = `
      <div style="border: 2px solid #000; padding: 12px; font-size: 11px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
          <div style="background-color:#005a2b; color:#fff; padding:6px 12px; font-weight:bold; border-radius:4px; font-size:16px; letter-spacing:1px;">EUNAMAN</div>
          <h2 style="margin:0; font-size:16px; text-transform:uppercase; letter-spacing:1px; font-weight:900;">Calendário Operacional Suzano</h2>
          <div style="font-size:9px; font-weight:bold; text-align:right;">Gerado em:<br/>${new Date().toLocaleDateString("pt-BR")}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:10px;" border="1" cellpadding="6">
          <thead style="background-color:#e0e0e0; font-weight:bold;">
            <tr>
              <th>MÊS</th><th>ANO</th><th>DATA INICIAL</th><th>DATA FINAL</th><th>QTD. DIAS</th>
            </tr>
          </thead>
          <tbody>
            ${data.map((item) => `
              <tr>
                <td style="text-align:center; font-weight:bold;">${MESES_NOME[item.mes] || item.mes}</td>
                <td style="text-align:center;">${item.ano}</td>
                <td style="text-align:center;">${new Date(item.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                <td style="text-align:center;">${new Date(item.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}</td>
                <td style="text-align:center;">${item.total_dias} dias</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;

    document.body.appendChild(container);

    try {
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

      const blob: Blob = pdf.output("blob");
      await salvarOuCompartilharBlob(
        blob,
        "Calendario_Suzano.pdf",
        "Calendário Suzano",
        "Calendário operacional Suzano",
        "download"
      );
    } catch (error: any) {
      if (document.body.contains(container)) document.body.removeChild(container);
      alert(error?.message || "Erro ao gerar PDF!");
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  async function handleLimparDuplicatas() {
    if (!confirm("Isso irá remover todas as duplicatas do calendário, mantendo apenas 1 registro por mês. Continuar?")) return;
    setIsCleaning(true);
    try {
      await limparDuplicatasCalendario();
      window.location.reload();
    } catch (error: any) {
      alert(error?.message || "Erro ao limpar duplicatas!");
    } finally {
      setIsCleaning(false);
    }
  }

  async function handleSave() {
    if (!editForm) return;
    try {
      if (isOnline) {
        await saveCalendario(editForm);
        await localDb.put("calendario_suzano", editForm);
        setEditingId(null);
        window.dispatchEvent(new CustomEvent("offline-db-updated-calendario_suzano"));
      } else {
        const updated = { ...editForm, _isPendingSync: true };
        await localDb.put("calendario_suzano", updated);
        await localDb.addToQueue("calendario", "save_calendario", editForm);
        window.dispatchEvent(new CustomEvent("offline-db-updated-sync_queue"));
        window.dispatchEvent(new CustomEvent("offline-db-updated-calendario_suzano"));
        setEditingId(null);
        alert("✅ Calendário alterado localmente! Será sincronizado assim que a conexão voltar.");
      }
    } catch (error) {
      alert("Erro ao salvar!");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end gap-2">
        {isVisitante ? (
          <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm">
            <ShieldAlert size={16} />
            <span>Somente Leitura</span>
          </div>
        ) : (
          <>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              <FileSpreadsheet size={14} />
              {isExporting ? "Exportando..." : "Exportar Calendário"}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isGeneratingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              <Download size={14} />
              {isGeneratingPdf ? "Gerando..." : "Baixar PDF"}
            </button>
            <button
              onClick={handleLimparDuplicatas}
              disabled={isCleaning}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20 disabled:opacity-50"
            >
              {isCleaning ? "Limpando..." : "🧹 Limpar Duplicatas"}
            </button>
          </>
        )}
      </div>

      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Mês/Ano</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Data Inicial</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Data Final</th>
              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500">Qtd. Dias</th>
              {!isVisitante && <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-zinc-500 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.map((item) => (
              <tr key={item.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-500/10 rounded-lg text-blue-600">
                      <CalendarIcon size={16} />
                    </div>
                    <div>
                      <div className="font-bold dark:text-white flex items-center gap-2">
                        {MESES_NOME[item.mes] || item.mes}
                        {item._isPendingSync && (
                          <span className="text-[10px] text-amber-500 font-bold animate-pulse">(Offline)</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">{item.ano}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  {editingId === item.id ? (
                    <input
                      type="date"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white"
                      value={editForm.data_inicio}
                      onChange={(e) => setEditForm({ ...editForm, data_inicio: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm dark:text-zinc-300">
                      {new Date(item.data_inicio + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                   {editingId === item.id ? (
                    <input
                      type="date"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white"
                      value={editForm.data_fim}
                      onChange={(e) => setEditForm({ ...editForm, data_fim: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm dark:text-zinc-300">
                      {new Date(item.data_fim + "T12:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                   {editingId === item.id ? (
                    <input
                      type="number"
                      className="bg-zinc-100 dark:bg-zinc-900 border-none rounded px-2 py-1 text-sm text-white w-20"
                      value={editForm.total_dias}
                      onChange={(e) => setEditForm({ ...editForm, total_dias: e.target.value })}
                    />
                  ) : (
                    <span className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded font-mono text-xs dark:text-zinc-400">
                     {item.total_dias} dias
                    </span>
                  )}
                </td>
                {!isVisitante && (
                  <td className="px-6 py-4 text-right">
                    {editingId === item.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={handleSave} className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                          <Save size={18} />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-2 text-zinc-500 hover:bg-zinc-500/10 rounded-lg">
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(item.id);
                          setEditForm({ ...item });
                        }}
                        className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                  Nenhuma data cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
