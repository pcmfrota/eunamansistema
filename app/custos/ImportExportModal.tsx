"use client";

import { useRef, useState } from "react";
import { X, UploadCloud, Download, FileText, Printer, Loader2 } from "lucide-react";
import { importarCustos, CustoManutencao } from "./actions";
import { gerarPDFCustos, imprimirRelatorioCustos } from "./CustosPDF";

function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) return resolve((window as any).XLSX);
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js";
    script.onload = () => resolve((window as any).XLSX);
    script.onerror = () => reject(new Error("Falha ao carregar biblioteca de planilhas."));
    document.head.appendChild(script);
  });
}

function normalizeKey(v: any): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Planilhas costumam ter uma linha de título (ex: "CONTROLE DE CUSTOS DE MANUTENÇÃO") antes
// da linha de cabeçalho de verdade — se a gente sempre tratar a linha 1 como cabeçalho
// (comportamento padrão do XLSX.utils.sheet_to_json), essa linha de título vira o "cabeçalho"
// e nenhuma coluna real (Data, Placa...) é reconhecida. Por isso procura, nas primeiras linhas,
// a que efetivamente parece um cabeçalho (tem "data" E "placa" reconhecíveis) antes de ler.
// Retorna -1 quando a aba não tem uma linha de cabeçalho reconhecível (ex: aba "Resumo" com
// tabela dinâmica/gráfico), pra essa aba poder ser pulada em vez de forçada como se fosse dado.
function encontrarLinhaCabecalho(matrix: any[][]): number {
  const limite = Math.min(matrix.length, 10);
  for (let i = 0; i < limite; i++) {
    const chaves = (matrix[i] || []).map(normalizeKey);
    const temData = chaves.some((k) => k.includes("data"));
    const temPlaca = chaves.some((k) => k.includes("placa") || k.includes("veiculo"));
    if (temData && temPlaca) return i;
  }
  return -1;
}

type KPIs = { totalGeral: number; totalPago: number; totalAgPagamento: number; totalFaturado: number; custoMedioPorPlaca: number };

export default function ImportExportModal({
  isOpen,
  onClose,
  filteredData,
  kpis,
}: {
  isOpen: boolean;
  onClose: () => void;
  filteredData: CustoManutencao[];
  kpis: KPIs;
}) {
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [fileName, setFileName] = useState("");
  const [abasLidas, setAbasLidas] = useState<string[]>([]);
  const [abasIgnoradas, setAbasIgnoradas] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Lê TODAS as abas do arquivo (ex: "Agosto", "Setembro"...) e junta os lançamentos de cada
  // uma — planilhas de controle mensal costumam ter uma aba por mês. Abas sem colunas Data/Placa
  // reconhecíveis (ex: uma aba "Resumo" com tabela dinâmica) são puladas, não travam a importação.
  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setFileName(file.name);
    try {
      const XLSX = await loadXLSX();
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array" });

      let todasAsLinhas: any[] = [];
      const lidas: string[] = [];
      const ignoradas: string[] = [];

      for (const nomeAba of workbook.SheetNames) {
        const sheet = workbook.Sheets[nomeAba];
        const matrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const linhaCabecalho = encontrarLinhaCabecalho(matrix);

        if (linhaCabecalho === -1) {
          ignoradas.push(nomeAba);
          continue;
        }

        const linhas = XLSX.utils.sheet_to_json(sheet, { range: linhaCabecalho });
        if (linhas.length === 0) {
          ignoradas.push(nomeAba);
          continue;
        }

        todasAsLinhas = todasAsLinhas.concat(linhas);
        lidas.push(nomeAba);
      }

      if (todasAsLinhas.length === 0) {
        alert("Não foi possível identificar as colunas Data e Placa em nenhuma aba da planilha.");
        return;
      }

      setPreviewRows(todasAsLinhas);
      setAbasLidas(lidas);
      setAbasIgnoradas(ignoradas);
    } catch (err: any) {
      alert("Erro ao ler o arquivo: " + (err.message || String(err)));
    }
  }

  async function confirmarImportacao() {
    if (previewRows.length === 0) return;
    setIsImporting(true);
    try {
      const result = await importarCustos(previewRows);
      if (result?.error) throw new Error(result.error);
      alert(`Importação concluída! ${result.count} lançamento(s) inserido(s).`);
      const { syncTables } = await import("@/lib/offline-sync");
      await syncTables(["custos_manutencao"]);
      window.dispatchEvent(new CustomEvent("offline-db-updated-custos_manutencao"));
      setPreviewRows([]);
      setFileName("");
      setAbasLidas([]);
      setAbasIgnoradas([]);
      onClose();
    } catch (err: any) {
      alert("Erro na importação: " + (err.message || String(err)));
    } finally {
      setIsImporting(false);
    }
  }

  function linhasExportacao() {
    return filteredData.map((c) => ({
      Data: c.data,
      Placa: c.placa,
      "Tipo de Manutenção": c.tipo_manutencao,
      Descrição: c.descricao,
      Fornecedor: c.fornecedor || "",
      "Peças (R$)": c.pecas,
      "Mão de Obra (R$)": c.mao_obra,
      "Total (R$)": Number(c.pecas) + Number(c.mao_obra),
      Status: c.status,
      "Observações / PC": c.observacoes || "",
    }));
  }

  async function handleExportPlanilha(formato: "csv" | "xlsx") {
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(linhasExportacao());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Custos");
    XLSX.writeFile(wb, `controle_custos_manutencao.${formato}`);
  }

  async function handleExportPdf() {
    setIsExportingPdf(true);
    try {
      await gerarPDFCustos(filteredData, kpis, "download");
    } catch (err: any) {
      alert("Erro ao gerar PDF: " + (err.message || String(err)));
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">Importação e Exportação</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          <div>
            <h3 className="text-sm font-bold uppercase text-zinc-500 mb-3">Importação (Excel/CSV)</h3>
            <input type="file" ref={fileRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
            >
              <UploadCloud size={28} className="text-zinc-400" />
              <p className="text-sm text-zinc-500 text-center">{fileName || "Clique para selecionar um arquivo Excel ou CSV"}</p>
              <p className="text-[11px] text-zinc-400 text-center">
                Reconhece automaticamente as colunas Data, Placa, Tipo, Descrição, Fornecedor, Peças, Mão de Obra, Status e Observações/PC
              </p>
            </div>

            {previewRows.length > 0 && (
              <div className="mt-4">
                {abasLidas.length > 0 && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mb-1">
                    ✓ Abas lidas: {abasLidas.join(", ")}
                  </p>
                )}
                {abasIgnoradas.length > 0 && (
                  <p className="text-[11px] text-zinc-400 mb-1">
                    Abas ignoradas (sem Data/Placa): {abasIgnoradas.join(", ")}
                  </p>
                )}
                <p className="text-xs font-semibold text-zinc-500 mb-2">Pré-visualização ({previewRows.length} linha(s) encontrada(s)):</p>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-auto max-h-40 text-[11px]">
                  <table className="w-full">
                    <thead className="bg-zinc-100 dark:bg-zinc-800">
                      <tr>
                        {Object.keys(previewRows[0]).slice(0, 5).map((k) => (
                          <th key={k} className="px-2 py-1 text-left font-semibold whitespace-nowrap">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                          {Object.keys(previewRows[0]).slice(0, 5).map((k) => (
                            <td key={k} className="px-2 py-1 whitespace-nowrap">{String(row[k] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={confirmarImportacao}
                  disabled={isImporting}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                >
                  {isImporting && <Loader2 size={16} className="animate-spin" />}
                  {isImporting ? "Importando..." : `Confirmar Importação (${previewRows.length})`}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold uppercase text-zinc-500 mb-1">Exportação e Relatório</h3>
            <p className="text-xs text-zinc-500 -mt-2 mb-2">Usa os {filteredData.length} lançamento(s) filtrado(s) na tela.</p>
            <button onClick={() => handleExportPlanilha("csv")} className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <Download size={16} /> Exportar CSV
            </button>
            <button onClick={() => handleExportPlanilha("xlsx")} className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <Download size={16} /> Exportar Excel
            </button>
            <button
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold disabled:opacity-50"
            >
              {isExportingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {isExportingPdf ? "Gerando..." : "Exportar Relatório em PDF"}
            </button>
            <button
              onClick={() => imprimirRelatorioCustos(filteredData, kpis)}
              className="flex items-center gap-2 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <Printer size={16} /> Imprimir Diretamente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
