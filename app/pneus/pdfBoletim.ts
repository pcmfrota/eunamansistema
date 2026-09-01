// Geração da Ficha em PDF do Boletim de Pneus — compartilhada entre a Lista/Histórico
// (reimprimir um boletim já lançado) e o PneusModal (baixar a ficha logo após registrar).
// Preenche os 3 sulcos (direito/meio/esquerdo) de cada posição, além de quem registrou e
// a data/hora do lançamento.

import { baixarOuCompartilharPdf } from "@/lib/pdf-share";

export type InspecaoParaPDF = {
  id: string;
  data_inspecao: string;
  created_at?: string | null;
  condicao: string;
  equipamentos?: { placa?: string | null; tipo?: string | null } | null;
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
  return v != null ? String(v) : '';
}

// Monta o HTML da ficha — usado tanto pra gerar o PDF quanto pra pré-visualizar antes de
// baixar (FichaPreviewModal renderiza esse mesmo markup dentro de um modal).
export function gerarHtmlFichaPneus(ins: InspecaoParaPDF) {
  return `
      <div style="padding: 10px; font-family: Helvetica, Arial, sans-serif; color: #000; font-size: 10px; width: 100%; box-sizing: border-box; background: #fff;">
         <!-- Header -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 2px solid #166534;">
            <tr>
               <td style="width: 25%; border-right: 2px solid #166534; text-align: center; padding: 5px;">
                  <div style="font-size: 18px; font-weight: 900; letter-spacing: -1px; color: #000;">EUNAMAN</div>
               </td>
               <td style="width: 50%; border-right: 2px solid #166534; text-align: center; vertical-align: middle; color: #000;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 1px;">BOLETIM DE PNEUS</h1>
               </td>
               <td style="width: 25%; padding: 5px; font-size: 9px; line-height: 1.2; color: #000;">
                  <div>Doc. Nº.:</div>
                  <div>Página: 1</div>
                  <div>Versão: 1.0</div>
                  <div style="color: red; font-weight: bold; text-align: left; margin-top: 5px;">${ins.id.split('-')[0].toUpperCase()}</div>
               </td>
            </tr>
         </table>

         <!-- Info Sec -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 5px; border: 2px solid #166534; color: #000;">
            <tr>
               <td style="border: 1px solid #166534; padding: 4px; width: 15%; vertical-align: top;">
                  <div style="font-size: 8px;">Ordem de Serviço:</div>
               </td>
               <td style="border: 1px solid #166534; padding: 4px; width: 15%; vertical-align: top;">
                  <div style="font-size: 8px;">Origem:</div>
                  <div style="margin-top:2px;">[ &nbsp; ] INTERNA</div>
                  <div style="margin-top:2px;">[ &nbsp; ] CAMPO</div>
               </td>
               <td style="border: 1px solid #166534; padding: 0; width: 70%; vertical-align: top;">
                  <table style="width: 100%; border-collapse: collapse; height: 100%;">
                     <tr>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 45%; color: #000;"><div style="font-size: 8px;">FUNCIONÁRIO:</div><div style="font-weight:bold">${ins.registrado_por_nome || ''}</div></td>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 15%;"><div style="font-size: 8px;">ID:</div></td>
                        <td style="border-right: 1px solid #166534; border-bottom: 1px solid #166534; padding: 4px; width: 20%; color: #000;"><div style="font-size: 8px;">Data Entrada:</div><div style="font-weight:bold">${fmtDataPDF(ins.data_inspecao)}</div></td>
                        <td style="border-bottom: 1px solid #166534; padding: 4px; width: 20%; color: #000;"><div style="font-size: 8px;">Hora:</div><div style="font-weight:bold">${fmtHoraPDF(ins.created_at || ins.data_inspecao)}</div></td>
                     </tr>
                     <tr>
                        <td colspan="2" style="border-right: 1px solid #166534; padding: 4px; color: #000;"><div style="font-size: 8px;">EQUIPAMENTO:</div><div style="font-weight:bold; font-size: 14px;">${ins.equipamentos?.placa || ''}</div></td>
                        <td style="border-right: 1px solid #166534; padding: 4px;"><div style="font-size: 8px;">Data Saída:</div></td>
                        <td style="padding: 4px;"><div style="font-size: 8px;">Hora:</div></td>
                     </tr>
                  </table>
               </td>
            </tr>
         </table>

         <!-- Desmontados Header -->
         <div style="background-color: #f0fdf4; border: 2px solid #166534; text-align: center; font-weight: bold; padding: 4px; margin-bottom: 5px; color: #000;">P N E U S &nbsp; &nbsp; D E S M O N T A D O S</div>

         <!-- Tabela Desmontados -->
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #166534; font-size: 8px; text-align: center; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">POSIÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">TIPO DE<br>INTERVENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">MOTIVO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">CAUSA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 1<br><span style="font-weight: normal;">(dir.)</span></th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 2<br><span style="font-weight: normal;">(meio)</span></th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 3<br><span style="font-weight: normal;">(esq.)</span></th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">PRESSÃO<br>MEDIDA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 14%;">PRESSÃO<br>CALIBRADA</th>
            </tr>
            ${[
               { lbl: '1º EIXO DE', s1: ins.de_s1, s2: ins.de, s3: ins.de_s3 },
               { lbl: '1º EIXO DD', s1: ins.dd_s1, s2: ins.dd, s3: ins.dd_s3 },
               { lbl: '2º EIXO TEE', s1: ins.tee_s1, s2: ins.tee, s3: ins.tee_s3 },
               { lbl: '2º EIXO TEI', s1: ins.tei_s1, s2: ins.tei, s3: ins.tei_s3 },
               { lbl: '2º EIXO TDI', s1: ins.tdi_s1, s2: ins.tdi, s3: ins.tdi_s3 },
               { lbl: '2º EIXO TDE', s1: ins.tde_s1, s2: ins.tde, s3: ins.tde_s3 },
               { lbl: '3º EIXO TEE', s1: ins.tee1_s1, s2: ins.tee1, s3: ins.tee1_s3 },
               { lbl: '3º EIXO TEI', s1: ins.tei1_s1, s2: ins.tei1, s3: ins.tei1_s3 },
               { lbl: '3º EIXO TDI', s1: ins.tdi1_s1, s2: ins.tdi1, s3: ins.tdi1_s3 },
               { lbl: '3º EIXO TDE', s1: ins.tde1_s1, s2: ins.tde1, s3: ins.tde1_s3 },
               { lbl: '98 STEP', s1: ins.estepe_s1, s2: ins.estepe, s3: ins.estepe_s3 }
            ].map((r, i) => (r.s1 != null || r.s2 != null || r.s3 != null || i < 2) ? `
               <tr>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: bold; background-color: #f8fafc; color: #000;">${r.lbl}</td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: 900; font-size: 10px; color: #000;">${celulaSulco(r.s1)}</td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: 900; font-size: 10px; color: #000;">${celulaSulco(r.s2)}</td>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: 900; font-size: 10px; color: #000;">${celulaSulco(r.s3)}</td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
                  <td style="border: 1px solid #166534; padding: 4px; background-color: #f1f5f9;"></td>
               </tr>
            ` : '').join('')}
         </table>

         <!-- Montados Header -->
         <div style="background-color: #f0fdf4; border: 2px solid #166534; border-bottom: none; text-align: center; font-weight: bold; padding: 4px; color: #000;">P N E U S &nbsp; &nbsp; M O N T A D O S</div>
         <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 2px solid #166534; font-size: 8px; text-align: center; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">POSIÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">TIPO DE<br>INTERVENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">MOTIVO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 15%;">CAUSA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 1</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 2</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 8%;">SULCO 3</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 12%;">PRESSÃO<br>MEDIDA</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 14%;">PRESSÃO<br>CALIBRADA</th>
            </tr>
            ${[
               { lbl: '1º EIXO DE' }, { lbl: '1º EIXO DD' },
               { lbl: '2º EIXO TEE' }, { lbl: '2º EIXO TEI' },
               { lbl: '98 STEP' }
            ].map(r => `
               <tr>
                  <td style="border: 1px solid #166534; padding: 4px; font-weight: bold; background-color: #f8fafc; color: #000;">${r.lbl}</td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
                  <td style="border: 1px solid #166534; padding: 4px;"></td>
               </tr>
            `).join('')}
         </table>

         <!-- Legends / Dictionary -->
         <table style="width: 100%; border-collapse: collapse; border: 2px solid #166534; font-size: 7px; margin-bottom: 10px; color: #000;">
            <tr style="background-color: #f0fdf4;">
               <th style="border: 1px solid #166534; padding: 4px; width: 25%;">EVENTO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 50%;">MOTIVO DA RETIRADA / MANUTENÇÃO</th>
               <th style="border: 1px solid #166534; padding: 4px; width: 25%;">TIPO DE REPARO</th>
            </tr>
            <tr>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="margin-bottom:2px;">[ 1 ] MOVIMENTAÇÃO</div>
                  <div style="margin-bottom:2px;">[ 2 ] CONSERTO</div>
                  <div style="margin-bottom:2px;">[ 3 ] INVENTÁRIO</div>
                  <div style="margin-bottom:2px;">[ 4 ] CALIBRAGEM / MEDIÇÃO</div>
                  <div style="margin-bottom:2px;">[ 5 ] RETIRADA RECAPAGEM</div>
               </td>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="column-count: 2; column-gap: 15px;">
                     <div style="margin-bottom:2px;">[ 1 ] RODOU FURADO</div>
                     <div style="margin-bottom:2px;">[ 2 ] RODOU BAIXA PRESSÃO</div>
                     <div style="margin-bottom:2px;">[ 3 ] DESGASTE IRREGULAR</div>
                     <div style="margin-bottom:2px;">[ 4 ] TALÕES DANIFICADO</div>
                     <div style="margin-bottom:2px;">[ 5 ] IMPACTO DE FRANCO</div>
                     <div style="margin-bottom:2px;">[ 6 ] PERFURAÇÃO OBJETOS</div>
                     <div style="margin-bottom:2px;">[ 7 ] SEPARAÇÃO DE BANDA</div>
                     <div style="margin-bottom:2px;">[ 19] RECAPAGEM</div>
                     <div style="margin-bottom:2px;">[ 20] RODÍZIO DE PNEU</div>
                     <div style="margin-bottom:2px;">[ 31] INVENTÁRIO</div>
                  </div>
               </td>
               <td style="border: 1px solid #166534; padding: 6px; vertical-align: top;">
                  <div style="column-count: 1;">
                     <div style="margin-bottom:2px;">[ 1 ] PREGO</div>
                     <div style="margin-bottom:2px;">[ 2 ] PARAFUSO</div>
                     <div style="margin-bottom:2px;">[ 3 ] FERRO</div>
                     <div style="margin-bottom:2px;">[ 4 ] RODA QUEBRADA</div>
                     <div style="margin-bottom:2px;">[ 7 ] CORTE PNEU</div>
                  </div>
               </td>
            </tr>
         </table>

         <div style="display: flex; gap: 10px; font-size: 8px; color: #000;">
            <div style="border: 2px solid #166534; padding: 6px; flex: 1;">
               <b>STATUS DIAGNOSTICADO:</b> <span style="background-color: ${ins.condicao === 'CRITICO' || ins.condicao === 'TROCAR' ? '#fee2e2' : '#dcfce7'}; padding: 2px 4px; border: 1px solid #166534;">${ins.condicao}</span>
            </div>
            <div style="border: 2px solid #166534; padding: 6px; flex: 2; display: flex; flex-direction: column; justify-content: flex-end;">
               <div style="border-top: 1px solid #166534; margin-top: 20px; text-align: center;">Assinatura do Mecânico / Encarregado</div>
            </div>
         </div>
      </div>
    `;
}

export function gerarFichaPneusPDF(ins: InspecaoParaPDF, modo: "download" | "share" = "download") {
  const html = gerarHtmlFichaPneus(ins);
  const element = document.createElement("div");
  element.innerHTML = html;
  const filename = `Boletim_${ins.equipamentos?.placa}_${fmtDataPDF(ins.data_inspecao).replace(/\//g, '-')}.pdf`;

  baixarOuCompartilharPdf(
    element,
    filename,
    `Boletim de Pneus — ${ins.equipamentos?.placa || ''}`,
    `Boletim de Pneus da placa ${ins.equipamentos?.placa || ''} em ${fmtDataPDF(ins.data_inspecao)}`,
    modo,
    { image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 } }
  );
}
