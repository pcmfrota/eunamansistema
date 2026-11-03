// Port de app/lavagens/actions.ts pro app de campo — sem "use server"/revalidatePath.
//
// FORA DO ESCOPO desta fase (não portado, propositalmente):
// - validarLavagem: ação de supervisor/PCM (valida o lançamento de outra pessoa), não é
//   parte do fluxo de uso normal de quem está lavando o equipamento em campo.
import { createClient } from "@/utils/supabase/client";
import { registrarExclusao } from "@/lib/audit-log";

export type Lavagem = {
  id: string;
  placa: string;
  data: string;
  colaborador: string;
  horimetro: number;
  km: number;
  status: "Lavado" | "Pendente" | "Não realizado";
  lavagem_realizada: boolean;
  observacoes: string;
  itens_lavados?: string[];
  tipo_frota?: "pesado" | "leve" | null;
  imagem_1_url?: string;
  imagem_2_url?: string;
  imagem_3_url?: string;
  imagem_horimetro_url?: string;
  assinatura_url?: string;
  created_at: string;
  validated_at?: string;
  registrado_por?: string | null;
  registrado_por_nome?: string | null;
};

async function getUsuarioAtual() {
  const supabase = createClient();
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

// As fotos/assinatura saíram da sincronização em massa (ver lib/offline-sync.ts) pra não
// estourar a cota de saída do Supabase — quem abre uma lavagem específica (ver detalhe,
// editar) busca essas colunas aqui, sob demanda.
export async function getLavagemImagens(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lavagens")
    .select("imagem_1_url, imagem_2_url, imagem_3_url, imagem_horimetro_url, assinatura_url")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching lavagem imagens:", error);
    return { error: error.message };
  }
  return { data };
}

export async function saveLavagem(dataToSave: any) {
  const supabase = createClient();

  const id = dataToSave.id as string;
  const placa = dataToSave.placa as string;
  const data = dataToSave.data as string;
  const horimetro = Number(dataToSave.horimetro) || 0;
  const km = Number(dataToSave.km) || 0;
  const lavagem_realizada = dataToSave.lavagem_realizada === true || dataToSave.lavagem_realizada === "true";
  const observacoes = dataToSave.observacoes || "";
  const tipo_frota = dataToSave.tipo_frota || null;

  let itens_lavados: string[] = [];
  const itensRaw = dataToSave.itens_lavados;
  if (itensRaw) {
    try {
      itens_lavados = typeof itensRaw === "string" ? JSON.parse(itensRaw) : itensRaw;
    } catch {
      itens_lavados = [];
    }
  }

  // Status: km é sempre obrigatório; horímetro só é exigido pra frota pesada — carro leve
  // não tem esse campo no formulário, então não pode travar o status em "Pendente" por
  // falta dele.
  let status: Lavagem["status"] = "Lavado";
  if (!km || (tipo_frota !== "leve" && !horimetro)) {
    status = "Pendente";
  }
  if (!lavagem_realizada) {
    status = "Não realizado";
  }

  const lavagemData: any = {
    placa,
    data,
    horimetro,
    km,
    status,
    lavagem_realizada,
    observacoes,
    itens_lavados,
    tipo_frota,
  };

  const img1 = dataToSave.imagem_1_url;
  const img2 = dataToSave.imagem_2_url;
  const img3 = dataToSave.imagem_3_url;
  const imgH = dataToSave.imagem_horimetro_url;
  const assinatura = dataToSave.assinatura_url;

  if (img1) lavagemData.imagem_1_url = img1;
  if (img2) lavagemData.imagem_2_url = img2;
  if (img3) lavagemData.imagem_3_url = img3;
  if (imgH) lavagemData.imagem_horimetro_url = imgH;
  if (assinatura) lavagemData.assinatura_url = assinatura;

  // "Colaborador" (quem lavou) não é escolhido manualmente — é sempre quem está logado
  // fazendo o lançamento. Só preenchemos isso (e registrado_por/registrado_por_nome) na
  // criação: numa edição, preserva quem registrou originalmente.
  const { data: existing } = id
    ? await supabase.from("lavagens").select("id").eq("id", id).maybeSingle()
    : { data: null };

  if (!existing) {
    const usuario = await getUsuarioAtual();
    lavagemData.registrado_por = usuario.registrado_por;
    lavagemData.registrado_por_nome = usuario.registrado_por_nome;
    lavagemData.colaborador = usuario.registrado_por_nome;
  }

  // O cliente já manda um UUID de verdade mesmo em registros novos (pra poder salvar
  // localmente offline antes de sincronizar) — por isso é upsert por id, não um if/else
  // de "tem id → update, não tem → insert".
  const { data: saved, error } = id
    ? await supabase.from("lavagens").upsert({ ...lavagemData, id }, { onConflict: "id" }).select().single()
    : await supabase.from("lavagens").insert([lavagemData]).select().single();

  if (error) {
    console.error("Error saving lavagem:", error);
    return { success: false, error: error.message };
  }

  return { success: true, data: saved };
}

export async function deleteLavagem(id: string) {
  const supabase = createClient();

  let lavagemSnapshot: any = null;
  try {
    const { data } = await supabase.from("lavagens").select("*").eq("id", id).maybeSingle();
    lavagemSnapshot = data;
  } catch (snapshotError) {
    console.warn(`Falha ao capturar snapshot da lavagem ${id} antes da exclusão:`, snapshotError);
  }

  const { error } = await supabase.from("lavagens").delete().eq("id", id);

  if (error) {
    console.error("Error deleting lavagem:", error);
    return { success: false, error: error.message };
  }

  await registrarExclusao({
    supabase,
    modulo: "Controle de Lavagens",
    tabelaOrigem: "lavagens",
    registroId: id,
    descricao: lavagemSnapshot ? `Lavagem — Placa ${lavagemSnapshot.placa} (${lavagemSnapshot.data})` : null,
    dados: lavagemSnapshot,
  });

  return { success: true };
}
