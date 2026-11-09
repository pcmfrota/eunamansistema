"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";
import { ExecucaoProgramacao, TipoProgramacao, FotoEvidencia, StatusExecucao } from "./types";

export async function getExecucoesProgramacao(): Promise<ExecucaoProgramacao[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("programacao_mecanica_execucoes")
    .select("*")
    .order("data_programada", { ascending: false });
  if (error) {
    console.error("Erro getExecucoesProgramacao:", error);
    return [];
  }
  return (data || []) as ExecucaoProgramacao[];
}

export async function salvarExecucaoProgramacao(payload: {
  id?: string;
  equipamento_id: string | null;
  placa: string;
  tipo_programacao: TipoProgramacao;
  periodicidade: "quinzenal" | "semanal";
  data_programada: string;
  data_execucao: string | null;
  status: StatusExecucao;
  km: number | null;
  horimetro: number | null;
  responsavel_execucao: string | null;
  responsavel_acompanhamento: string | null;
  observacoes: string | null;
  fotos: FotoEvidencia[];
  dados_extra: Record<string, any>;
}) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };

    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const criadoPorNome = profile?.full_name || user.email || "Usuário";

    const { cookies } = await import("next/headers");
    const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";

    const { data, error } = await supabase
      .from("programacao_mecanica_execucoes")
      .upsert(
        {
          ...(payload.id ? { id: payload.id } : {}),
          equipamento_id: payload.equipamento_id,
          placa: payload.placa.toUpperCase().trim(),
          tipo_programacao: payload.tipo_programacao,
          periodicidade: payload.periodicidade,
          data_programada: payload.data_programada,
          data_execucao: payload.data_execucao,
          status: payload.status,
          km: payload.km,
          horimetro: payload.horimetro,
          responsavel_execucao: payload.responsavel_execucao,
          responsavel_acompanhamento: payload.responsavel_acompanhamento,
          observacoes: payload.observacoes,
          fotos: payload.fotos,
          dados_extra: payload.dados_extra,
          criado_por: user.id,
          criado_por_nome: criadoPorNome,
          filial_id: filialId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "placa,tipo_programacao,data_programada" }
      )
      .select()
      .single();

    if (error) return { error: error.message };

    revalidatePath("/programacao-mecanica");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function excluirExecucaoProgramacao(id: string) {
  try {
    const supabase = createClient();

    let snapshot: any = null;
    try {
      const { data } = await supabase.from("programacao_mecanica_execucoes").select("*").eq("id", id).maybeSingle();
      snapshot = data;
    } catch (err) {
      console.warn("Falha ao capturar snapshot antes da exclusão:", err);
    }

    const { error } = await supabase.from("programacao_mecanica_execucoes").delete().eq("id", id);
    if (error) return { error: error.message };

    await registrarExclusao({
      supabase,
      modulo: "Programação Mecânica",
      tabelaOrigem: "programacao_mecanica_execucoes",
      registroId: id,
      descricao: snapshot ? `${snapshot.placa} — ${snapshot.tipo_programacao} (${snapshot.data_programada})` : null,
      dados: snapshot,
    });

    revalidatePath("/programacao-mecanica");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
