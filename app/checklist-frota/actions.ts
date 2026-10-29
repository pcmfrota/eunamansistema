"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao } from "@/lib/audit-log";
import { ItemResposta, Foto, Avaria, Assinatura, FrotaKey, TipoChecklist, Resultado } from "./checklistFrotaConfig";

export type ChecklistFrota = {
  id: string;
  tipo_checklist: TipoChecklist;
  frota_tipo: FrotaKey;
  placa: string;
  frota: string | null;
  marca_modelo: string | null;
  nucleo: string | null;
  km: number | null;
  horimetro: number | null;
  registradora_diesel: number | null;
  registradora_insumo: number | null;
  saldo_tanque: number | null;
  local: string | null;
  data_checklist: string;
  hora: string | null;
  mecanico: string | null;
  matricula_mecanico: string | null;
  responsavel_recebe: string | null;
  respostas: Record<string, ItemResposta>;
  fotos_gerais: Record<string, Foto[]>;
  avarias: Avaria[];
  assinaturas: Record<string, Assinatura>;
  observacoes_gerais: string | null;
  resultado: Resultado | null;
  status: string;
  criado_por: string | null;
  criado_por_nome: string | null;
  filial_id: string;
  created_at?: string;
};

// `fotos` (legado) e `fotos_gerais` ficam de fora da listagem em massa — são a maior
// fatia de base64 deste módulo (várias fotos por seção, por checklist) e não têm nenhum
// texto misturado no meio, diferente de `avarias`/`assinaturas` (que guardam descrição/
// nome junto com a foto no mesmo jsonb, então excluir a coluna perderia informação de
// texto — ficam como estão). Quem abre "Ver / Gerar PDF" busca `fotos`/`fotos_gerais`
// sob demanda (ver getChecklistFrotaFotos).
const COLUNAS_LEVES =
  "id, tipo_checklist, empresa, placa, nucleo, mes, turno, marca_modelo, motorista, matricula_motorista, km, data_checklist, respostas, pendencias_adicionais, executante_nome, executante_mt, supervisor_nome, supervisor_mt, status, criado_por, criado_por_nome, filial_id, created_at, frota, horimetro, registradora_diesel, registradora_insumo, saldo_tanque, local, hora, mecanico, matricula_mecanico, responsavel_recebe, observacoes_gerais, frota_tipo, resultado, avarias, assinaturas";

export async function getChecklistsFrota(): Promise<ChecklistFrota[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_frota")
    .select(COLUNAS_LEVES)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("Erro getChecklistsFrota:", error);
    return [];
  }
  return (data || []) as unknown as ChecklistFrota[];
}

export async function getChecklistFrotaFotos(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("checklist_frota")
    .select("fotos, fotos_gerais")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("Erro getChecklistFrotaFotos:", error);
    return { error: error.message };
  }
  return { data };
}

export async function salvarChecklistFrota(payload: {
  tipo_checklist: TipoChecklist;
  frota_tipo: FrotaKey;
  placa: string;
  frota: string | null;
  marca_modelo: string | null;
  nucleo: string | null;
  km: number | null;
  horimetro: number | null;
  registradora_diesel: number | null;
  registradora_insumo: number | null;
  saldo_tanque: number | null;
  local: string | null;
  data_checklist: string;
  hora: string | null;
  mecanico: string | null;
  matricula_mecanico: string | null;
  responsavel_recebe: string | null;
  respostas: Record<string, ItemResposta>;
  fotos_gerais: Record<string, Foto[]>;
  avarias: Avaria[];
  assinaturas: Record<string, Assinatura>;
  observacoes_gerais: string | null;
  resultado: Resultado;
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
      .from("checklist_frota")
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

    revalidatePath("/checklist-frota");
    return { success: true, data };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function excluirChecklistFrota(id: string) {
  try {
    const supabase = createClient();

    let row: any = null;
    try {
      const { data } = await supabase.from("checklist_frota").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch (err) {
      console.warn("Falha ao buscar snapshot de checklist_frota antes de excluir:", err);
    }

    const { error } = await supabase.from("checklist_frota").delete().eq("id", id);
    if (error) return { error: error.message };

    await registrarExclusao({
      supabase,
      modulo: "Checklist de Frota",
      tabelaOrigem: "checklist_frota",
      registroId: id,
      descricao: row ? `${row.placa} — ${row.frota_tipo}/${row.tipo_checklist} (${row.data_checklist})` : null,
      dados: row,
    });

    revalidatePath("/checklist-frota");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
