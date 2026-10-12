import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { salvarOuCompartilharBlob } from "@/lib/pdf-share";
import { FichaCompleta, Comboio, Modulo, Impedimento, Material } from "./actions";
import { INSUMO_TIPOS, labelMaterialInsumo } from "./config";
import { RecargaCompleta } from "./recargaActions";

function formatarNumero(v: number | null | undefined) {
  return (Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function formatarData(d: string) {
  if (!d) return "-";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

// ─── Ficha de Abastecimento ─────────────────────────────────────────────────

function montarHtmlFichaAbastecimento(
  ficha: FichaCompleta, comboio: Comboio, modulos: Modulo[], impedimentos: Impedimento[], materiais: Material[]
): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const modulo = modulos.find((m) => m.id === ficha.ficha.modulo_id);
  const impedimento = impedimentos.find((i) => i.id === ficha.ficha.codigo_impedimento_id);
  const temTanque2 = comboio.numero_tanques_diesel >= 2;
  const tipos = INSUMO_TIPOS.filter((t) => temTanque2 || t !== "DIESEL_T2");

  const linhasInsumos = tipos.map((tipo) => {
    const i = ficha.insumos.find((x) => x.insumo_tipo === tipo);
    const ehDiesel = tipo === "DIESEL_T1" || tipo === "DIESEL_T2";
    return `
      <tr>
        <td>${labelMaterialInsumo(tipo, materiais, temTanque2)}</td>
        <td style="text-align:right;">${ehDiesel ? formatarNumero(i?.acumulado_registradora_inicial) : "-"}</td>
        <td style="text-align:right;">${formatarNumero(i?.quantidade_inicial)}</td>
        <td style="text-align:right;">${formatarNumero(i?.entrou)}</td>
        <td style="text-align:right;">${formatarNumero(i?.saiu)}</td>
        <td style="text-align:right;">${ehDiesel ? formatarNumero(i?.acumulado_registradora_final) : "-"}</td>
        <td style="text-align:right; font-weight:bold;">${formatarNumero(i?.restou)}</td>
      </tr>
    `;
  }).join("");

  const linhasEquipamento = ficha.linhas.map((l) => `
    <tr>
      <td>${l.hora_inicial || "-"}</td><td>${l.hora_final || "-"}</td>
      <td>${l.equipamento_texto || "-"}</td><td style="text-align:right;">${formatarNumero(l.horimetro)}</td>
      <td style="text-align:right;">${formatarNumero(l.diesel_litros)}</td>
      <td style="text-align:center;">${l.preventiva ? "Sim" : "Não"}</td>
      <td style="text-align:right;">${formatarNumero(l.motor)}</td>
      <td style="text-align:right;">${formatarNumero(l.corrente)}</td>
      <td style="text-align:right;">${formatarNumero(l.graxa)}</td>
      <td style="text-align:right;">${formatarNumero(l.transmissao)}</td>
      <td style="text-align:right;">${formatarNumero(l.fluido_radiador)}</td>
      <td style="text-align:right;">${formatarNumero(l.hidraulico)}</td>
      <td style="text-align:right;">${formatarNumero(l.diferencial)}</td>
      <td style="text-align:right;">${formatarNumero(l.arla)}</td>
      <td>${l.matricula_operador || "-"}</td>
    </tr>
  `).join("");

  return `
    <div style="border: 2px solid #000; padding: 12px; font-size: 10px; font-family: Arial, sans-serif; color:#000; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
        <div style="background-color:#005a2b; color:#fff; padding:6px 12px; font-weight:bold; border-radius:4px; font-size:16px; letter-spacing:1px;">EUNAMAN</div>
        <div style="text-align:center; flex:1;">
          <h2 style="margin:0; font-size:15px; text-transform:uppercase; letter-spacing:1px; font-weight:900;">Ficha de Abastecimento</h2>
          <span style="font-size:9px; color:#555;">Nº ${ficha.ficha.numero_sequencial} — Status: ${ficha.ficha.status}</span>
        </div>
        <div style="font-size:9px; font-weight:bold; text-align:right;">Gerado em:<br/>${hoje}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:9px;" border="1" cellpadding="5">
        <tr style="background-color:#f0f0f0;">
          <td><b>Comboio:</b> ${comboio.placa} — ${comboio.modelo || "-"}</td>
          <td><b>Turno:</b> ${ficha.ficha.turno}º</td>
          <td><b>Data:</b> ${formatarData(ficha.ficha.data)}</td>
          <td><b>Módulo:</b> ${modulo?.nome || "-"}</td>
        </tr>
        <tr>
          <td><b>Motorista:</b> ${ficha.ficha.motorista_nome || "-"} (${ficha.ficha.motorista_matricula || "-"})</td>
          <td colspan="2"><b>Lubrificador:</b> ${ficha.ficha.lubrificador_nome || "-"} (${ficha.ficha.lubrificador_matricula || "-"})</td>
          <td><b>Impedimento:</b> ${impedimento?.descricao || "-"}</td>
        </tr>
        <tr>
          <td><b>Horímetro Inicial:</b> ${formatarNumero(ficha.ficha.km_horimetro_inicial)}</td>
          <td><b>Horímetro Final:</b> ${formatarNumero(ficha.ficha.km_horimetro_final)}</td>
          <td colspan="2"><b>Observações:</b> ${ficha.ficha.observacoes || "-"}</td>
        </tr>
      </table>

      <h3 style="font-size:11px; margin:10px 0 4px;">Resumo de Insumos</h3>
      <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:10px;" border="1" cellpadding="4">
        <thead style="background-color:#e0e0e0; font-weight:bold;">
          <tr><th>Insumo</th><th>Registr. Inicial</th><th>Qtd. Inicial</th><th>Entrou</th><th>Saiu</th><th>Registr. Final</th><th>Restou</th></tr>
        </thead>
        <tbody>${linhasInsumos}</tbody>
      </table>

      <h3 style="font-size:11px; margin:10px 0 4px;">Consumo Detalhado por Equipamento</h3>
      <table style="width:100%; border-collapse:collapse; font-size:8px;" border="1" cellpadding="3">
        <thead style="background-color:#e0e0e0; font-weight:bold;">
          <tr>
            <th>Hr. Ini</th><th>Hr. Fim</th><th>Equipamento</th><th>Horím.</th><th>${labelMaterialInsumo("DIESEL_T1", materiais)} (L)</th><th>Prev?</th>
            <th>${labelMaterialInsumo("HIDRAULICO_MOTOR", materiais)} (Motor)</th><th>${labelMaterialInsumo("CORRENTE", materiais)}</th>
            <th>${labelMaterialInsumo("GRAXA", materiais)}</th><th>${labelMaterialInsumo("TRANSMISSAO", materiais)}</th>
            <th>${labelMaterialInsumo("FLUIDO", materiais)}</th><th>${labelMaterialInsumo("HIDRAULICO_MOTOR", materiais)} (Hidr.)</th>
            <th>${labelMaterialInsumo("DIFERENCIAL", materiais)}</th><th>${labelMaterialInsumo("ARLA", materiais)}</th><th>Matrícula</th>
          </tr>
        </thead>
        <tbody>${linhasEquipamento || `<tr><td colspan="15" style="text-align:center; color:#888;">Nenhum lançamento</td></tr>`}</tbody>
      </table>

      <div style="display:flex; justify-content:space-around; margin-top:24px; padding-top:10px;">
        ${["Motorista", "Lubrificador", "Supervisor"].map((label) => `
          <div style="text-align:center; width:28%;">
            <div style="height:36px; border-bottom:1px solid #000;"></div>
            <div style="font-weight:bold; font-size:9px; margin-top:4px;">${label}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function fotografarEGerarPdf(html: string, nomeArquivo: string, titulo: string, descricao: string, modo: "download" | "share") {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "-9999px";
  container.style.width = "1200px";
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
    await salvarOuCompartilharBlob(blob, nomeArquivo, titulo, descricao, modo);
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    throw err;
  }
}

export async function gerarPDFFichaAbastecimento(
  ficha: FichaCompleta, comboio: Comboio, modulos: Modulo[], impedimentos: Impedimento[], materiais: Material[], modo: "download" | "share" = "download"
) {
  const html = montarHtmlFichaAbastecimento(ficha, comboio, modulos, impedimentos, materiais);
  await fotografarEGerarPdf(html, `Ficha_Abastecimento_${comboio.placa}_${ficha.ficha.data}.pdf`, "Ficha de Abastecimento", `Comboio ${comboio.placa}`, modo);
}

export function imprimirFichaAbastecimento(ficha: FichaCompleta, comboio: Comboio, modulos: Modulo[], impedimentos: Impedimento[], materiais: Material[]) {
  const janela = window.open("", "_blank");
  if (!janela) { alert("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups."); return; }
  janela.document.write(`<html><head><title>Ficha de Abastecimento</title><style>body{margin:0;padding:20px;}@media print{body{padding:0;}}</style></head><body>${montarHtmlFichaAbastecimento(ficha, comboio, modulos, impedimentos, materiais)}</body></html>`);
  janela.document.close();
  janela.onload = () => { janela.focus(); janela.print(); };
}

// ─── Ficha de Recarga ───────────────────────────────────────────────────────

function montarHtmlFichaRecarga(recarga: RecargaCompleta, placaComboio: string, placaOrigem: string | null, moduloNome: string | null): string {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const r = recarga.recarga;
  const origemLabel = r.origem_tipo === "SKID" ? `Skid Móvel (${placaOrigem || "-"})`
    : r.origem_tipo === "ALMOXARIFADO" ? `Almoxarifado Suzano (${r.origem_deposito || "-"})`
    : r.origem_tipo === "FORNECEDOR" ? "Fornecedor Externo" : (r.origem_outro_texto || "Outro");

  const linhasItens = recarga.itensDetalhados.map((i) => `
    <tr>
      <td>${i.material_nome}</td><td style="text-align:right;">${formatarNumero(i.quantidade)} ${i.unidade}</td>
      <td>${i.req_nf || "-"}</td><td>${i.tanque_diesel ? `Tanque ${i.tanque_diesel}°` : "-"}</td>
    </tr>
  `).join("");

  return `
    <div style="border: 2px solid #000; padding: 12px; font-size: 10px; font-family: Arial, sans-serif; color:#000; background:#fff;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:12px;">
        <div style="background-color:#005a2b; color:#fff; padding:6px 12px; font-weight:bold; border-radius:4px; font-size:16px; letter-spacing:1px;">EUNAMAN</div>
        <div style="text-align:center; flex:1;">
          <h2 style="margin:0; font-size:15px; text-transform:uppercase; letter-spacing:1px; font-weight:900;">Ficha de Recarga de Insumos</h2>
          <span style="font-size:9px; color:#555;">Nº ${r.numero_sequencial}</span>
        </div>
        <div style="font-size:9px; font-weight:bold; text-align:right;">Gerado em:<br/>${hoje}</div>
      </div>

      <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:9px;" border="1" cellpadding="5">
        <tr style="background-color:#f0f0f0;">
          <td><b>Comboio Destino:</b> ${placaComboio}</td>
          <td><b>Turno:</b> ${r.turno ? r.turno + "º" : "-"}</td>
          <td><b>Data/Hora:</b> ${formatarData(r.data)} ${r.hora || ""}</td>
        </tr>
        <tr>
          <td><b>Origem:</b> ${origemLabel}</td>
          <td><b>Módulo:</b> ${moduloNome || "-"}</td>
          <td><b>Local:</b> ${r.local_recarga || "-"}</td>
        </tr>
        <tr>
          <td colspan="3"><b>Motorista EUN:</b> ${r.motorista_nome || "-"} (${r.motorista_matricula || "-"}) — <b>Obs:</b> ${r.observacao || "-"}</td>
        </tr>
      </table>

      <table style="width:100%; border-collapse:collapse; font-size:9px; margin-bottom:10px;" border="1" cellpadding="5">
        <thead style="background-color:#e0e0e0; font-weight:bold;"><tr><th>Item</th><th>Quantidade</th><th>REQ/NF</th><th>Tanque</th></tr></thead>
        <tbody>${linhasItens}</tbody>
      </table>

      <div style="display:flex; justify-content:space-around; margin-top:24px; padding-top:10px;">
        <div style="text-align:center; width:40%;">
          <div style="height:36px; border-bottom:1px solid #000;"></div>
          <div style="font-weight:bold; font-size:9px; margin-top:4px;">Responsável pelo Estoque (Cliente): ${r.responsavel_nome || ""} (${r.responsavel_matricula || ""})</div>
        </div>
      </div>
    </div>
  `;
}

export async function gerarPDFFichaRecarga(
  recarga: RecargaCompleta, placaComboio: string, placaOrigem: string | null, moduloNome: string | null, modo: "download" | "share" = "download"
) {
  const html = montarHtmlFichaRecarga(recarga, placaComboio, placaOrigem, moduloNome);
  await fotografarEGerarPdf(html, `Ficha_Recarga_${placaComboio}_${recarga.recarga.data}.pdf`, "Ficha de Recarga de Insumos", `Comboio ${placaComboio}`, modo);
}

export function imprimirFichaRecarga(recarga: RecargaCompleta, placaComboio: string, placaOrigem: string | null, moduloNome: string | null) {
  const janela = window.open("", "_blank");
  if (!janela) { alert("Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups."); return; }
  janela.document.write(`<html><head><title>Ficha de Recarga</title><style>body{margin:0;padding:20px;}@media print{body{padding:0;}}</style></head><body>${montarHtmlFichaRecarga(recarga, placaComboio, placaOrigem, moduloNome)}</body></html>`);
  janela.document.close();
  janela.onload = () => { janela.focus(); janela.print(); };
}
