import { useState } from "react";
import { MATERIAIS_DB, ESTADO_RECEBIMENTO, TIPO_DESCARTE, buscarMaterialPorCodigo } from "./materiaisDB";

// Função para obter o número da semana a partir da data
function getWeekNumber(d: Date) {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper para buscar material de forma dinâmica ou estática
function buscarMaterial(codigoOuDescricao: string, auxiliares: any[]) {
  const encontrado = auxiliares.find(
    (item) =>
      item.category === "material" &&
      (String(item.metadata?.codigo) === String(codigoOuDescricao) ||
        item.value.toUpperCase() === codigoOuDescricao.toUpperCase())
  );

  if (encontrado) {
    return {
      material: encontrado.value,
      ni: encontrado.metadata?.ni || "-",
      custo: parseFloat(encontrado.metadata?.custo) || 0,
      cod: encontrado.metadata?.codigo || ""
    };
  }

  return buscarMaterialPorCodigo(codigoOuDescricao);
}

// Extrair e mapear os dados da afiação para linhas da planilha
function extrairLinhas(afiacao: any, auxiliares: any[] = []) {
  const detalhes = afiacao.detalhes || {};
  // Parsear data sem conversão de timezone: "2026-06-25" -> [2026, 6, 25]
  let mes: number | string = "";
  let semana: number | string = "";
  let dataFormatada = "";
  if (afiacao.data) {
    const partes = afiacao.data.split("T")[0].split("-"); // garante apenas a parte da data
    const ano = parseInt(partes[0]);
    const m = parseInt(partes[1]);
    const dia = parseInt(partes[2]);
    // Criar data com hora local (meio-dia) para evitar drift de fuso horário
    const dataObj = new Date(ano, m - 1, dia, 12, 0, 0);
    mes = m;
    semana = getWeekNumber(dataObj);
    dataFormatada = `${String(dia).padStart(2, '0')}/${String(m).padStart(2, '0')}/${ano}`;
  }
  const tipoFormulario = afiacao.tipo_formulario || "";
  const isRecebimento = tipoFormulario.includes("RECEBIMENTO");


  // Definir qual código/material estamos lidando
  let codigos: string[] = [];
  let motivoStr = "";
  let codMotivoStr = "";
  let numCorrenteCabecote = "";

  if (tipoFormulario === "ESTADO DE RECEBIMENTO CORRENTE") {
    numCorrenteCabecote = detalhes.corrente ? detalhes.corrente.replace(/\D/g, '') : ""; // pega apenas o numero
    motivoStr = detalhes.estado_corrente || "";
    // Código para corrente depende do cabeçote. Aqui fazemos um mapeamento simples baseado no select
    if (detalhes.cabecote === "370E (OREGON)" || detalhes.cabecote === "370E (MAQNOVA)") codigos = ["13", "14"]; // Exemplo: 13 e 14 são correntes 370E
    else if (detalhes.cabecote === "370E (KOMATSU)") codigos = ["12"]; // Ex: 12 é 18HX V132
    else codigos = ["12"];
  } else if (tipoFormulario === "ESTADO DE RECEBIMENTO SABRE") {
    numCorrenteCabecote = detalhes.sabre ? detalhes.sabre.replace(/\D/g, '') : "";
    motivoStr = detalhes.recebimento_sabre || "";
    if (detalhes.cabecote === "370E JET FIT") codigos = ["16"];
    else if (detalhes.cabecote === "SABRE MAQNOVA") codigos = ["21"];
    else if (detalhes.cabecote === "KOMATSU 370E") codigos = ["17", "18"];
    else if (detalhes.cabecote === "SABRE ROTARY-AX") codigos = ["23"];
    else codigos = ["16"];
  } else if (tipoFormulario === "BAIXA DE MATERIAL CORRENTE") {
    numCorrenteCabecote = detalhes.corrente ? detalhes.corrente.replace(/\D/g, '') : "";
    motivoStr = detalhes.motivo || "";
    codigos = ["12", "13", "14"]; // Simplificação
  } else if (tipoFormulario === "BAIXA DE MATERIAL SABRE") {
    numCorrenteCabecote = detalhes.sabre ? detalhes.sabre.replace(/\D/g, '') : "";
    motivoStr = detalhes.motivo || "";
    codigos = ["16", "17", "18", "21", "23"];
  } else if (tipoFormulario === "BAIXA DE MATERIAL ROLLTOP") {
    numCorrenteCabecote = detalhes.sabre ? detalhes.sabre.replace(/\D/g, '') : "";
    motivoStr = detalhes.motivo || "";
    codigos = ["15"];
  } else if (tipoFormulario === "BAIXA DE CHAPA MAQNOVA") {
    numCorrenteCabecote = detalhes.sabre ? detalhes.sabre.replace(/\D/g, '') : "";
    motivoStr = detalhes.motivo || "";
    codigos = ["20"];
  } else if (tipoFormulario === "BAIXA DE CHAPA ROTARY-AX") {
    numCorrenteCabecote = detalhes.sabre ? detalhes.sabre.replace(/\D/g, '') : "";
    motivoStr = detalhes.motivo || "";
    codigos = ["40"];
  } else if (tipoFormulario === "BAIXAS DE EMENDAS E BOLSAS") {
    numCorrenteCabecote = detalhes.quantidade || "1";
    // Tenta encontrar o material pelo nome na base dinâmica
    const matAux = auxiliares.find(
      (item) =>
        item.category === "material" &&
        item.value.toUpperCase() === (detalhes.tipo_material || "").toUpperCase()
    );
    if (matAux && matAux.metadata?.codigo) {
      codigos = [matAux.metadata.codigo];
    } else {
      // Fallback estático
      if (detalhes.tipo_material === "EMENDA MACHO") codigos = ["2"];
      else if (detalhes.tipo_material === "EMENDA FEMEA") codigos = ["3"];
      else if (detalhes.tipo_material === "BOLSAS") codigos = ["10"];
      else if (detalhes.tipo_material === "REBITE") codigos = ["22"];
      else codigos = ["2"];
    }
  }

  // Tentar encontrar o COD MOTIVO (letra)
  const motivoAux = auxiliares.find(
    (item) =>
      (item.category === "estado_recebimento" || item.category === "tipo_descarte") &&
      item.value.toUpperCase() === motivoStr.toUpperCase()
  );

  if (motivoAux && motivoAux.metadata?.codigo) {
    codMotivoStr = motivoAux.metadata.codigo;
  } else {
    // Fallback estático
    if (isRecebimento) {
      const entry = Object.entries(ESTADO_RECEBIMENTO).find(([k, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    } else {
      const entry = Object.entries(TIPO_DESCARTE).find(([k, v]) => v === motivoStr);
      if (entry) codMotivoStr = entry[0];
    }
  }

  // Gerar linhas
  const linhas = [];
  // Se não mapeamos um código perfeitamente, usa o primeiro como fallback
  const codigoUsado = codigos[0] || "1";
  const materialInfo = buscarMaterial(codigoUsado, auxiliares);

  const qtdRecebida = isRecebimento ? 1 : 0;
  const qtdBaixa = !isRecebimento ? (afiacao.tipo_formulario === "BAIXAS DE EMENDAS E BOLSAS" ? (parseInt(detalhes.quantidade) || 1) : 1) : 0;

  linhas.push({
    letra: afiacao.letra,
    codigo: codigoUsado,
    material: materialInfo.material,
    equipamento: afiacao.maquina || "-",
    modulo: afiacao.modulo,
    afiador: afiacao.afiador,
    numCorrenteCabecote,
    codMotivo: codMotivoStr,
    motivo: motivoStr,
    mes,
    numFicha: "", // Poderia ser um id ou número de controle
    novoVelho: "", // Campo para futuro
    qtdExpedida: qtdRecebida,
    codMotivo2: codMotivoStr, // Repetido conforme imagem
    motivo2: motivoStr, // Repetido conforme imagem
    qtdBaixa,
    semana,
    data: dataFormatada,
    ni: materialInfo.ni,
    valorUnitario: materialInfo.custo,
    valorTotal: materialInfo.custo * (qtdRecebida || qtdBaixa || 1)
  });

  return linhas;
}

export default function PlanilhaLancamentos({ afiacoes, auxiliares = [] }: { afiacoes: any[]; auxiliares?: any[] }) {
  // Gerar todas as linhas
  const linhas = afiacoes.flatMap(a => extrairLinhas(a, auxiliares));

  return (
    <div className="overflow-x-auto w-full">
      <table className="min-w-full divide-y divide-gray-200 border border-gray-300">
        <thead className="bg-[#00B050] text-black">
          <tr>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">LETRA</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">CÓD.</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">Material</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">EQUIPAMENTO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">MÓDULO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">AFIADOR</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">Nº CORRENTE/CAB</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">COD. MOTIVO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">MOTIVO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">MÊS</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">Nº FICHA</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">NOVO/VELHO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">Qtd Expedida</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">COD. MOTIVO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">MOTIVO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black bg-red-100 text-red-800">Qtd Baixa</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">SEMANA</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">Data</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black">NI</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black text-blue-800">VALOR UNITÁRIO</th>
            <th className="px-2 py-1 text-left text-xs font-bold border-r border-black text-blue-800">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-300">
          {linhas.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50">
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.letra}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.codigo}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.material}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.equipamento}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.modulo}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.afiador}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.numCorrenteCabecote}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.codMotivo}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.motivo}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.mes}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.numFicha}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.novoVelho}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.qtdExpedida > 0 ? row.qtdExpedida : ""}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.codMotivo2}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.motivo2}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center font-bold text-red-600">{row.qtdBaixa > 0 ? row.qtdBaixa : ""}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.semana}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300">{row.data}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-center">{row.ni}</td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-right">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valorUnitario)}
              </td>
              <td className="px-2 py-1 whitespace-nowrap text-xs border-r border-gray-300 text-right font-semibold">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(row.valorTotal)}
              </td>
            </tr>
          ))}
          {linhas.length === 0 && (
            <tr>
              <td colSpan={21} className="px-4 py-8 text-center text-gray-500">
                Nenhum lançamento encontrado.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
