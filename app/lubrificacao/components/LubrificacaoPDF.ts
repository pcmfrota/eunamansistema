import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { FichaLubrificacao } from "@/src/services/LubrificacaoService";

export async function gerarPDFLubrificacao(ficha: Partial<FichaLubrificacao>, download = true) {
  // Cria elemento HTML invisível no DOM temporariamente para renderizar com fidelidade idêntica à ficha física
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "800px";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = "Arial, sans-serif";
  container.style.padding = "20px";
  container.style.boxSizing = "border-box";

  // Prepara itens de checklist
  const lubChecklist = Array.isArray(ficha.checklist_lubrificacao) ? ficha.checklist_lubrificacao : [];
  const geralChecklist = Array.isArray(ficha.checklist_geral) ? ficha.checklist_geral : [];
  const calibragemList = Array.isArray(ficha.calibragem) ? ficha.calibragem : [];
  const reapertosList = Array.isArray(ficha.reapertos) ? ficha.reapertos : [];
  const fotosAntes = Array.isArray(ficha.fotos_antes) ? ficha.fotos_antes : [];
  const fotosDepois = Array.isArray(ficha.fotos_depois) ? ficha.fotos_depois : [];

  const dataFmt = ficha.data_registro
    ? new Date(ficha.data_registro).toLocaleDateString("pt-BR")
    : new Date().toLocaleDateString("pt-BR");

  container.innerHTML = `
    <div style="border: 2px solid #000; padding: 12px; font-size: 11px;">
      
      <!-- CABEÇALHO COM LOGO E TÍTULO -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="background-color: #005a2b; color: #ffffff; padding: 6px 12px; font-weight: bold; border-radius: 4px; font-size: 16px; letter-spacing: 1px;">
            EUNAMAN
          </div>
          <span style="font-size: 9px; font-weight: bold; color: #333;">FOREST SUPPORT EXPERT</span>
        </div>
        <div style="text-align: center; flex: 1;">
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; font-weight: 900;">FICHA DE LUBRIFICAÇÃO</h2>
          <span style="font-size: 10px; color: #555;">CLIENTE: ${ficha.cliente || "SUZANO"} | MÓDULO: ${ficha.modulo || "BASE"}</span>
        </div>
        <div style="text-align: right; font-size: 9px; font-weight: bold;">
          <div>DATA: ${dataFmt}</div>
          <div>INÍCIO: ${ficha.hora_inicio || "--:--"} | FIM: ${ficha.hora_fim || "--:--"}</div>
        </div>
      </div>

      <!-- DADOS DE IDENTIFICAÇÃO DO EQUIPAMENTO -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;" border="1" cellpadding="4">
        <tr style="background-color: #f0f0f0;">
          <td style="font-weight: bold; width: 33%;">EQUIPAMENTO: <span style="font-weight: normal;">${ficha.placa || ficha.equipamento?.placa || "N/I"}</span></td>
          <td style="font-weight: bold; width: 33%;">PLACA: <span style="font-weight: normal;">${ficha.placa || "N/I"}</span></td>
          <td style="font-weight: bold; width: 34%;">LOCAL: <span style="font-weight: normal;">${ficha.local_servico || "OFICINA BASE"}</span></td>
        </tr>
        <tr style="background-color: #f0f0f0;">
          <td style="font-weight: bold;">HORÍMETRO INICIAL: <span style="font-weight: normal;">${ficha.horimetro_inicio ?? "-"}</span></td>
          <td style="font-weight: bold;">HORÍMETRO FINAL: <span style="font-weight: normal;">${ficha.horimetro_fim ?? "-"}</span></td>
          <td style="font-weight: bold;">MECÂNICO: <span style="font-weight: normal;">${ficha.mecanico_responsavel || "N/I"}</span></td>
        </tr>
        ${ficha.ajudante ? `<tr><td colspan="3" style="font-weight: bold;">AJUDANTE: <span style="font-weight: normal;">${ficha.ajudante}</span></td></tr>` : ""}
      </table>

      <!-- TABELA DE PONTOS DE LUBRIFICAÇÃO E CHECKLIST GERAL -->
      <div style="font-weight: bold; font-size: 12px; background-color: #cccccc; padding: 4px 8px; border: 1px solid #000; margin-bottom: 4px; text-transform: uppercase;">
        PONTOS DE LUBRIFICAÇÃO & CHECKLIST GERAL
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px;" border="1" cellpadding="3">
        <thead style="background-color: #e0e0e0; font-weight: bold;">
          <tr>
            <th style="text-align: left;">DESCRIÇÃO DO ITEM / PONTO</th>
            <th style="width: 70px; text-align: center;">QTD PREV.</th>
            <th style="width: 110px; text-align: center;">STATUS</th>
            <th style="text-align: left;">OBSERVAÇÃO</th>
          </tr>
        </thead>
        <tbody>
          ${lubChecklist.map((item: any) => `
            <tr>
              <td><b>${item.item}</b></td>
              <td style="text-align: center;">${item.qtdPrevista ? `${item.qtdPrevista} ${item.unidade || 'Grax.'}` : '-'}</td>
              <td style="text-align: center; font-weight: bold; color: ${item.status === 'Executado' ? 'green' : item.status === 'Não Executado' ? 'red' : '#555'};">
                ${item.status || 'Não Executado'}
              </td>
              <td>${item.observacao || '-'}</td>
            </tr>
          `).join("")}
          ${geralChecklist.map((item: any) => `
            <tr style="background-color: #f9f9f9;">
              <td>${item.item}</td>
              <td style="text-align: center;">--</td>
              <td style="text-align: center; font-weight: bold; color: ${item.status === 'SIM' ? 'green' : 'red'};">
                ${item.status || 'NÃO'}
              </td>
              <td>${item.observacao || '-'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- TABELA E DESENHO DE CALIBRAÇÃO DE PNEUS -->
      <div style="font-weight: bold; font-size: 12px; background-color: #cccccc; padding: 4px 8px; border: 1px solid #000; margin-bottom: 4px; text-transform: uppercase;">
        CALIBRAÇÃO DE PNEUS DA FROTA
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px;" border="1" cellpadding="3">
        <thead style="background-color: #e0e0e0; font-weight: bold;">
          <tr>
            <th style="width: 60px;">POSIÇÃO</th>
            <th>DESCRIÇÃO DA POSIÇÃO</th>
            <th style="width: 90px;">Nº PNEU</th>
            <th style="width: 90px; text-align: center;">PRESSÃO MEDIDA</th>
            <th style="width: 90px; text-align: center;">PRESSÃO CALIBR.</th>
            <th style="width: 70px; text-align: center;">STATUS</th>
          </tr>
        </thead>
        <tbody>
          ${calibragemList.map((c: any) => `
            <tr>
              <td style="font-weight: bold; text-align: center;">${c.posicao}</td>
              <td>${c.rotulo || `Posição ${c.posicao}`}</td>
              <td>${c.numeroPneu || '-'}</td>
              <td style="text-align: center; font-weight: bold;">${c.pressaoMedida ?? '-'} PSI</td>
              <td style="text-align: center; font-weight: bold;">${c.pressaoCalibrada ?? '-'} PSI</td>
              <td style="text-align: center; font-weight: bold; color: ${c.status === 'OK' ? 'green' : 'red'};">${c.status || '-'}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- REAPERTOS -->
      ${reapertosList.length > 0 ? `
        <div style="font-weight: bold; font-size: 11px; background-color: #cccccc; padding: 3px 6px; border: 1px solid #000; margin-bottom: 4px; text-transform: uppercase;">
          ITENS DE REAPERTO DA SUSPENSÃO E EIXOS
        </div>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 9px;" border="1" cellpadding="3">
          <thead style="background-color: #e0e0e0;">
            <tr>
              <th>ITEM REAPERTO</th>
              <th style="width: 100px; text-align: center;">SITUAÇÃO</th>
              <th>OBSERVAÇÃO</th>
            </tr>
          </thead>
          <tbody>
            ${reapertosList.map((r: any) => `
              <tr>
                <td><b>${r.item}</b></td>
                <td style="text-align: center; font-weight: bold;">${r.status}</td>
                <td>${r.observacao || '-'}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      ` : ""}

      <!-- OBSERVAÇÕES GERAIS -->
      ${ficha.observacoes ? `
        <div style="border: 1px solid #000; padding: 6px; margin-bottom: 12px; background-color: #fafafa;">
          <div style="font-weight: bold; font-size: 10px; text-transform: uppercase; margin-bottom: 4px;">OBSERVAÇÕES GERAIS DO SERVIÇO:</div>
          <div style="font-size: 9px; white-space: pre-wrap;">${ficha.observacoes}</div>
        </div>
      ` : ""}

      <!-- ASSINATURAS DIGITAIS -->
      <div style="display: flex; justify-content: space-around; align-items: flex-end; margin-top: 20px; border-top: 1px solid #000; padding-top: 12px;">
        
        <div style="text-align: center; width: 45%;">
          ${ficha.assinatura_mecanico ? `<img src="${ficha.assinatura_mecanico}" style="max-height: 50px; max-width: 200px; border-bottom: 1px solid #000; margin-bottom: 4px;" />` : `<div style="height: 40px; border-bottom: 1px dashed #000;"></div>`}
          <div style="font-weight: bold; font-size: 10px;">${ficha.mecanico_responsavel || "MECÂNICO RESPONSÁVEL"}</div>
          <div style="font-size: 8px; color: #666;">Assinatura Digital Mecânico</div>
        </div>

        <div style="text-align: center; width: 45%;">
          ${ficha.assinatura_lider ? `<img src="${ficha.assinatura_lider}" style="max-height: 50px; max-width: 200px; border-bottom: 1px solid #000; margin-bottom: 4px;" />` : `<div style="height: 40px; border-bottom: 1px dashed #000;"></div>`}
          <div style="font-weight: bold; font-size: 10px;">LÍDER DA MANUTENÇÃO</div>
          <div style="font-size: 8px; color: #666;">Assinatura Digital Líder (Opcional)</div>
        </div>

      </div>

    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);

    // Se houver fotos antes/depois, cria página 2 em anexo
    if (fotosAntes.length > 0 || fotosDepois.length > 0) {
      pdf.addPage();
      pdf.setFontSize(14);
      pdf.text("ANEXO: EVIDÊNCIAS FOTOGRÁFICAS DA LUBRIFICAÇÃO", 14, 15);
      pdf.setFontSize(10);
      pdf.text(`Equipamento: ${ficha.placa || 'N/I'} | Data: ${dataFmt}`, 14, 22);

      let yPos = 30;

      if (fotosAntes.length > 0) {
        pdf.setFontSize(11);
        pdf.text("FOTOS ANTES DO SERVIÇO:", 14, yPos);
        yPos += 6;
        let xPos = 14;
        for (const f of fotosAntes) {
          try {
            pdf.addImage(f, "JPEG", xPos, yPos, 40, 40);
            xPos += 45;
            if (xPos > 160) {
              xPos = 14;
              yPos += 45;
            }
          } catch (e) {}
        }
        yPos += 50;
      }

      if (fotosDepois.length > 0) {
        pdf.setFontSize(11);
        pdf.text("FOTOS DEPOIS DO SERVIÇO:", 14, yPos);
        yPos += 6;
        let xPos = 14;
        for (const f of fotosDepois) {
          try {
            pdf.addImage(f, "JPEG", xPos, yPos, 40, 40);
            xPos += 45;
            if (xPos > 160) {
              xPos = 14;
              yPos += 45;
            }
          } catch (e) {}
        }
      }
    }

    const filename = `Ficha_Lubrificacao_${ficha.placa || "EUNAMAN"}_${dataFmt.replace(/\//g, "-")}.pdf`;

    if (download) {
      pdf.save(filename);
    }

    return pdf.output("dataurlstring");
  } catch (err) {
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    console.error("Erro ao gerar PDF:", err);
    throw err;
  }
}
