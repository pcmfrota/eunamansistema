// Port de app/lubrificacao/actions.ts + src/services/LubrificacaoService.ts pro app de
// campo — sem "use server"/revalidatePath, direto no cliente (createClient browser).
//
// Equipamentos e colaboradores NÃO precisam de função própria aqui — já são tabelas
// sincronizadas localmente (localDb) e consumidas direto pela tela, igual outros módulos.
import { createClient } from "@/utils/supabase/client";
import { registrarExclusao } from "@/lib/audit-log";
import { getCurrentLocalDate, getCurrentLocalDatetime } from "@/src/utils/dateUtils";

export interface ChecklistItem {
  item: string;
  status: string;
  observacao?: string;
  qtdPrevista?: number;
  unidade?: string;
}

export interface FichaLubrificacao {
  id: string;
  data_registro: string;
  hora_inicio: string;
  hora_fim: string;
  equipamento_id: string;
  placa: string;
  modulo: string;
  local_servico: string;
  cliente: string;
  horimetro_inicio?: number | null;
  horimetro_fim?: number | null;
  mecanico_responsavel: string;
  ajudante?: string | null;
  checklist_lubrificacao: ChecklistItem[];
  checklist_geral: ChecklistItem[];
  calibragem: any[];
  reapertos: ChecklistItem[];
  fotos_antes?: string[];
  fotos_depois?: string[];
  gps_lat?: number | null;
  gps_lng?: number | null;
  observacoes?: string | null;
  assinatura_mecanico?: string;
  assinatura_lider?: string | null;
  status: string;
  filial_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  equipamento?: { placa?: string; modulo?: string; tipo?: string } | null;
}

// Fotos/assinaturas saíram da listagem em massa (ver lib/offline-sync.ts, mesma cota de
// saída do Supabase) — quem abre uma ficha específica (editar) busca essas colunas aqui.
export async function obterImagensFichaLubrificacao(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("fichas_lubrificacao")
    .select("fotos_antes, fotos_depois, assinatura_mecanico, assinatura_lider")
    .eq("id", id)
    .maybeSingle();

  if (error) return { error: error.message };
  return { success: true, data };
}

export async function registrarFichaLubrificacao(payload: Partial<FichaLubrificacao>) {
  const supabase = createClient();
  try {
    const cleanPayload = {
      ...payload,
      data_registro: payload.data_registro || getCurrentLocalDate(),
      status: payload.status || "CONCLUÍDO",
    };
    const { data, error } = await supabase.from("fichas_lubrificacao").insert(cleanPayload).select().single();
    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message || "Erro ao salvar ficha de lubrificação" };
  }
}

export async function atualizarFichaLubrificacao(id: string, payload: Partial<FichaLubrificacao>) {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.from("fichas_lubrificacao").update(payload).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message || "Erro ao atualizar ficha de lubrificação" };
  }
}

export async function excluirFichaLubrificacao(id: string) {
  const supabase = createClient();
  try {
    let row: any = null;
    try {
      const { data } = await supabase.from("fichas_lubrificacao").select("*").eq("id", id).maybeSingle();
      row = data;
    } catch {}

    const { error } = await supabase.from("fichas_lubrificacao").update({ deleted_at: getCurrentLocalDatetime() }).eq("id", id);
    if (error) throw new Error(error.message);

    await registrarExclusao({
      supabase,
      modulo: "Lubrificação",
      tabelaOrigem: "fichas_lubrificacao",
      registroId: id,
      descricao: row ? `${row.placa} — ${row.cliente || ""} (${row.data_registro})` : null,
      dados: row,
    });

    return { success: true };
  } catch (error: any) {
    return { error: error.message || "Erro ao excluir ficha de lubrificação" };
  }
}
