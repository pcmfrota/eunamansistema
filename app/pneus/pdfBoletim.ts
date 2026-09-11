// Geração da Ficha em PDF do Boletim de Pneus — compartilhada entre a Lista/Histórico
// (reimprimir um boletim já lançado), o PneuEsquemaModal (baixar/compartilhar a partir do
// esquema do veículo) e o PneusModal (baixar a ficha logo após registrar).
// Preenche os 3 sulcos (direito/meio/esquerdo) de cada posição num esquema por eixo e numa
// tabela completa (sempre as 11 posições, mesmo vazias), além de quem registrou, módulo, KM
// e observações — nada fica de fora só porque a posição não tem leitura.

import { baixarOuCompartilharPdf } from "@/lib/pdf-share";

export type InspecaoParaPDF = {
  id: string;
  data_inspecao: string;
  created_at?: string | null;
  condicao: string;
  km_atual?: number | null;
  observacoes?: string | null;
  equipamentos?: { placa?: string | null; tipo?: string | null; modulo?: string | null; categoria?: string | null } | null;
  registrado_por_nome?: string | null;
  de?: number | null;   de_s1?: number | null;   de_s3?: number | null;
  dd?: number | null;   dd_s1?: number | null;   dd_s3?: number | null;
  tei?: number | null;  tei_s1?: number | null;  tei_s3?: number | null;
  tee?: number | null;  tee_s1?: number | null;  tee_s3?: number | null;
  tdi?: number | null;  tdi_s1?: number | null;  tdi_s3?: number | null;
  tde?: number | null;  tde_s1?: number | null;  tde_s3?: number | null;
  tei1?: number | null;  tei1_s1?: number | null;  tei1_s3?: number | null;
  tee1?: number | null;  tee1_s1?: number | null;  tee1_s3?: number | null;
  tdi1?: number | null;  tdi1_s1?: number | null;  tdi1_s3?: number | null;
  tde1?: number | null;  tde1_s1?: number | null;  tde1_s3?: number | null;
  estepe?: number | null; estepe_s1?: number | null; estepe_s3?: number | null;
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

function celulaSulco(v?: number | null) {
  return v != null ? String(v) : '—';
}

// Mesma faixa de cor usada no esquema em tela (PneuEsquemaModal) — < 3mm trocar, 3-5 crítico,
// 6-9 atenção, ≥10 bom — pro PDF refletir visualmente a mesma leitura do app.
function corSulco(v: number | null): string {
  if (v == null) return "#d4d4d8";
  if (v < 3) return "#ef4444";
  if (v <= 5) return "#fb923c";
  if (v <= 9) return "#facc15";
  return "#10b981";
}

function corCondicao(condicao: string): { bg: string; text: string } {
  if (condicao === "CRITICO" || condicao === "TROCAR") return { bg: "#fee2e2", text: "#b91c1c" };
  if (condicao === "REGULAR" || condicao === "ATENCAO") return { bg: "#fef9c3", text: "#a16207" };
  return { bg: "#dcfce7", text: "#166534" };
}

// Uma posição do esquema — mostra os 3 sulcos (D/M/E) empilhados dentro de uma caixinha
// colorida pelo pior valor, igual à leitura já usada no esquema em tela e no dashboard.
function caixaPosicao(label: string, s1: number | null | undefined, s2: number | null | undefined, s3: number | null | undefined) {
  const vals = [s1, s2, s3].filter((v): v is number => v != null);
  const pior = vals.length ? Math.min(...vals) : null;
  const preenchida = vals.length > 0;
  const bg = corSulco(pior);
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="width:44px;padding:3px 1px;border-radius:6px;text-align:center;
        ${preenchida ? `background:${bg};color:#fff;border:1px solid ${bg};` : 'background:#fafafa;color:#a1a1aa;border:1px dashed #d4d4d8;'}">
        <div style="font-size:7px;font-weight:900;line-height:1.3;">${celulaSulco(s1)}/${celulaSulco(s2)}/${celulaSulco(s3)}</div>
      </div>
      <span style="font-size:7px;font-weight:900;color:#52525b;letter-spacing:0.5px;">${label}</span>
    </div>
  `;
}

const barraEixo = `<div style="width:26px;height:3px;background:#d4d4d8;border-radius:2px;"></div>`;

// Monta o HTML da ficha — usado tanto pra gerar o PDF quanto pra pré-visualizar antes de
// baixar (FichaPreviewModal renderiza esse mesmo markup dentro de um modal).
export function gerarHtmlFichaPneus(ins: InspecaoParaPDF) {
  const placa = ins.equipamentos?.placa || '—';
  const modulo = ins.equipamentos?.modulo || '—';
  const funcionario = ins.registrado_por_nome || '—';
  const cond = corCondicao(ins.condicao);

  const hasEixo2 = ins.tei1 != null || ins.tee1 != null || ins.tdi1 != null || ins.tde1 != null
    || ins.tei1_s1 != null || ins.tee1_s1 != null || ins.tdi1_s1 != null || ins.tde1_s1 != null
    || ins.tei1_s3 != null || ins.tee1_s3 != null || ins.tdi1_s3 != null || ins.tde1_s3 != null;

  const posicoes = [
    { lbl: 'DE', s1: ins.de_s1, s2: ins.de, s3: ins.de_s3 },
    { lbl: 'DD', s1: ins.dd_s1, s2: ins.dd, s3: ins.dd_s3 },
    { lbl: 'TEE', s1: ins.tee_s1, s2: ins.tee, s3: ins.tee_s3 },
    { lbl: 'TEI', s1: ins.tei_s1, s2: ins.tei, s3: ins.tei_s3 },
    { lbl: 'TDI', s1: ins.tdi_s1, s2: ins.tdi, s3: ins.tdi_s3 },
    { lbl: 'TDE', s1: ins.tde_s1, s2: ins.tde, s3: ins.tde_s3 },
    { lbl: 'TEE1', s1: ins.tee1_s1, s2: ins.tee1, s3: ins.tee1_s3 },
    { lbl: 'TEI1', s1: ins.tei1_s1, s2: ins.tei1, s3: ins.tei1_s3 },
    { lbl: 'TDI1', s1: ins.tdi1_s1, s2: ins.tdi1, s3: ins.tdi1_s3 },
    { lbl: 'TDE1', s1: ins.tde1_s1, s2: ins.tde1, s3: ins.tde1_s3 },
    { lbl: 'ESTEPE', s1: ins.estepe_s1, s2: ins.estepe, s3: ins.estepe_s3 },
  ];

  return `
      <div style="padding: 10px; font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10px; width: 100%; box-sizing: border-box; background: #fff;">

         <!-- Header -->
         <div style="display:flex; align-items:center; border: 2px solid #166534; margin-bottom: 8px;">
            <div style="width: 24%; border-right: 2px solid #166534; text-align: center; padding: 6px;">
               <img src="/logo-eunaman-full.png" style="height: 42px; object-fit: contain;" />
            </div>
            <div style="width: 50%; border-right: 2px solid #166534; text-align: center; padding: 6px;">
               <h1 style="margin: 0; font-size: 21px; font-weight: 900; letter-spacing: 1px; color:#000;">BOLETIM DE PNEUS</h1>
               <p style="margin: 2px 0 0; font-size: 9px; color: #6b7280;">Monitoramento e Inspeção de Frotas</p>
            </div>
            <div style="width: 26%; padding: 6px; font-size: 9px; line-height: 1.5; color:#000;">
               <div>Doc. Nº: <b style="color:#b91c1c;">${ins.id.split('-')[0].toUpperCase()}</b></div>
               <div>Data: <b>${fmtDataPDF(ins.data_inspecao)}</b></div>
               <div>Hora: <b>${fmtHoraPDF(ins.created_at || ins.data_inspecao)}</b></div>
            </div>
         </div>

         <!-- Info -->
         <table style="width: 100%; border-collapse: collapse; border: 2px solid #166534; margin-bottom: 8px; font-size: 9px; color:#000;">
            <tr>
               <td style="border-right: 1px solid #166534; padding: 6px; width: 22%;"><div style="color:#6b7280;">EQUIPAMENTO</div><div style="font-weight:900; font-size:15px;">${placa}</div></td>
               <td style="border-right: 1px solid #166534; padding: 6px; width: 18%;"><div style="color:#6b7280;">MÓDULO</div><div style="font-weight:700;">${modulo}</div></td>
               <td style="border-right: 1px solid #166534; padding: 6px; width: 14%;"><div style="color:#6b7280;">KM</div><div style="font-weight:700;">${ins.km_atual != null ? ins.km_atual.toLocaleString('pt-BR') : '—'}</div></td>
               <td style="border-right: 1px solid #166534; padding: 6px; width: 24%;"><div style="color:#6b7280;">REGISTRADO POR</div><div style="font-weight:700;">${funcionario}</div></td>
               <td style="padding: 6px; width: 22%;"><div style="color:#6b7280;">CONDIÇÃO GERAL</div><span style="display:inline-block; margin-top:2px; padding:2px 8px; border-radius:10px; font-weight:900; font-size:10px; background:${cond.bg}; color:${cond.text};">${ins.condicao}</span></td>
            </tr>
         </table>

         <!-- Esquema por eixo -->
         <div style="border: 2px solid #166534; margin-bottom: 8px;">
            <div style="background:#166534; color:#fff; text-align:center; font-weight:900; font-size:10px; letter-spacing:1px; padding:4px;">ESQUEMA DE MEDIÇÃO — SULCO 1 / SULCO 2 / SULCO 3 (mm)</div>
            <div style="display:flex; flex-direction:column; align-items:center; gap:10px; padding: 10px 6px;">
               <span style="font-size:8px; font-weight:900; color:#9ca3af; letter-spacing:2px;">▲ FRENTE</span>

               <div style="display:flex; align-items:center; gap:6px;">
                  ${caixaPosicao('DE', ins.de_s1, ins.de, ins.de_s3)}
                  ${barraEixo}
                  <div style="width:60px; height:14px; background:#e4e4e7; border-radius:3px;"></div>
                  ${barraEixo}
                  ${caixaPosicao('DD', ins.dd_s1, ins.dd, ins.dd_s3)}
               </div>

               <div style="display:flex; align-items:center; gap:4px;">
                  ${caixaPosicao('TEE', ins.tee_s1, ins.tee, ins.tee_s3)}
                  ${caixaPosicao('TEI', ins.tei_s1, ins.tei, ins.tei_s3)}
                  ${barraEixo}
                  <div style="width:60px; height:10px; background:#d4d4d8; border-radius:3px;"></div>
                  ${barraEixo}
                  ${caixaPosicao('TDI', ins.tdi_s1, ins.tdi, ins.tdi_s3)}
                  ${caixaPosicao('TDE', ins.tde_s1, ins.tde, ins.tde_s3)}
               </div>

               ${hasEixo2 ? `
               <div style="display:flex; align-items:center; gap:4px;">
                  ${caixaPosicao('TEE1', ins.tee1_s1, ins.tee1, ins.tee1_s3)}
                  ${caixaPosicao('TEI1', ins.tei1_s1, ins.tei1, ins.tei1_s3)}
                  ${barraEixo}
                  <div style="width:60px; height:10px; background:#d4d4d8; border-radius:3px;"></div>
                  ${barraEixo}
                  ${caixaPosicao('TDI1', ins.tdi1_s1, ins.tdi1, ins.tdi1_s3)}
                  ${caixaPosicao('TDE1', ins.tde1_s1, ins.tde1, ins.tde1_s3)}
               </div>` : ''}

               <span style="font-size:8px; font-weight:900; color:#9ca3af; letter-spacing:2px;">▼ TRASEIRA</span>
               ${caixaPosicao('ESTEPE', ins.estepe_s1, ins.estepe, ins.estepe_s3)}
            </div>
         </div>

         <!-- Tabela completa de sulcos -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 2px solid #166534; font-size: 9px; text-align: center; color:#000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; text-align:left; padding-left:8px;">POSIÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px;">SULCO 1 (DIR.)</th>
               <th style="border: 1px solid #166534; padding: 4px;">SULCO 2 (MEIO)</th>
               <th style="border: 1px solid #166534; padding: 4px;">SULCO 3 (ESQ.)</th>
            </tr>
            ${posicoes.map(p => `
               <tr>
                  <td style="border: 1px solid #166534; padding: 4px; text-align:left; padding-left:8px; font-weight:bold; background-color:#f8fafc;">${p.lbl}</td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight:900;">${celulaSulco(p.s1)}</td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight:900;">${celulaSulco(p.s2)}</td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight:900;">${celulaSulco(p.s3)}</td>
               </tr>
            `).join('')}
         </table>

         <!-- Observações -->
         <div style="border: 2px solid #166534; padding: 6px; margin-bottom: 10px; min-height: 30px; color:#000;">
            <div style="font-size:8px; font-weight:900; text-transform:uppercase; color:#6b7280; margin-bottom:3px;">Observações</div>
            <div style="font-size:10px; white-space:pre-wrap;">${ins.observacoes || '—'}</div>
         </div>

         <!-- Assinatura -->
         <div style="border: 2px solid #166534; padding: 10px; display:flex; flex-direction:column; align-items:center; gap:24px;">
            <div style="width:60%; border-top: 1px solid #000; text-align:center; padding-top:4px; font-size:9px; color:#000;">Assinatura do Mecânico / Encarregado</div>
         </div>

      </div>
    `;
}

export function gerarFichaPneusPDF(ins: InspecaoParaPDF, modo: "download" | "share" = "download") {
  const html = gerarHtmlFichaPneus(ins);
  const element = document.createElement("div");
  element.innerHTML = html;
  const filename = `Boletim_${ins.equipamentos?.placa || 'EUNAMAN'}_${fmtDataPDF(ins.data_inspecao).replace(/\//g, '-')}.pdf`;

  baixarOuCompartilharPdf(
    element,
    filename,
    `Boletim de Pneus — ${ins.equipamentos?.placa || ''}`,
    `Boletim de Pneus da placa ${ins.equipamentos?.placa || ''} em ${fmtDataPDF(ins.data_inspecao)}`,
    modo,
    { image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true } }
  );
}
