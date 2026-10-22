"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";

export type ChecklistComboio = {
  id: string;
  tipo_checklist: "RECEBIMENTO" | "DEVOLUCAO";
  empresa: string | null;
  placa: string;
  nucleo: string | null;
  mes: string | null;
  turno: string | null;
  marca_modelo: string | null;
  motorista: string | null;
  matricula_motorista: string | null;
  km: number | null;
  data_checklist: string;
  respostas: Record<string, string>;
  fotos: Record<string, string>;
  pendencias_adicionais: string | null;
  executante_nome: string | null;
  executante_mt: string | null;
  supervisor_nome: string | null;
  supervisor_mt: string | null;
  status: string;
  criado_por: string | null;
  criado_por_nome: string | null;
  filial_id: string;
  created_at?: string;
};

export async function getChecklistsComboio(): Promise<ChecklistComboio[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_comboio")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("Erro getChecklistsComboio:", error);
    return [];
  }
  return data || [];
}

export async function salvarChecklistComboio(payload: {
  tipo_checklist: "RECEBIMENTO" | "DEVOLUCAO";
  empresa: string | null;
  placa: string;
  nucleo: string | null;
  mes: string | null;
  turno: string | null;
  marca_modelo: string | null;
  motorista: string | null;
  matricula_motorista: string | null;
  km: number | null;
  data_checklist: string;
  respostas: Record<string, string>;
  fotos: Record<string, string>;
  pendencias_adicionais: string | null;
  executante_nome: string | null;
  executante_mt: string | null;
  supervisor_nome: string | null;
  supervisor_mt: string | null;
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
      .from("checklist_comboio")
      .insert({
        ...payload,
        status: "Fechado",
        criado_por: user?.id || null,
        criado_por_nome: criadoPorNome,
        filial_id: filialId,
      })
      .select()
      .single();
    if (error) return { error: error.message };

    revalidatePath("/checklist-comboio");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function excluirChecklistComboio(id: string) {
  try {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from("checklist_comboio").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn("Falha ao buscar snapshot de checklist_comboio antes de excluir:", err);
    }

    const { error } = await supabase.from("checklist_comboio").delete().eq("id", id);
    if (error) return { error: error.message };

    await registrarExclusao({
      supabase,
      modulo: "Checklist Comboio",
      tabelaOrigem: "checklist_comboio",
      registroId: id,
      descricao: row ? `${row.placa} — ${row.tipo_checklist} (${row.data_checklist})` : null,
      dados: row,
    });

    revalidatePath("/checklist-comboio");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
