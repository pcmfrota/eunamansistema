// Compartilhado por todo módulo que gera uma ficha em PDF via html2pdf.js (carregado
// globalmente como window.html2pdf) — extrai o padrão de "baixar" e "baixar e compartilhar
// o arquivo de verdade" que só existia no Controle de OS, pra ficar disponível em qualquer
// ficha do sistema (Mão de Obra, Pneus, Lavagens, etc.), inclusive offline/no app Android.
//
// Sempre salva o arquivo primeiro (download no navegador, ou pela ponte nativa do app) antes
// de tentar abrir o menu de compartilhamento do sistema — nunca compartilha sem ter salvo.

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

function base64ParaBlob(pdfBase64: string): Blob {
  const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
  const binaryStr = atob(cleanBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], { type: "application/pdf" });
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
 * Gera o PDF a partir de um elemento HTML (via html2pdf.js) e baixa e/ou compartilha o
 * arquivo de verdade. `modo: 'download'` só salva; `modo: 'share'` salva e também tenta
 * abrir o menu de compartilhamento do sistema (WhatsApp etc.) com o PDF anexado.
 */
export async function baixarOuCompartilharPdf(
  element: HTMLElement,
  filename: string,
  shareTitle: string,
  shareText: string,
  modo: "download" | "share",
  opt: PdfOpt = {}
): Promise<void> {
  if (typeof window === "undefined" || !(window as any).html2pdf) {
    alert("Aguarde o carregamento do gerador de PDF e tente novamente.");
    return;
  }

  const fullOpt = { ...DEFAULT_OPT, ...opt, filename };
  const worker = (window as any).html2pdf().set(fullOpt).from(element);

  if (isAndroidApp()) {
    try {
      const pdfBase64: string = await worker.outputPdf("datauristring");
      (window as any).EunamanApp.saveBase64File(pdfBase64, filename, "application/pdf");
      if (modo === "share") {
        try {
          const blob = base64ParaBlob(pdfBase64);
          await tentarCompartilhar(blob, filename, shareTitle, shareText);
        } catch (shareErr) {
          console.log("Compartilhamento pelo app falhou ou foi cancelado:", shareErr);
        }
      }
    } catch (err) {
      console.error("Erro ao gerar/salvar PDF no app:", err);
      alert("Erro ao gerar o PDF.");
    }
  } else {
    try {
      const blob: Blob = await worker.toPdf().output("blob");
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
      console.error("Erro ao gerar/baixar PDF:", err);
      alert("Erro ao gerar o PDF.");
    }
  }
}

// Pré-carrega o html2pdf.js via CDN, se ainda não estiver carregado — mesmo script usado
// em todos os módulos que geram ficha em PDF.
export function preCarregarHtml2Pdf() {
  if (typeof window === "undefined" || (window as any).html2pdf) return;
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
  document.head.appendChild(script);
}
