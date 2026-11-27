"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";
import { BUCKET_CERTIFICADOS, validarBateria, type Bateria, type DadosBateria } from "@/lib/baterias";

export type CertificadoInfo = { path: string; nome: string; tipo: string };

export type SalvarBateriaPayload = DadosBateria & {
  /** Gerado no aparelho (crypto.randomUUID): o reenvio da fila offline cai no mesmo registro. */
  id: string;
  observacoes?: string | null;
  /**
   * undefined = mantém o certificado atual; null = remove; objeto = novo arquivo já enviado
   * ao Storage pelo aparelho (o anterior é apagado depois que o banco confirmar).
   */
  certificado?: CertificadoInfo | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function usuarioAtual(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre de novo no sistema." } as const;
  const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", user.id).maybeSingle();
  if (profile?.role === "visitante") return { error: "Perfil visitante não pode alterar o Controle de Baterias." } as const;
  return { id: user.id, nome: (profile?.full_name || user.email || "Usuário") as string } as const;
}

function mensagemErro(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "Já existe uma bateria cadastrada com este número de série.";
  if (error.code === "23514") return "Confira os dados: o vencimento da garantia deve ser depois da data da venda e os campos obrigatórios não podem ficar vazios.";
  if (error.code === "42501") return "Sem permissão para o Controle de Baterias.";
  return error.message || "Erro desconhecido.";
}

/** Cria ou edita uma bateria (o mesmo id reenviado pela fila offline vira edição, nunca duplica). */
export async function salvarBateria(payload: SalvarBateriaPayload): Promise<{ success: true; data: Bateria } | { error: string }> {
  try {
    if (!payload?.id || !UUID.test(payload.id)) return { error: "Identificador da bateria inválido." };
    const erroValidacao = validarBateria(payload);
    if (erroValidacao) return { error: erroValidacao };

    const supabase = createClient();
    const usuario = await usuarioAtual(supabase);
    if ("error" in usuario) return { error: usuario.error as string };

    const { data: existente, error: errBusca } = await supabase
      .from("controle_baterias").select("id, certificado_path").eq("id", payload.id).maybeSingle();
    if (errBusca) return { error: mensagemErro(errBusca) };

    const campos: Record<string, unknown> = {
      modelo: payload.modelo.trim(),
      numero_serie: payload.numero_serie.trim().toUpperCase(),
      fornecedor: payload.fornecedor.trim(),
      data_venda: payload.data_venda,
      data_vencimento_garantia: payload.data_vencimento_garantia,
      observacoes: payload.observacoes?.trim() || null,
    };
    if (payload.certificado !== undefined) {
      campos.certificado_path = payload.certificado?.path ?? null;
      campos.certificado_nome = payload.certificado?.nome ?? null;
      campos.certificado_tipo = payload.certificado?.tipo ?? null;
    }

    let resultado;
    if (existente) {
      resultado = await supabase
        .from("controle_baterias")
        .update({ ...campos, atualizado_por: usuario.id, atualizado_por_nome: usuario.nome, updated_at: new Date().toISOString() })
        .eq("id", payload.id)
        .select()
        .single();
    } else {
      const { cookies } = await import("next/headers");
      const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";
      resultado = await supabase
        .from("controle_baterias")
        .insert({ id: payload.id, ...campos, criado_por: usuario.id, criado_por_nome: usuario.nome, filial_id: filialId })
        .select()
        .single();
    }
    if (resultado.error) return { error: mensagemErro(resultado.error) };

    // Certificado trocado/removido: apaga o arquivo antigo só depois do banco confirmar.
    const antigo = existente?.certificado_path;
    if (payload.certificado !== undefined && antigo && antigo !== payload.certificado?.path) {
      const { error: errRemove } = await supabase.storage.from(BUCKET_CERTIFICADOS).remove([antigo]);
      if (errRemove) console.error("[Baterias] Falha ao apagar certificado antigo:", errRemove);
    }

    revalidatePath("/controle-baterias");
    return { success: true, data: resultado.data as Bateria };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/** Exclui a bateria e o certificado do Storage (registra no Histórico de Exclusões). */
export async function excluirBateria(id: string): Promise<{ success: true } | { error: string }> {
  try {
    const supabase = createClient();
    const usuario = await usuarioAtual(supabase);
    if ("error" in usuario) return { error: usuario.error as string };

    const { data: row, error: errBusca } = await supabase.from("controle_baterias").select("*").eq("id", id).maybeSingle();
    if (errBusca) return { error: mensagemErro(errBusca) };
    if (!row) return { success: true }; // já excluída (ex.: reenvio da fila offline)

    const { data: apagados, error } = await supabase.from("controle_baterias").delete().eq("id", id).select("id");
    if (error) return { error: mensagemErro(error) };
    if (!apagados?.length) return { error: "O banco não permitiu excluir esta bateria (sem permissão ou de outra filial)." };

    if (row.certificado_path) {
      const { error: errRemove } = await supabase.storage.from(BUCKET_CERTIFICADOS).remove([row.certificado_path]);
      if (errRemove) console.error("[Baterias] Falha ao apagar certificado:", errRemove);
    }

    await registrarExclusao({
      supabase,
      modulo: "Controle de Baterias",
      tabelaOrigem: "controle_baterias",
      registroId: id,
      descricao: `${row.modelo} — nº de série ${row.numero_serie}`,
      dados: row,
    });

    revalidatePath("/controle-baterias");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
