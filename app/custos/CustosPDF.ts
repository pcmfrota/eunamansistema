import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";
import { CustoManutencao } from "./actions";
import { formatarMoeda, formatarDataCusto, STATUS_LABEL } from "./CustosClient";

type KPIs = { totalGeral: number; totalPago: number; totalAgPagamento: number; totalFaturado: number; custoMedioPorPlaca: number };

// Monta o HTML do relatório (cabeçalho + KPIs + tabela + totais + linhas de assinatura),
// reaproveitado tanto pelo PDF (html2canvas+jsPDF) quanto pela impressão direta (nova janela).
function montarHtmlRelatorio(dados: CustoManutencao[], kpis: KPIs): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const ordenados = [...dados].sort((a, b) => a.data.localeCompare(b.data));
  const periodo = ordenados.length
    ? `${formatarDataCusto(ordenados[0].data)} a ${formatarDataCusto(ordenados[ordenados.length - 1].data)}`
    : "-";

  const linhas = dados.map((c) => {
    const total = Number(c.pecas) + Number(c.mao_obra);
    return `
      <tr>
        <td>${formatarDataCusto(c.data)}</td>
        <td><b>${c.placa}</b></td>
        <td>${c.tipo_manutencao}</td>
        <td>${c.descricao}</td>
        <td>${c.fornecedor || "-"}</td>
        <td style="text-align:right;">${formatarMoeda(Number(c.pecas))}</td>
        <td style="text-align:right;">${formatarMoeda(Number(c.mao_obra))}</td>
        <td style="text-align:right; font-weight:bold;">${formatarMoeda(total)}</td>
        <td>${STATUS_LABEL[c.status]}</td>
        <td>${c.observacoes || "-"}</td>
      </tr>
    `;
  }).join("");

  const somaPecas = dados.reduce((s, c) => s + Number(c.pecas), 0);
  const somaMaoObra = dados.reduce((s, c) => s + Number(c.mao_obra), 0);

  const assinaturas = [{ label: "Responsável (Gestor)" }, { label: "Financeiro" }];

  return `
    <div style="border: 2px solid #000; padding: 12px; font-size: 11px; font-family: Arial, sans-serif; color:#000; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
        <div style="background-color:#005a2b; color:#fff; padding:6px 12px; font-weight:bold; border-radius:4px; font-size:16px; letter-spacing:1px;">EUNAMAN</div>
        <div style="text-align:center; flex:1;">
          <h2 style="margin:0; font-size:16px; text-transform:uppercase; letter-spacing:1px; font-weight:900;">Relatório Financeiro de Manutenção</h2>
          <span style="font-size:9px; color:#555;">Período: ${periodo} — ${dados.length} lançamento(s)</span>
        </div>
        <div style="font-size:9px; font-weight:bold; text-align:right;">Gerado em:<br/>${hoje}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:9px;" border="1" cellpadding="5">
        <tr style="background-color:#f0f0f0;">
          <td style="font-weight:bold;">TOTAL GERAL: <span style="font-weight:normal;">${formatarMoeda(kpis.totalGeral)}</span></td>
          <td style="font-weight:bold;">PAGO: <span style="font-weight:normal;">${formatarMoeda(kpis.totalPago)}</span></td>
          <td style="font-weight:bold;">AG. PAGAMENTO: <span style="font-weight:normal;">${formatarMoeda(kpis.totalAgPagamento)}</span></td>
          <td style="font-weight:bold;">FATURADO: <span style="font-weight:normal;">${formatarMoeda(kpis.totalFaturado)}</span></td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:9px;" border="1" cellpadding="5">
        <thead style="background-color:#e0e0e0; font-weight:bold;">
          <tr>
            <th>DATA</th><th>PLACA</th><th>TIPO</th><th>DESCRIÇÃO</th><th>FORNECEDOR</th>
            <th>PEÇAS (R$)</th><th>MÃO DE OBRA (R$)</th><th>TOTAL (R$)</th><th>STATUS</th><th>OBS. / PC</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
        <tfoot>
          <tr style="background-color:#f0f0f0; font-weight:bold;">
            <td colspan="5" style="text-align:right;">TOTAIS:</td>
            <td style="text-align:right;">${formatarMoeda(somaPecas)}</td>
            <td style="text-align:right;">${formatarMoeda(somaMaoObra)}</td>
            <td style="text-align:right;">${formatarMoeda(somaPecas + somaMaoObra)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>

      <div style="display:flex; justify-content:space-around; margin-top:30px; padding-top:12px;">
        ${assinaturas.map((a) => `
          <div style="text-align:center; width:40%;">
            <div style="height:40px; border-bottom:1px solid #000;"></div>
            <div style="font-weight:bold; font-size:10px; margin-top:4px;">${a.label}</div>
            <div style="font-size:8px; color:#666;">Assinatura</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export async function gerarPDFCustos(dados: CustoManutencao[], kpis: KPIs, modo: "download" | "share" = "download") {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "1000px";
  container.style.backgroundColor = "#ffffff";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";
  container.innerHTML = montarHtmlRelatorio(dados, kpis);

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
    await salvarOuCompartilharBlob(
      blob,
      `Relatorio_Financeiro_Manutencao_${new Date().toISOString().slice(0, 10)}.pdf`,
      "Relatório Financeiro de Manutenção",
      "Relatório de custos de manutenção da frota",
      modo
    );
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    throw err;
  }
}

// PDF "de apresentação": tira um retrato do dashboard como ele está na tela (KPIs + gráficos
// coloridos), em vez de reconstruir uma tabela. Clona o elemento #custos-dashboard-capture
// (já renderizado pelo Recharts) pra fora da tela, com um cabeçalho na frente, e fotografa
// tudo de uma vez com html2canvas — assim os gráficos saem exatamente como o usuário está vendo.
export async function gerarPDFApresentacaoCustos(periodo: string) {
  const original = document.getElementById("custos-dashboard-capture");
  if (!original) throw new Error("Não foi possível localizar o dashboard na tela. Abra a aba Visão Geral ou Detalhamento Financeiro.");

  const hoje = new Date().toLocaleDateString("pt-BR");

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = `${original.offsetWidth}px`;
  container.style.backgroundColor = "#ffffff";
  container.style.padding = "16px";
  container.style.boxSizing = "border-box";
  container.style.fontFamily = "Arial, sans-serif";

  const header = document.createElement("div");
  header.style.cssText = "display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:16px;";
  header.innerHTML = `
    <div style="background-color:#005a2b; color:#fff; padding:8px 14px; font-weight:bold; border-radius:4px; font-size:18px; letter-spacing:1px;">EUNAMAN</div>
    <div style="text-align:center; flex:1;">
      <h2 style="margin:0; font-size:18px; text-transform:uppercase; letter-spacing:1px; font-weight:900; color:#000;">Apresentação — Controle Financeiro de Manutenção</h2>
      <span style="font-size:11px; color:#555;">Período: ${periodo}</span>
    </div>
    <div style="font-size:10px; font-weight:bold; text-align:right; color:#000;">Gerado em:<br/>${hoje}</div>
  `;

  const clone = original.cloneNode(true) as HTMLElement;
  clone.style.backgroundColor = "#ffffff";
  container.appendChild(header);
  container.appendChild(clone);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff" });
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
    await salvarOuCompartilharBlob(
      blob,
      `Apresentacao_Custos_${new Date().toISOString().slice(0, 10)}.pdf`,
      "Apresentação — Controle de Custos",
      "Dashboard visual de custos de manutenção da frota",
      "download"
    );
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    throw err;
  }
}

// Impressão direta — abre o mesmo relatório numa aba nova (só o conteúdo do relatório, sem o
// resto do app) e aciona window.print(). Mais simples e robusto que isolar via @media print
// numa camada por cima da página atual.
export function imprimirRelatorioCustos(dados: CustoManutencao[], kpis: KPIs) {
  const janela = window.open("", "_blank");
  if (!janela) {
    alert("Não foi possível abrir a janela de impressão. Verifique se o bloqueador de pop-ups está desativado.");
    return;
  }
  janela.document.write(`
    <html>
      <head>
        <title>Relatório Financeiro de Manutenção</title>
        <style>
          body { margin: 0; padding: 20px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>${montarHtmlRelatorio(dados, kpis)}</body>
    </html>
  `);
  janela.document.close();
  janela.onload = () => {
    janela.focus();
    janela.print();
  };
}
