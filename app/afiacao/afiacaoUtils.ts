import { MATERIAIS_DB, ESTADO_RECEBIMENTO, TIPO_DESCARTE } from "./materiaisDB";

// Função para obter o número da semana a partir da data
export function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  var weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
}

// Helper para obter Centro de Custo (CC) a partir da máquina
export function obterCCPorEquipamento(maquina: string): string {
  const clean = String(maquina || "").toUpperCase().trim();
  const numPart = clean.replace(/[^\d]/g, "");
  const mapping: Record<string, string> = {
    "396": "06FLIMP170", "426": "06FLIMP173", "427": "06FLIMP174",
    "431": "06FLIMP177", "432": "06FLIMP178", "434": "06FLIMP180",
    "435": "06FL1MP181", "480": "06FLIMP186", "481": "06FLIMP187",
    "482": "06FLIMP188", "483": "06FLIMP189", "654": "06FLIMP192",
    "655": "06FLIMP193", "656": "06FLIMP194", "657": "06FLIMP195",
    "658": "06FLIMP196", "659": "06FLIMP197", "546": "06FLIMP228",
    "547": "06FLIMP229", "548": "06FLIMP230", "690": "06FLIMP235"
  };
  return mapping[numPart] || "";
}

// Extrair e mapear os dados da afiação para linhas da planilha
export function extrairLinhas(afiacao: any, auxiliares: any[] = []) {
  const detalhes = afiacao.detalhes || {};
  let semana: number | string = "";
  let dataFormatada = "";

  if (afiacao.data) {
    const partes = afiacao.data.split("T")[0].split("-");
    const ano = parseInt(partes[0]);
    const m = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    const dataObj = new Date(ano, m - 1, dia, 12, 0, 0);
    semana = getWeekNumber(dataObj);
    dataFormatada = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}/${ano}`;
  }

  const tipoFormulario = afiacao.tipo_formulario || "";
  const isRecebimento = tipoFormulario.includes("RECEBIMENTO") || tipoFormulario === "TRANSFERÊNCIA";

  // ── Código do Material ──────────────────────────────────────────────────────
  // Prioriza o cod salvo diretamente no import (detalhes.cod)
  let codigoUsado = detalhes.cod || "";

  if (!codigoUsado) {
    // Derivar baseado no tipo_formulario quando não vem do import
    if (tipoFormulario === "ESTADO DE RECEBIMENTO CORRENTE" || tipoFormulario === "BAIXA DE MATERIAL CORRENTE") {
      if (detalhes.cabecote === "370E (OREGON)" || detalhes.cabecote === "370E (MAQNOVA)") codigoUsado = "13";
      else if (detalhes.cabecote === "370E (KOMATSU)") codigoUsado = "12";
      else codigoUsado = "12";
    } else if (tipoFormulario === "ESTADO DE RECEBIMENTO SABRE" || tipoFormulario === "BAIXA DE MATERIAL SABRE") {
      if (detalhes.cabecote === "370E JET FIT") codigoUsado = "16";
      else if (detalhes.cabecote === "SABRE MAQNOVA") codigoUsado = "21";
      else if (detalhes.cabecote === "KOMATSU 370E") codigoUsado = "17";
      else if (detalhes.cabecote === "SABRE ROTARY-AX") codigoUsado = "23";
      else codigoUsado = "16";
    } else if (tipoFormulario === "BAIXA DE MATERIAL ROLLTOP") {
      codigoUsado = "15";
    } else if (tipoFormulario === "BAIXA DE CHAPA MAQNOVA") {
      codigoUsado = "20";
    } else if (tipoFormulario === "BAIXA DE CHAPA ROTARY-AX") {
      codigoUsado = "40";
    } else if (tipoFormulario === "BAIXAS DE EMENDAS E BOLSAS") {
      if (detalhes.tipo_material === "EMENDA MACHO") codigoUsado = "2";
      else if (detalhes.tipo_material === "EMENDA FEMEA") codigoUsado = "3";
      else if (detalhes.tipo_material === "BOLSAS") codigoUsado = "10";
      else if (detalhes.tipo_material === "REBITE") codigoUsado = "22";
      else codigoUsado = "2";
    } else {
      // Tenta derivar por NI/Código
      const cleanNi = String(detalhes.ni || detalhes.codigo || "").replace(/[^\d]/g, "").trim();
      if (cleanNi) {
        if (cleanNi === "25301352") {
          const desc = String(detalhes.desc || detalhes.referencia || "").toUpperCase();
          if (desc.includes("370E")) codigoUsado = "13";
          else codigoUsado = "12";
        } else {
          const found = MATERIAIS_DB.find(m => m.ni.replace(/[^\d]/g, "").trim() === cleanNi);
          if (found) codigoUsado = found.cod;
        }
      }
      if (!codigoUsado) {
        codigoUsado = "12";
      }
    }
  }

  // ── Informações do Material ─────────────────────────────────────────────────
  const matInfo = MATERIAIS_DB.find(m => m.cod === String(codigoUsado));
  const materialNome = matInfo?.material || "Material Desconhecido";
  // Preferir NI salvo no import (detalhes.ni) — fallback para materiaisDB
  const ni = detalhes.ni || matInfo?.ni || "-";
  const custoPorUnidade = matInfo?.custo || 0;

  // ── Motivo e Código do Motivo ────────────────────────────────────────────────
  let motivoStr = detalhes.motivo || "";
  let codMotivoStr = detalhes.cod_motivo || "";

  // Derivar COD MOTIVO se não especificado
  if (!codMotivoStr && motivoStr) {
    if (isRecebimento) {
      const entry = Object.entries(ESTADO_RECEBIMENTO).find(([, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    } else {
      const entry = Object.entries(TIPO_DESCARTE).find(([, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    }
  }

  // ── Qtd Expedida e Baixas ───────────────────────────────────────────────────
  const qtdExpedida = detalhes.qtd_expedida !== undefined
    ? parseFloat(String(detalhes.qtd_expedida)) || 0
    : (isRecebimento ? 1 : 0);
  const qtdBaixa = detalhes.qtd_baixas !== undefined
    ? parseFloat(String(detalhes.qtd_baixas)) || 0
    : (!isRecebimento ? (parseInt(String(detalhes.quantidade)) || 1) : 0);

  // ── Campos auxiliares ───────────────────────────────────────────────────────
  const numFicha = detalhes.num_ficha || "";
  const fichaFisica = detalhes.ficha_fisica || "OK";
  const novoVelho = detalhes.novo_velho || "NOVO";
  const carga = detalhes.carga || "1";
  const uni = detalhes.uni || "";
  const statusBaixa = detalhes.status_baixa || "";
  const centro = detalhes.centro || "";
  const movi = detalhes.movi || "";
  const dep = (detalhes.dep || "").toUpperCase().trim() || "AF01";
  const cc = detalhes.cc || obterCCPorEquipamento(afiacao.maquina);
  const custoCalculado = custoPorUnidade * (qtdBaixa || qtdExpedida || 0);

  return [{
    id: afiacao.id,
    codigo: codigoUsado,
    material: materialNome,
    equipamento: afiacao.maquina || "-",
    modulo: afiacao.modulo || "-",
    kit: afiacao.kit || "-",
    numFicha,
    fichaFisica,
    novoVelho,
    qtdExpedida,
    codMotivo: codMotivoStr,
    motivo: motivoStr,
    qtdBaixa,
    un: detalhes.un || "",
    semana,
    data: dataFormatada,
    carga,
    ni,
    cc,
    statusBaixa,
    uni,
    centro,
    movi,
    dep,
    custo: custoCalculado
  }];
}
