"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { MATERIAIS_DB } from "./materiaisDB";

export async function salvarAfiacao(data: any) {
  try {
    const { data: inserted, error } = await supabase
      .from("afiacao")
      .insert([
        {
          data: data.data,
          afiador: data.afiador,
          modulo: data.modulo,
          maquina: data.maquina,
          letra: data.letra,
          kit: data.kit,
          tipo_formulario: data.tipo_formulario,
          detalhes: data.detalhes
        }
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, data: inserted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function atualizarAfiacao(id: string, data: any) {
  try {
    const { data: updated, error } = await supabase
      .from("afiacao")
      .update({
        data: data.data,
        afiador: data.afiador,
        modulo: data.modulo,
        maquina: data.maquina,
        letra: data.letra,
        kit: data.kit,
        tipo_formulario: data.tipo_formulario,
        detalhes: data.detalhes
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletarAfiacao(id: string) {
  try {
    const { error } = await supabase
      .from("afiacao")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listarAfiacoes() {
  try {
    const { data, error } = await supabase
      .from("afiacao")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao listar afiacoes:", err);
    return [];
  }
}

// Ações para a tabela aux_afiacao (banco de dados auxiliar)
export async function buscarAuxiliaresAfiacao() {
  try {
    const { data, error } = await supabase
      .from("aux_afiacao")
      .select("*")
      .order("value", { ascending: true });

    if (error) {
      console.warn("Erro ao buscar aux_afiacao, tabela pode não existir:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Erro ao buscar auxiliares:", err);
    return [];
  }
}

export async function salvarAuxiliarAfiacao(category: string, value: string, modulo?: string, metadata?: any, id?: string) {
  try {
    const val = value.trim().toUpperCase();
    if (!val) return { error: "Valor não pode ser vazio" };

    const payload: any = { 
      category, 
      value: val, 
      modulo: modulo || null 
    };

    if (id && !id.startsWith("default-")) {
      payload.id = id;
    }

    if (metadata && Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    const { error } = await supabase
      .from("aux_afiacao")
      .upsert(
        payload,
        payload.id ? undefined : { onConflict: "category, modulo, value" }
      );

    if (error) throw error;
    
    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function importarPadroesAuxiliares() {
  try {
    const payload = MATERIAIS_DB.map(m => ({
      category: "material",
      modulo: null,
      value: m.material.toUpperCase(),
      metadata: {
        codigo: m.cod,
        ni: m.ni,
        custo: m.custo,
        tipo: m.tipo
      }
    }));

    const { error } = await supabase
      .from("aux_afiacao")
      .upsert(payload, { onConflict: "category, modulo, value" });

    if (error) throw error;
    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function excluirAuxiliarAfiacao(id: string) {
  try {
    const { error } = await supabase
      .from("aux_afiacao")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Auxiliar para parsear datas vindas de planilhas Excel (serial ou string)
function parseExcelDate(val: any): string {
  if (!val) return new Date().toISOString().split("T")[0];
  if (typeof val === "number") {
    // Datas no Excel começam em 30/12/1899 devido a bugs históricos
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split("T")[0];
  }
  if (typeof val === "string") {
    const clean = val.trim();
    // Formato brasileiro DD/MM/YYYY
    const partes = clean.split("/");
    if (partes.length === 3) {
      const dia = partes[0].trim().padStart(2, "0");
      const mes = partes[1].trim().padStart(2, "0");
      const ano = partes[2].trim();
      return `${ano}-${mes}-${dia}`;
    }
    // Formato YYYY-MM-DD
    const isoPartes = clean.split("-");
    if (isoPartes.length === 3) {
      return clean;
    }
  }
  return new Date().toISOString().split("T")[0];
}

// Auxiliar para parsear números do Excel com suporte a formato brasileiro/europeu (ex: 1,000 ou 1.000,50)
function parseExcelNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const clean = String(val).trim().replace(/[^\d.,-]/g, ""); // Remove tudo exceto dígitos, pontos, vírgulas e traço
  if (!clean || clean === "-" || clean.toUpperCase() === "N/D") return 0;

  if (clean.includes(",") && !clean.includes(".")) {
    const parts = clean.split(",");
    if (parts[1].length === 3) {
      return parseFloat(clean.replace(",", ""));
    } else {
      return parseFloat(clean.replace(",", "."));
    }
  }
  if (clean.includes(".") && clean.includes(",")) {
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(clean);
}

// Helper: limpa string para comparação (remove acentos, espaços, pontuação, lowercase)
function normalizeKey(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]/g, "");     // remove tudo exceto letras/números
}

// Helper: sanitiza valor — se for fórmula quebrada ou traço, retorna ""
function sanitizeVal(v: any): string {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (["", "-", "#REF!", "#VALOR!", "#VALUE!", "#N/D", "#N/A", "N/D", "N/A"].includes(s.toUpperCase())) return "";
  return s;
}

// Importação em lote de lançamentos de afiação
// Mapeamento baseado nos nomes EXATOS das colunas da planilha Suzano (normalizado):
//   cod | material | equipamento | modulo | nakit | naficha | fichafisica | novovelho |
//   qtdexpedida | codmotivo | motivo | qtdbaixas | un | semana | data | carga |
//   ni | cc | statusbaixa | uni | centro | movi | dep | custo
// Helper para obter Centro de Custo (CC) a partir da máquina
function obterCCPorEquipamento(maquina: string): string {
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

// Helper para determinar o código do material com base no NI e Descrição
function determinarCodigoPorNiEDesc(niValue: any, descValue: any): string {
  const cleanNi = String(niValue || "").replace(/[^\d]/g, "").trim();
  const desc = String(descValue || "").toUpperCase();

  if (cleanNi === "25301352") {
    if (desc.includes("V132")) return "12";
    if (desc.includes("370E")) return "13";
    return "12";
  }

  // Buscar correspondência direta no MATERIAIS_DB
  const found = MATERIAIS_DB.find(m => m.ni.replace(/[^\d]/g, "").trim() === cleanNi);
  if (found) return found.cod;

  // Fallback por descrição
  if (descValue) {
    const descUpper = String(descValue).toUpperCase().trim();
    const foundDesc = MATERIAIS_DB.find(m => descUpper.includes(m.material.toUpperCase()) || m.material.toUpperCase().includes(descUpper));
    if (foundDesc) return foundDesc.cod;
  }

  return "";
}

export async function importarAfiacoes(dataInput: any, defaultAfiador?: string) {
  try {
    let sheets: { sheetName: string; rows: any[] }[] = [];
    
    if (Array.isArray(dataInput)) {
      sheets = [{ sheetName: "Suzano Afiação", rows: dataInput }];
    } else if (dataInput && Array.isArray(dataInput.sheets)) {
      sheets = dataInput.sheets;
    } else {
      throw new Error("Formato de dados inválido para importação.");
    }

    // Pré-construir mapas e funções auxiliares
    const buildKeyMap = (row: any): Record<string, string> => {
      const map: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        map[normalizeKey(k)] = k;
      }
      return map;
    };

    const getExact = (keyMap: Record<string, string>, row: any, normalizedNames: string[]): any => {
      for (const name of normalizedNames) {
        const originalKey = keyMap[name];
        if (originalKey !== undefined) {
          return row[originalKey];
        }
      }
      return undefined;
    };

    const mapped: any[] = [];

    for (const sheet of sheets) {
      const sheetNameNorm = normalizeKey(sheet.sheetName);
      const rows = sheet.rows;

      for (const row of rows) {
        const km = buildKeyMap(row);
        const g = (...names: string[]) => {
          const raw = getExact(km, row, names);
          return sanitizeVal(raw);
        };

        // Identificar tipo de planilha com base nas colunas ou nome da aba
        const hasOrigemDestino = km["origem"] !== undefined && km["destino"] !== undefined;
        const hasReferenciaQtd = km["referencia"] !== undefined && km["quantidade"] !== undefined;
        const hasFichaEunaman = km["fichaeunaman"] !== undefined || km["afiacao"] !== undefined;

        if (sheetNameNorm.includes("transferencias") || sheetNameNorm.includes("transferencia") || (hasOrigemDestino && hasFichaEunaman)) {
          // ── PLANILHA DE TRANSFERÊNCIAS (ENTRADAS) ──────────────────────────
          const dataRaw       = g("data", "date");
          const origem        = g("origem");
          const destino       = g("destino", "dep");
          const quantidadeRaw = g("quantidade", "qtd");
          const ficha         = g("fichaeunaman", "ficha");
          const afiacao       = g("afiacao", "nomeafiador");
          const itemNi        = g("item", "ni");
          const desc          = g("descricao", "ref");
          const status        = g("status");

          const data = parseExcelDate(dataRaw || "");
          const quantidade = parseExcelNumber(quantidadeRaw || 0);
          const cod = determinarCodigoPorNiEDesc(itemNi, desc);

          mapped.push({
            data,
            afiador: afiacao.toUpperCase().trim() || defaultAfiador || "IMPORTADO",
            modulo: "MA05",
            maquina: "ESTOQUE",
            letra: "A",
            kit: "1",
            tipo_formulario: "TRANSFERÊNCIA",
            detalhes: {
              cod,
              ni: itemNi,
              desc,
              qtd_expedida: String(quantidade),
              qtd_baixas: "0",
              dep: destino.toUpperCase().trim() || origem.toUpperCase().trim() || "AF01",
              origem: origem.toUpperCase().trim(),
              destino: destino.toUpperCase().trim(),
              ficha,
              status
            }
          });

        } else if (sheetNameNorm.includes("baixaestoque") || sheetNameNorm.includes("baixa") || (hasReferenciaQtd && km["controle"] !== undefined)) {
          // ── PLANILHA DE BAIXA-ESTOQUE (SAÍDAS) ─────────────────────────────
          const dataRaw       = g("data", "date");
          const maquina       = g("maquina", "equipamento", "veiculo", "placa");
          const codigoNi      = g("codigo", "cod", "ni");
          const referencia    = g("referencia", "desc", "ref");
          const quantidadeRaw = g("quantidade", "qtd");
          const controle      = g("controle", "ficha");
          const dep           = g("dep", "destino");
          const modulo        = g("modulo", "mod") || "MA05";

          const data = parseExcelDate(dataRaw || "");
          const rawQtd = parseExcelNumber(quantidadeRaw || 0);
          const cod = determinarCodigoPorNiEDesc(codigoNi, referencia);

          let qtdBaixas = rawQtd;
          if (cod === "12" || cod === "13" || cod === "14") {
            qtdBaixas = Math.round(rawQtd * 0.057 * 1000) / 1000;
          }

          mapped.push({
            data,
            afiador: defaultAfiador || "IMPORTADO",
            modulo: modulo.toUpperCase().trim(),
            maquina: maquina.toUpperCase().trim(),
            letra: "A",
            kit: "1",
            tipo_formulario: "BAIXA-ESTOQUE",
            detalhes: {
              cod,
              ni: codigoNi,
              desc: referencia,
              qtd_expedida: String(rawQtd),
              qtd_baixas: String(qtdBaixas),
              dep: dep.toUpperCase().trim() || "AF01",
              ficha: controle,
              cc: obterCCPorEquipamento(maquina)
            }
          });

        } else {
          // ── PLANILHA TRADICIONAL SUZANO AFIAÇÃO ───────────────────────────
          const codMaterial   = g("cod", "cdg");
          const equipamento   = g("equipamento", "maquina", "veiculo", "placa");
          const modulo        = g("modulo", "mod") || "MA05";
          const kit           = g("nakit", "nkit", "kit") || "1";
          const numFicha      = g("naficha", "nficha", "numficha");
          const fichaFisica   = g("fichafisica", "fisica") || "OK";
          const novoVelho     = g("novovelho", "novo") || "NOVO";
          const qtdExpedidaRaw = g("qtdexpedida", "qtdexp");
          const codMotivo     = g("codmotivo", "codmot");
          const motivo        = g("motivo");
          const qtdBaixasRaw  = g("qtdbaixas", "baixas", "baixa");
          const un            = g("un", "unidade");
          const dataRaw       = g("data", "date");
          const carga         = g("carga") || "1";
          const ni            = g("ni");
          const cc            = g("cc");
          const statusBaixa   = g("statusbaixa");
          const uni           = g("uni") || "20";
          const centro        = g("centro");
          const movi          = g("movi", "movimento");
          const dep           = g("dep", "departamento");
          const afiador       = g("afiador", "nomeafiador") || defaultAfiador || "IMPORTADO";
          const letra         = g("letra") || "A";

          const qtdExpedida = parseExcelNumber(qtdExpedidaRaw || 0);
          const qtdBaixas   = parseExcelNumber(qtdBaixasRaw || 0);
          const data = parseExcelDate(dataRaw || "");

          let tipo_formulario = "BAIXA DE MATERIAL CORRENTE";
          if (codMaterial === "15")                                      tipo_formulario = "BAIXA DE MATERIAL ROLLTOP";
          else if (codMaterial === "20")                                 tipo_formulario = "BAIXA DE CHAPA MAQNOVA";
          else if (codMaterial === "40")                                 tipo_formulario = "BAIXA DE CHAPA ROTARY-AX";
          else if (["16","17","18","21","23"].includes(codMaterial))     tipo_formulario = "BAIXA DE MATERIAL SABRE";
          else if (["2","3","10","22"].includes(codMaterial))            tipo_formulario = "BAIXAS DE EMENDAS E BOLSAS";
          else if (qtdExpedida > 0 && qtdBaixas === 0)                  tipo_formulario = "ESTADO DE RECEBIMENTO CORRENTE";

          mapped.push({
            data,
            afiador: afiador.toUpperCase().trim(),
            modulo: modulo.toUpperCase().trim(),
            maquina: equipamento.toUpperCase().trim(),
            letra: letra.toUpperCase().trim(),
            kit: kit.trim(),
            tipo_formulario,
            detalhes: {
              cod:          codMaterial,
              num_ficha:    numFicha,
              ficha_fisica: fichaFisica.toUpperCase(),
              novo_velho:   novoVelho.toUpperCase(),
              carga:        carga,
              uni:          uni,
              qtd_expedida: String(qtdExpedida),
              qtd_baixas:   String(qtdBaixas),
              cc:           cc,
              status_baixa: statusBaixa,
              un:           un,
              ni:           ni,
              centro:       centro,
              movi:         movi,
              dep:          dep || "AF01",
              cod_motivo:   codMotivo.toUpperCase(),
              motivo:       motivo.toUpperCase(),
              corrente:     "1",
              sabre:        "1"
            }
          });
        }
      }
    }

    if (mapped.length === 0) {
      return { success: false, error: "Nenhuma linha válida encontrada para importar." };
    }

    const { data: inserted, error } = await supabase
      .from("afiacao")
      .insert(mapped)
      .select();

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, count: inserted?.length || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Excluir TODOS os lançamentos da base de afiação
export async function excluirTodasAfiacoes() {
  try {
    const { error } = await supabase
      .from("afiacao")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) throw error;
    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

