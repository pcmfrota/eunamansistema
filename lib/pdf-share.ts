// Compartilhado por todo módulo que gera uma ficha em PDF a partir de um elemento HTML (via
// html2canvas + jsPDF, importados como dependência normal do bundle, sem depender de CDN em
// runtime) OU já com um Blob pronto (ex: jsPDF direto, como o módulo de Lubrificação usa) —
// extrai o padrão de "baixar" e "baixar e compartilhar o arquivo de verdade" que só existia
// no Controle de OS, pra ficar disponível em qualquer ficha do sistema, inclusive offline/no
// app Android.
//
// Sempre salva o arquivo primeiro (download no navegador, ou pela ponte nativa do app) antes
// de tentar abrir o menu de compartilhamento do sistema — nunca compartilha sem ter salvo.

import jsPDF from "jspdf";
import html2canvas from "html2canvas";

type PdfOpt = {
  margin?: number[];
  image?: { type: string; quality: number };
  html2canvas?: any;
  jsPDF?: any;
};

const DEFAULT_OPT: PdfOpt = {
  margin: [5, 5, 5, 5],
  image: { type: "jpeg", quality: 0.92 },
  html2canvas: { scale: 1.5, useCORS: true, logging: false },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
};

function isAndroidApp() {
  return (
    typeof window !== "undefined" &&
    !!(window as any).EunamanApp &&
    typeof (window as any).EunamanApp.saveBase64File === "function"
  );
}

function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function tentarCompartilhar(blob: Blob, filename: string, shareTitle: string, shareText: string) {
  const file = new File([blob], filename, { type: "application/pdf" });
  const nav = navigator as any;
  if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: shareTitle, text: shareText });
    } catch (shareErr) {
      // Cancelado pelo usuário ou falha silenciosa — não é um erro que precise de alerta.
      console.log("Compartilhamento cancelado ou falhou:", shareErr);
    }
  } else {
    alert("Compartilhamento de arquivo não é suportado neste navegador. O PDF foi salvo — envie manualmente pelo WhatsApp.");
  }
}

/**
 * Salva (download no navegador, ou ponte nativa no app Android) e, se `modo === 'share'`,
 * também tenta abrir o menu de compartilhamento do sistema (WhatsApp etc.) com o PDF já
 * pronto (Blob) anexado. Use isso diretamente quando o PDF já foi gerado por outro meio
 * (ex: jsPDF puro, como em app/lubrificacao/components/LubrificacaoPDF.ts).
 */
export async function salvarOuCompartilharBlob(
  blob: Blob,
  filename: string,
  shareTitle: string,
  shareText: string,
  modo: "download" | "share"
): Promise<void> {
  if (isAndroidApp()) {
    try {
      const base64 = await blobParaBase64(blob);
      (window as any).EunamanApp.saveBase64File(base64, filename, "application/pdf");
      if (modo === "share") {
        await tentarCompartilhar(blob, filename, shareTitle, shareText);
      }
    } catch (err) {
      console.error("Erro ao salvar PDF no app:", err);
      alert("Erro ao salvar o PDF.");
    }
  } else {
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (modo === "share") {
        await tentarCompartilhar(blob, filename, shareTitle, shareText);
      }
    } catch (err) {
      console.error("Erro ao baixar PDF:", err);
      alert("Erro ao baixar o PDF.");
    }
  }
}

// Normaliza o array de margem no mesmo formato que o antigo html2pdf.js aceitava:
// 1 valor (todos os lados), 2 ([vertical, horizontal]) ou 4 ([topo, direita, baixo, esquerda]).
function normalizarMargem(margin: number[] = [0, 0, 0, 0]) {
  if (margin.length === 2) {
    const [vertical, horizontal] = margin;
    return { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
  }
  if (margin.length >= 4) {
    const [top, right, bottom, left] = margin;
    return { top, right, bottom, left };
  }
  const [all = 0] = margin;
  return { top: all, right: all, bottom: all, left: all };
}

/**
 * Gera o PDF a partir de um elemento HTML (via html2canvas + jsPDF) e baixa e/ou compartilha
 * o arquivo de verdade. `modo: 'download'` só salva; `modo: 'share'` salva e também tenta
 * abrir o menu de compartilhamento do sistema (WhatsApp etc.) com o PDF anexado. Mesmo
 * algoritmo de paginação (fatiar a imagem renderizada em várias páginas) já usado em
 * `field-app/src/modules/pneus/pdfBoletim.ts`, generalizado pra respeitar margem.
 */
export async function baixarOuCompartilharPdf(
  element: HTMLElement,
  filename: string,
  shareTitle: string,
  shareText: string,
  modo: "download" | "share",
  opt: PdfOpt = {}
): Promise<void> {
  const fullOpt = { ...DEFAULT_OPT, ...opt };
  const margem = normalizarMargem(fullOpt.margin);
  const imageType = fullOpt.image?.type === "png" ? "png" : "jpeg";
  const imageQuality = fullOpt.image?.quality ?? 0.92;

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: "#ffffff",
      ...fullOpt.html2canvas,
    });

    const pdf = new jsPDF({
      orientation: fullOpt.jsPDF?.orientation ?? "portrait",
      unit: fullOpt.jsPDF?.unit ?? "mm",
      format: fullOpt.jsPDF?.format ?? "a4",
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const usableWidth = pageWidth - margem.left - margem.right;
    const usableHeight = pageHeight - margem.top - margem.bottom;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    const imgData = canvas.toDataURL(`image/${imageType}`, imageQuality);
    const formato = imageType.toUpperCase();

    let heightLeft = imgHeight;
    let position = margem.top;
    pdf.addImage(imgData, formato, margem.left, position, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      position = margem.top - (imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, formato, margem.left, position, usableWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    const blob: Blob = pdf.output("blob");
    await salvarOuCompartilharBlob(blob, filename, shareTitle, shareText, modo);
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    alert("Erro ao gerar o PDF.");
  }
}

// Antes o html2pdf.js precisava ser pré-carregado via CDN; agora html2canvas/jsPDF são
// importados como dependência normal do bundle, então não há mais nada pra pré-carregar.
// Mantido como no-op só pra não quebrar os call sites existentes que ainda chamam isso.
export function preCarregarHtml2Pdf() {}
