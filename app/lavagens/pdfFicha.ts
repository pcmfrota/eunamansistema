// Geração da Ficha em PDF do Controle de Lavagens — mesmo padrão usado no Boletim de Pneus
// (app/pneus/pdfBoletim.ts): monta o HTML da ficha (reaproveitado pela pré-visualização em
// FichaPreviewModal) e depois converte pra PDF via html2pdf.js.

import { baixarOuCompartilharPdf } from "@/lib/pdf-share";

export type LavagemParaPDF = {
  id: string;
  placa: string;
  data: string;
  created_at?: string | null;
  colaborador?: string | null;
  registrado_por_nome?: string | null;
  horimetro?: number | null;
  km?: number | null;
  status?: string | null;
  observacoes?: string | null;
  itens_lavados?: string[] | null;
  tipo_frota?: 'pesado' | 'leve' | null;
  imagem_1_url?: string | null;
  imagem_2_url?: string | null;
  imagem_3_url?: string | null;
  imagem_horimetro_url?: string | null;
  assinatura_url?: string | null;
};

function fmtDataPDF(dateStr?: string | null) {
  if (!dateStr) return "-";
  const [datePart] = dateStr.split('T');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

function fmtHoraPDF(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Monta o HTML da ficha — usado tanto pra gerar o PDF quanto pra pré-visualizar antes de
// baixar (FichaPreviewModal renderiza esse mesmo markup dentro de um modal).
export function gerarHtmlFichaLavagem(l: LavagemParaPDF) {
  const isLeve = l.tipo_frota === 'leve';
  const fotos = (isLeve
    ? [
        { label: 'Foto Externa', url: l.imagem_1_url },
        { label: 'Foto Interna', url: l.imagem_2_url },
      ]
    : [
        { label: 'Horímetro', url: l.imagem_horimetro_url },
        { label: 'Foto 01', url: l.imagem_1_url },
        { label: 'Foto 02', url: l.imagem_2_url },
        { label: 'Foto 03', url: l.imagem_3_url },
      ]
  ).filter(f => !!f.url);

  const itens = l.itens_lavados || [];

  return `
      <div style="padding: 10px; font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10px; width: 100%; box-sizing: border-box; background: #fff;">
         <!-- Header -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 2px solid #1d4ed8;">
            <tr>
               <td style="width: 25%; border-right: 2px solid #1d4ed8; text-align: center; padding: 5px;">
                  <div style="font-size: 18px; font-weight: 900; letter-spacing: -1px; color: #000;">EUNAMAN</div>
               </td>
               <td style="width: 50%; border-right: 2px solid #1d4ed8; text-align: center; vertical-align: middle; color: #000;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 1px;">FICHA DE LAVAGEM</h1>
                  <div style="font-size: 9px; font-weight: bold; letter-spacing: 1px; margin-top: 2px;">${isLeve ? '🚗 FROTA LEVE' : '🚛 FROTA PESADA'}</div>
               </td>
               <td style="width: 25%; padding: 5px; font-size: 9px; line-height: 1.2; color: #000;">
                  <div>Doc. Nº.:</div>
                  <div style="color: #1d4ed8; font-weight: bold; text-align: left; margin-top: 5px;">${l.id.split('-')[0].toUpperCase()}</div>
               </td>
            </tr>
         </table>

         <!-- Info Sec -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 2px solid #1d4ed8; color: #000;">
            <tr>
               <td style="border-right: 1px solid #1d4ed8; border-bottom: 1px solid #1d4ed8; padding: 6px; width: 30%;"><div style="font-size: 8px;">EQUIPAMENTO:</div><div style="font-weight:bold; font-size: 16px;">${l.placa || ''}</div></td>
               <td style="border-right: 1px solid #1d4ed8; border-bottom: 1px solid #1d4ed8; padding: 6px; width: 20%;"><div style="font-size: 8px;">DATA:</div><div style="font-weight:bold">${fmtDataPDF(l.data)}</div></td>
               <td style="border-right: 1px solid #1d4ed8; border-bottom: 1px solid #1d4ed8; padding: 6px; width: 15%;"><div style="font-size: 8px;">HORA:</div><div style="font-weight:bold">${fmtHoraPDF(l.created_at || l.data)}</div></td>
               <td style="border-bottom: 1px solid #1d4ed8; padding: 6px; width: 35%;"><div style="font-size: 8px;">RESPONSÁVEL / LANÇADO POR:</div><div style="font-weight:bold">${l.registrado_por_nome || l.colaborador || ''}</div></td>
            </tr>
            <tr>
               <td style="border-right: 1px solid #1d4ed8; padding: 6px;"><div style="font-size: 8px;">HORÍMETRO:</div><div style="font-weight:bold">${l.horimetro != null ? l.horimetro : '-'}</div></td>
               <td style="border-right: 1px solid #1d4ed8; padding: 6px;"><div style="font-size: 8px;">KM:</div><div style="font-weight:bold">${l.km != null ? l.km : '-'}</div></td>
               <td colspan="2" style="padding: 6px;"><div style="font-size: 8px;">STATUS:</div><div style="font-weight:bold">${l.status || ''}</div></td>
            </tr>
         </table>

         <!-- Itens Lavados -->
         <div style="background-color: #eff6ff; border: 2px solid #1d4ed8; text-align: center; font-weight: bold; padding: 4px; margin-bottom: 5px; color: #000;">ITENS LAVADOS</div>
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 2px solid #1d4ed8; font-size: 9px; color: #000;">
            <tr>
               <td style="padding: 8px;">
                  <div style="display: flex; flex-wrap: wrap; gap: 6px 18px;">
                     ${itens.length > 0
                        ? itens.map(item => `<span>&#9745; ${item}</span>`).join('')
                        : '<span style="color:#888;">Nenhum item marcado.</span>'}
                  </div>
               </td>
            </tr>
         </table>

         <!-- Observações -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 2px solid #1d4ed8; font-size: 9px; color: #000;">
            <tr><td style="padding: 8px; min-height: 40px;"><div style="font-size: 8px; margin-bottom: 4px;">OBSERVAÇÕES:</div>${l.observacoes || '-'}</td></tr>
         </table>

         <!-- Fotos -->
         ${fotos.length > 0 ? `
         <div style="background-color: #eff6ff; border: 2px solid #1d4ed8; text-align: center; font-weight: bold; padding: 4px; margin-bottom: 5px; color: #000;">EVIDÊNCIAS FOTOGRÁFICAS</div>
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; border: 2px solid #1d4ed8;">
            <tr>
               ${fotos.map(f => `
                  <td style="border: 1px solid #1d4ed8; padding: 4px; text-align: center; width: ${Math.floor(100 / fotos.length)}%;">
                     <img src="${f.url}" style="width: 100%; max-height: 140px; object-fit: cover; display: block;" />
                     <div style="font-size: 8px; font-weight: bold; margin-top: 2px;">${f.label}</div>
                  </td>
               `).join('')}
            </tr>
         </table>
         ` : ''}

         <div style="border: 2px solid #1d4ed8; padding: 6px; margin-top: 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; font-size: 8px; color: #000;">
            ${l.assinatura_url ? `<img src="${l.assinatura_url}" style="height: 60px; object-fit: contain;" />` : ''}
            <div style="border-top: 1px solid #1d4ed8; margin-top: ${l.assinatura_url ? '4px' : '30px'}; padding-top: 4px; width: 100%; text-align: center;">Assinatura do Responsável</div>
         </div>
      </div>
    `;
}

export function gerarFichaLavagemPDF(l: LavagemParaPDF, modo: "download" | "share" = "download") {
  const html = gerarHtmlFichaLavagem(l);
  const element = document.createElement("div");
  element.innerHTML = html;
  const filename = `Lavagem_${l.placa}_${fmtDataPDF(l.data).replace(/\//g, '-')}.pdf`;

  baixarOuCompartilharPdf(
    element,
    filename,
    `Ficha de Lavagem — ${l.placa}`,
    `Ficha de Lavagem da placa ${l.placa} em ${fmtDataPDF(l.data)}`,
    modo,
    { image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true } }
  );
}
