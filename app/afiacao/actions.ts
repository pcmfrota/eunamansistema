"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

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

export async function salvarAuxiliarAfiacao(category: string, value: string, modulo?: string, metadata?: any) {
  try {
    const val = value.trim().toUpperCase();
    if (!val) return { error: "Valor não pode ser vazio" };

    const { error } = await supabase
      .from("aux_afiacao")
      .upsert(
        { 
          category, 
          value: val, 
          modulo: modulo || null,
          metadata: metadata || {} 
        },
        { onConflict: "category, modulo, value" }
      );

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
export async function importarAfiacoes(rows: any[], defaultAfiador?: string) {
  try {
    // Pré-construir mapa de chaves normalizadas → chave original para cada linha
    const buildKeyMap = (row: any): Record<string, string> => {
      const map: Record<string, string> = {};
      for (const k of Object.keys(row)) {
        map[normalizeKey(k)] = k;
      }
      return map;
    };

    // Buscar valor pelo nome normalizado da coluna (somente exact match)
    const getExact = (keyMap: Record<string, string>, row: any, normalizedNames: string[]): any => {
      for (const name of normalizedNames) {
        const originalKey = keyMap[name];
        if (originalKey !== undefined) {
          return row[originalKey];
        }
      }
      return undefined;
    };

    const mapped = rows.map((row: any) => {
      const km = buildKeyMap(row);

      const g = (...names: string[]) => {
        const raw = getExact(km, row, names);
        return sanitizeVal(raw);
      };

      // ── Campos principais da planilha Suzano ─────────────────────────────
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

      // ── Parsear números ──────────────────────────────────────────────────
      const qtdExpedida = parseExcelNumber(qtdExpedidaRaw || 0);
      const qtdBaixas   = parseExcelNumber(qtdBaixasRaw || 0);

      // ── Parsear data ─────────────────────────────────────────────────────
      const data = parseExcelDate(dataRaw || "");

      // ── Determinar tipo_formulario ────────────────────────────────────────
      let tipo_formulario = "BAIXA DE MATERIAL CORRENTE";
      if (codMaterial === "15")                                      tipo_formulario = "BAIXA DE MATERIAL ROLLTOP";
      else if (codMaterial === "20")                                 tipo_formulario = "BAIXA DE CHAPA MAQNOVA";
      else if (codMaterial === "40")                                 tipo_formulario = "BAIXA DE CHAPA ROTARY-AX";
      else if (["16","17","18","21","23"].includes(codMaterial))     tipo_formulario = "BAIXA DE MATERIAL SABRE";
      else if (["2","3","10","22"].includes(codMaterial))            tipo_formulario = "BAIXAS DE EMENDAS E BOLSAS";
      else if (qtdExpedida > 0 && qtdBaixas === 0)                  tipo_formulario = "ESTADO DE RECEBIMENTO CORRENTE";

      return {
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
          dep:          dep,
          cod_motivo:   codMotivo.toUpperCase(),
          motivo:       motivo.toUpperCase(),
          corrente:     "1",
          sabre:        "1"
        }
      };
    });

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

