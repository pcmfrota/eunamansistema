import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";
import { calcularDias, formatarData, GRUPOS_DOC } from "./DocumentosClient";

type LinhaConsolidada = { placa: string; local?: string; co?: string; porGrupo: Record<string, any> };

const ABA_LABEL: Record<string, string> = {
  tacografo: "Tacógrafo",
  civ_cipp: "CIV/CIPP",
  laudo_eletromecanico: "Laudo Eletromecânico",
  laudo_implemento: "Laudo Implemento",
  crlve_pesados: "CRLVE Pesados",
  crlve_leve: "CRLVE Leve",
};

// Mesma lógica de cor do badge de status na tela (vencido/próximo/em dias), só que como
// HTML inline — o badge em JSX não serve pro relatório montado fora do React (html2canvas).
function statusHtml(dias: number | null): string {
  if (dias === null) {
    return `<span style="display:inline-block; padding:2px 6px; border-radius:3px; background:#e4e4e7; color:#52525b; font-weight:bold;">-</span>`;
  }
  if (dias <= 0) {
    return `<span style="display:inline-block; padding:2px 6px; border-radius:3px; background:#dc2626; color:#fff; font-weight:bold;">${dias}</span>`;
  }
  if (dias <= 30) {
    return `<span style="display:inline-block; padding:2px 6px; border-radius:3px; background:#facc15; color:#000; font-weight:bold;">${dias}</span>`;
  }
  return `<span style="display:inline-block; padding:2px 6px; border-radius:3px; background:#2563eb; color:#fff; font-weight:bold;">${dias}</span>`;
}

function montarCabecalho(titulo: string, subtitulo: string): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
      <div style="background-color:#005a2b; color:#fff; padding:6px 12px; font-weight:bold; border-radius:4px; font-size:16px; letter-spacing:1px;">EUNAMAN</div>
      <div style="text-align:center; flex:1;">
        <h2 style="margin:0; font-size:15px; text-transform:uppercase; letter-spacing:1px; font-weight:900;">${titulo}</h2>
        <span style="font-size:9px; color:#555;">${subtitulo}</span>
      </div>
      <div style="font-size:9px; font-weight:bold; text-align:right;">Gerado em:<br/>${hoje}</div>
    </div>
  `;
}

// Monta a tabela larga da Visão Geral (uma linha por placa, grupos de documentos lado a lado) —
// mesma estrutura de colunas mostrada na tela (GRUPOS_DOC), só que linearizada em HTML puro.
function montarHtmlVisaoGeral(linhas: LinhaConsolidada[]): string {
  const theadGrupos = GRUPOS_DOC.map(g =>
    `<th colspan="${g.temPeriodo || g.temAno ? 3 : 2}" style="background:#d4d4d8;">${g.curto}</th>`
  ).join("");

  const theadSub = GRUPOS_DOC.map(g => `
    ${g.temPeriodo ? "<th>Período</th>" : g.temAno ? "<th>Ano</th>" : ""}
    <th>Venc.</th><th>Status</th>
  `).join("");

  const linhasHtml = linhas.map(linha => {
    const celulas = GRUPOS_DOC.map(g => {
      const item = linha.porGrupo[g.key];
      if (!item) {
        return `${g.temPeriodo || g.temAno ? "<td style=\"text-align:center;\">-</td>" : ""}<td style="text-align:center;">-</td><td style="text-align:center;">-</td>`;
      }
      const isDateNull = !item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "";
      const dias = isDateNull ? null : calcularDias(item.data_vencimento);
      return `
        ${g.temPeriodo ? `<td style="text-align:center;">${item.periodo || "-"}</td>` : g.temAno ? `<td style="text-align:center;">${item.ano || "-"}</td>` : ""}
        <td style="text-align:center;">${formatarData(item.data_vencimento)}</td>
        <td style="text-align:center;">${statusHtml(dias)}</td>
      `;
    }).join("");
    return `
      <tr>
        <td><b>${linha.placa}</b></td>
        <td style="text-transform:uppercase;">${linha.local || "-"}</td>
        <td style="text-transform:uppercase;">${linha.co || "-"}</td>
        ${celulas}
      </tr>
    `;
  }).join("");

  return `
    <div style="border:2px solid #000; padding:12px; font-size:10px; font-family: Arial, sans-serif; color:#000; background:#fff;">
      ${montarCabecalho("Documentos da Frota — Visão Geral", `${linhas.length} veículo(s)`)}
      <table style="width:100%; border-collapse:collapse; font-size:8px;" border="1" cellpadding="4">
        <thead style="background-color:#e4e4e7; font-weight:bold;">
          <tr>
            <th rowspan="2">Placa</th><th rowspan="2">Módulo</th><th rowspan="2">C.O</th>
            ${theadGrupos}
          </tr>
          <tr>${theadSub}</tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </div>
  `;
}

// Monta a tabela de uma única aba (Tacógrafo, CIV/CIPP, Laudos, CRLVE) — mesmas colunas do
// Excel exportado pra essa aba.
function montarHtmlAba(data: any[], activeTab: string): string {
  const isLaudo = activeTab === "laudo_eletromecanico" || activeTab === "laudo_implemento";
  const isCrlve = activeTab === "crlve_pesados" || activeTab === "crlve_leve";
  const labelVenc = activeTab === "tacografo" ? "Tacógrafo (Venc)" : activeTab === "civ_cipp" ? "CIV e CIPP (Venc)" : "Data Vencimento";
  const label = ABA_LABEL[activeTab] || activeTab;

  const linhasHtml = data.map(item => {
    const isDateNull = !item.data_vencimento || item.data_vencimento === "-" || item.data_vencimento === "";
    const dias = isDateNull ? null : calcularDias(item.data_vencimento);
    return `
      <tr>
        <td style="text-transform:uppercase;">${item.local || "-"}</td>
        <td style="text-transform:uppercase;">${item.co || "-"}</td>
        <td><b>${item.placa || "-"}</b></td>
        ${isCrlve ? `<td style="text-align:center;">${item.ano || "-"}</td>` : ""}
        ${isLaudo ? `<td style="text-align:center;">${item.periodo || "-"}</td><td style="text-align:center;">${formatarData(item.data_expedicao)}</td>` : ""}
        <td style="text-align:center;">${formatarData(item.data_vencimento)}</td>
        <td style="text-align:center;">${statusHtml(dias)}</td>
        ${isLaudo || isCrlve ? `<td>${item.observacoes || "-"}</td>` : ""}
      </tr>
    `;
  }).join("");

  return `
    <div style="border:2px solid #000; padding:12px; font-size:11px; font-family: Arial, sans-serif; color:#000; background:#fff;">
      ${montarCabecalho(`Documentos da Frota — ${label}`, `${data.length} registro(s)`)}
      <table style="width:100%; border-collapse:collapse; font-size:9px;" border="1" cellpadding="5">
        <thead style="background-color:#e0e0e0; font-weight:bold;">
          <tr>
            <th>Local</th><th>C.O</th><th>Placa</th>
            ${isCrlve ? "<th>Ano</th>" : ""}
            ${isLaudo ? "<th>Período</th><th>Data Expedição</th>" : ""}
            <th>${labelVenc}</th><th>Status</th>
            ${isLaudo || isCrlve ? "<th>Observações</th>" : ""}
          </tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
      </table>
    </div>
  `;
}

async function renderizarEBaixar(html: string, largura: number, nomeArquivo: string, tituloShare: string, descricaoShare: string, modo: "download" | "share") {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${largura}px`;
  container.style.backgroundColor = "#ffffff";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";
  container.innerHTML = html;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("l", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;
    }

    const blob: Blob = pdf.output("blob");
    await salvarOuCompartilharBlob(blob, nomeArquivo, tituloShare, descricaoShare, modo);
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    throw err;
  }
}

export async function gerarPDFDocumentosVisaoGeral(linhas: LinhaConsolidada[], modo: "download" | "share" = "download") {
  const html = montarHtmlVisaoGeral(linhas);
  await renderizarEBaixar(
    html,
    1600,
    `Documentos_Visao_Geral_${new Date().toISOString().slice(0, 10)}.pdf`,
    "Documentos da Frota — Visão Geral",
    "Relatório consolidado de documentos da frota",
    modo
  );
}

export async function gerarPDFDocumentosAba(data: any[], activeTab: string, modo: "download" | "share" = "download") {
  const label = ABA_LABEL[activeTab] || activeTab;
  const html = montarHtmlAba(data, activeTab);
  await renderizarEBaixar(
    html,
    1100,
    `Documentos_${label.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`,
    `Documentos — ${label}`,
    `Relatório de ${label} da frota`,
    modo
  );
}
