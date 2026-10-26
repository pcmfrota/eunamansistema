"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";

export type FiltroImplementoFoto = { d: string; w: number; h: number };

export type ControleFiltroImplemento = {
  id: string;
  placa: string;
  tipo_equipamento: string | null;
  data_troca: string;
  evidencias: FiltroImplementoFoto[];
  observacoes: string | null;
  criado_por: string | null;
  criado_por_nome: string | null;
  filial_id: string;
  created_at?: string;
};

export async function getControleFiltrosImplemento(): Promise<ControleFiltroImplemento[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("controle_filtros_implemento")
    .select("*")
    .order("data_troca", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("Erro getControleFiltrosImplemento:", error);
    return [];
  }
  return data || [];
}

export async function salvarLancamentoFiltroImplemento(payload: {
  placa: string;
  tipo_equipamento: string | null;
  data_troca: string;
  evidencias: FiltroImplementoFoto[];
  observacoes: string | null;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let criadoPorNome: string | null = null;
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      criadoPorNome = profile?.full_name || user.email || "Usuário";
    }

    const { cookies } = await import("next/headers");
    const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";

    const { data, error } = await supabase
      .from("controle_filtros_implemento")
      .insert({
        ...payload,
        placa: payload.placa.toUpperCase().trim(),
        criado_por: user?.id || null,
        criado_por_nome: criadoPorNome,
        filial_id: filialId,
      })
      .select()
      .single();
    if (error) return { error: error.message };

    revalidatePath("/controle-filtros");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function excluirLancamentoFiltroImplemento(id: string) {
  try {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from("controle_filtros_implemento").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn("Falha ao buscar snapshot de controle_filtros_implemento antes de excluir:", err);
    }

    const { error } = await supabase.from("controle_filtros_implemento").delete().eq("id", id);
    if (error) return { error: error.message };

    await registrarExclusao({
      supabase,
      modulo: "Controle de Filtros do Implemento",
      tabelaOrigem: "controle_filtros_implemento",
      registroId: id,
      descricao: row ? `${row.placa} — troca em ${row.data_troca}` : null,
      dados: row,
    });

    revalidatePath("/controle-filtros");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
