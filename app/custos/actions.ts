"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao, registrarExclusoesEmLote } from "@/lib/audit-log";

export type StatusCusto = "PAGO" | "AG_PAGAMENTO" | "FATURADO";
export type TipoManutencaoCusto = "CORRETIVA" | "PREVENTIVA" | "PREDITIVA";

export type CustoManutencao = {
  id: string;
  data: string;
  placa: string;
  tipo_manutencao: TipoManutencaoCusto;
  descricao: string;
  fornecedor: string | null;
  pecas: number;
  mao_obra: number;
  status: StatusCusto;
  observacoes: string | null;
  anexo_url: string | null;
  registrado_por: string | null;
  registrado_por_nome: string | null;
  filial_id: string;
  created_at?: string;
  updated_at?: string;
};

export type Fornecedor = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  filial_id: string;
  created_at?: string;
  updated_at?: string;
};

// Mesmo padrão de app/pneus/actions.ts — identifica quem está lançando/editando o registro.
async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { registrado_por: null, registrado_por_nome: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    registrado_por: user.id,
    registrado_por_nome: profile?.full_name || user.email || "Usuário",
  };
}

export async function getCustos() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custos_manutencao")
    .select("*")
    .order("data", { ascending: false });

  if (error) {
    console.error("Erro getCustos:", error);
    return [];
  }
  return data as CustoManutencao[];
}

export async function getFornecedores() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("custos_fornecedores")
    .select("*")
    .order("nome_fantasia", { ascending: true });

  if (error) {
    console.error("Erro getFornecedores:", error);
    return [];
  }
  return data as Fornecedor[];
}

export async function upsertFornecedor(formData: FormData) {
  try {
    const supabase = createClient();

    const id = formData.get("id") as string | null;
    const payload = {
      nome_fantasia: String(formData.get("nome_fantasia") || "").trim(),
      razao_social: (formData.get("razao_social") as string)?.trim() || null,
    };

    if (!payload.nome_fantasia) return { error: "Nome fantasia é obrigatório" };

    if (id) {
      const { error } = await supabase.from("custos_fornecedores").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { cookies } = await import("next/headers");
      const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";
      const { error } = await supabase.from("custos_fornecedores").insert({ ...payload, filial_id: filialId });
      if (error) throw error;
    }

    revalidatePath("/custos");
    return { success: true };
  } catch (error: any) {
    if (error?.code === "23505") return { error: "Já existe um fornecedor com esse nome fantasia." };
    return { error: error.message || "Erro ao salvar fornecedor" };
  }
}

export async function deleteFornecedor(id: string) {
  try {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from("custos_fornecedores").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn("[deleteFornecedor] Falha ao buscar snapshot antes da exclusão:", err);
    }

    const { error } = await supabase.from("custos_fornecedores").delete().eq("id", id);
    if (error) throw error;

    await registrarExclusao({
      supabase,
      modulo: "Controle de Custos — Fornecedores",
      tabelaOrigem: "custos_fornecedores",
      registroId: id,
      descricao: row?.nome_fantasia || null,
      dados: row,
    });

    revalidatePath("/custos");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao excluir fornecedor" };
  }
}

export async function upsertCusto(formData: FormData) {
  try {
    const supabase = createClient();

    const id = formData.get("id") as string | null;
    const payload = {
      data: formData.get("data") as string,
      placa: String(formData.get("placa") || "").toUpperCase().trim(),
      tipo_manutencao: formData.get("tipo_manutencao") as string,
      descricao: formData.get("descricao") as string,
      fornecedor: (formData.get("fornecedor") as string) || null,
      pecas: parseFloat((formData.get("pecas") as string) || "0") || 0,
      mao_obra: parseFloat((formData.get("mao_obra") as string) || "0") || 0,
      status: formData.get("status") as string,
      observacoes: (formData.get("observacoes") as string) || null,
      anexo_url: (formData.get("anexo_url") as string) || null,
    };

    if (id) {
      const { error } = await supabase.from("custos_manutencao").update(payload).eq("id", id);
      if (error) throw error;
    } else {
      const { cookies } = await import("next/headers");
      const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";
      const usuario = await getUsuarioAtual(supabase);
      const { error } = await supabase.from("custos_manutencao").insert({
        ...payload,
        filial_id: filialId,
        ...usuario,
      });
      if (error) throw error;
    }

    revalidatePath("/custos");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao salvar lançamento" };
  }
}

export async function deleteCusto(id: string) {
  try {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from("custos_manutencao").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn("[deleteCusto] Falha ao buscar snapshot antes da exclusão:", err);
    }

    const { error } = await supabase.from("custos_manutencao").delete().eq("id", id);
    if (error) throw error;

    await registrarExclusao({
      supabase,
      modulo: "Controle de Custos",
      tabelaOrigem: "custos_manutencao",
      registroId: id,
      descricao: row ? `${row.placa} — ${row.descricao} (R$ ${(Number(row.pecas) + Number(row.mao_obra)).toFixed(2)})` : null,
      dados: row,
    });

    revalidatePath("/custos");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao excluir lançamento" };
  }
}

export async function bulkDeleteCustos(ids: string[]) {
  try {
    if (!ids.length) return { success: true };
    const supabase = createClient();

    let rows: any[] = [];
    try {
      const { data } = await supabase.from("custos_manutencao").select("*").in("id", ids);
      rows = data || [];
    } catch (err) {
      console.warn("[bulkDeleteCustos] Falha ao buscar snapshot antes da exclusão:", err);
    }

    const { error } = await supabase.from("custos_manutencao").delete().in("id", ids);
    if (error) throw error;

    await registrarExclusoesEmLote(
      supabase,
      "Controle de Custos",
      "custos_manutencao",
      rows.map((r) => ({
        registroId: r.id,
        descricao: `${r.placa} — ${r.descricao} (R$ ${(Number(r.pecas) + Number(r.mao_obra)).toFixed(2)})`,
        dados: r,
      }))
    );

    revalidatePath("/custos");
    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao excluir lançamentos" };
  }
}

// Importação de planilha — aditiva (só insere). Diferente de app/documentos/actions.ts's
// importarDocumentos, aqui NÃO apaga lançamentos existentes da mesma placa antes de importar:
// cada placa acumula um histórico de vários custos ao longo do tempo, então "substituir por
// placa" destruiria lançamentos antigos que não têm nada a ver com o arquivo importado agora.
export async function importarCustos(rows: any[]) {
  try {
    const supabase = createClient();
    const { cookies } = await import("next/headers");
    const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";
    const usuario = await getUsuarioAtual(supabase);

    // Compara ignorando acentos/espaços/pontuação e aceita a chave real conter o alias (não só
    // ser igual) — cabeçalhos reais costumam vir decorados ("Descrição do Serviço",
    // "Peças (R$)", "Fornecedor / Oficina"), então uma igualdade exata nunca bateria.
    const normalizarChave = (v: string) =>
      v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const getVal = (row: any, aliases: string[]) => {
      const chaves = Object.keys(row).map((k) => ({ original: k, norm: normalizarChave(k) }));
      for (const alias of aliases) {
        const aliasNorm = normalizarChave(alias);
        const encontrada = chaves.find((c) => c.norm === aliasNorm || c.norm.includes(aliasNorm));
        if (encontrada) {
          const val = row[encontrada.original];
          if (val !== undefined && val !== null && val !== "") return val;
        }
      }
      return null;
    };

    const parseData = (raw: any): string | null => {
      if (!raw) return null;
      if (typeof raw === "number") {
        return new Date((raw - 25569) * 86400 * 1000).toISOString().slice(0, 10);
      }
      const str = String(raw).trim();
      if (str.includes("/")) {
        const [d, m, y] = str.split("/");
        if (d && m && y) return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      if (str.includes("-")) return str.slice(0, 10);
      return null;
    };

    const parseMoeda = (raw: any): number => {
      if (raw == null || raw === "") return 0;
      if (typeof raw === "number") return raw;
      const limpo = String(raw).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3},)/g, "").replace(",", ".");
      const num = parseFloat(limpo);
      return isNaN(num) ? 0 : num;
    };

    const mapped = rows.map((row) => {
      const placa = String(getVal(row, ["placa", "veiculo", "veículo"]) || "").toUpperCase().trim();
      const data = parseData(getVal(row, ["data", "data_lancamento"]));
      const descricao = String(getVal(row, ["descricao", "descrição", "descricao_servico", "servico", "serviço"]) || "").trim();
      if (!placa || !data || !descricao) return null;

      // Cuidado: "AG" é substring de "PAGO" (P-AG-O), então checar "inclui AG" pra achar
      // "Aguardando" também casava com "Pago" sozinho por engano. "PAGAMENTO" (presente em
      // "Ag. Pagamento"/"Aguardando Pagamento" mas não em "Pago") é o que realmente distingue.
      const statusRaw = String(getVal(row, ["status"]) || "AG_PAGAMENTO").toUpperCase().trim();
      const status: StatusCusto =
        statusRaw.includes("FATURA") ? "FATURADO" :
        statusRaw.includes("PAGAMENTO") || statusRaw.includes("PEND") ? "AG_PAGAMENTO" :
        statusRaw.includes("PAGO") ? "PAGO" : "AG_PAGAMENTO";

      const tipoRaw = String(getVal(row, ["tipo_manutencao", "tipo", "tipo de manutenção"]) || "CORRETIVA").toUpperCase().trim();
      const tipo_manutencao: TipoManutencaoCusto =
        tipoRaw.startsWith("PREV") ? "PREVENTIVA" : tipoRaw.startsWith("PREDIT") ? "PREDITIVA" : "CORRETIVA";

      return {
        data,
        placa,
        tipo_manutencao,
        descricao,
        fornecedor: (getVal(row, ["fornecedor", "oficina"]) as string) || null,
        pecas: parseMoeda(getVal(row, ["pecas", "peças", "peças (r$)"])),
        mao_obra: parseMoeda(getVal(row, ["mao_obra", "mão de obra", "mão de obra (r$)"])),
        status,
        observacoes: (getVal(row, ["observacoes", "observações", "pc", "pedido de compra"]) as string) || null,
        filial_id: filialId,
        ...usuario,
      };
    }).filter(Boolean);

    if (mapped.length === 0) {
      return { error: "Nenhum registro válido encontrado para importação (verifique as colunas Data, Placa e Descrição)." };
    }

    const { error } = await supabase.from("custos_manutencao").insert(mapped);
    if (error) throw error;

    revalidatePath("/custos");
    return { success: true, count: mapped.length };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
