"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao, registrarExclusoesEmLote } from "@/lib/audit-log";
import { registrarHistoricoControladoriaFrota, HistoricoControladoriaFrota } from "@/lib/controladoria-frota-historico";
import { notificarPapeis } from "@/lib/notificacoes";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type ControladoriaFrota = {
  id: string;
  matricula: string | null;
  nome: string;
  cpf: string | null;
  cargo: string | null;
  local: string | null;
  data_admissao: string | null;
  numero_cartao: string | null;
  cartao_ativo: boolean | null;
  termo_assinado_cartao: boolean | null;
  data_entrega_cartao: string | null;
  termo_ciencia_monitoramento: boolean | null;
  politica_frotas: boolean | null;
  cartao_devolvido: boolean | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;
  cnh_anexo_url: string | null;
  termos_anexo_url: string | null;
  observacoes: string | null;
  filial_id: string;
  created_at?: string;
  updated_at?: string;
};

// ── GET ───────────────────────────────────────────────────────────────────────

export async function getControladoriaFrota(): Promise<ControladoriaFrota[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("controladoria_frota")
    .select("*")
    .order("nome", { ascending: true });
  if (error) {
    console.error("Erro getControladoriaFrota:", error);
    return [];
  }
  return data || [];
}

// ── CREATE / UPDATE ───────────────────────────────────────────────────────────

const campoData = (formData: FormData, nome: string): string | null => {
  const raw = formData.get(nome) as string | null;
  return raw && raw.trim() !== "" ? raw : null;
};

const campoBool = (formData: FormData, nome: string): boolean | null => {
  const raw = formData.get(nome) as string | null;
  if (raw == null || raw === "") return null;
  return raw === "true" || raw === "on" || raw === "SIM";
};

export async function upsertControladoriaFrota(formData: FormData) {
  const supabase = createClient();

  const id = formData.get("id") as string | null;
  const nome = (formData.get("nome") as string || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const payload = {
    matricula: campoData(formData, "matricula"),
    nome,
    cpf: campoData(formData, "cpf"),
    cargo: campoData(formData, "cargo"),
    local: campoData(formData, "local"),
    data_admissao: campoData(formData, "data_admissao"),
    numero_cartao: campoData(formData, "numero_cartao"),
    cartao_ativo: campoBool(formData, "cartao_ativo"),
    termo_assinado_cartao: campoBool(formData, "termo_assinado_cartao"),
    data_entrega_cartao: campoData(formData, "data_entrega_cartao"),
    termo_ciencia_monitoramento: campoBool(formData, "termo_ciencia_monitoramento"),
    politica_frotas: campoBool(formData, "politica_frotas"),
    cartao_devolvido: campoBool(formData, "cartao_devolvido"),
    cnh_numero: campoData(formData, "cnh_numero"),
    cnh_categoria: campoData(formData, "cnh_categoria"),
    cnh_validade: campoData(formData, "cnh_validade"),
    cnh_anexo_url: campoData(formData, "cnh_anexo_url"),
    termos_anexo_url: campoData(formData, "termos_anexo_url"),
    observacoes: campoData(formData, "observacoes"),
    updated_at: new Date().toISOString(),
  };

  const descricao = `${nome} — ${payload.cargo || ""} (Mat. ${payload.matricula || "N/A"})`;

  if (id) {
    const { data: antes } = await supabase.from("controladoria_frota").select("*").eq("id", id).maybeSingle();

    const { data, error } = await supabase
      .from("controladoria_frota")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) return { error: error.message };

    await registrarHistoricoControladoriaFrota({
      supabase, acao: "EDICAO", registroId: id, descricao, dadosAntes: antes, dadosDepois: data,
    });

    revalidatePath("/controladoria-frota");
    return { success: true, data };
  }

  const { cookies } = await import("next/headers");
  const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";
  const { data, error } = await supabase
    .from("controladoria_frota")
    .insert({ ...payload, filial_id: filialId })
    .select()
    .single();
  if (error) return { error: error.message };

  await registrarHistoricoControladoriaFrota({
    supabase, acao: "CRIACAO", registroId: data.id, descricao, dadosDepois: data,
  });

  revalidatePath("/controladoria-frota");
  return { success: true, data };
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function excluirControladoriaFrota(id: string) {
  const supabase = createClient();

  let row: any = null;
  try {
    const { data } = await supabase.from("controladoria_frota").select("*").eq("id", id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn("Falha ao buscar snapshot de controladoria_frota antes de excluir:", err);
  }

  const { error } = await supabase.from("controladoria_frota").delete().eq("id", id);
  if (error) return { error: error.message };

  const descricao = `${row?.nome || ""} — ${row?.cargo || ""} (Mat. ${row?.matricula || "N/A"})`;

  await registrarExclusao({
    supabase,
    modulo: "Controladoria de Gestão de Frota",
    tabelaOrigem: "controladoria_frota",
    registroId: id,
    descricao,
    dados: row,
  });

  await registrarHistoricoControladoriaFrota({
    supabase, acao: "EXCLUSAO", registroId: id, descricao, dadosAntes: row,
  });

  revalidatePath("/controladoria-frota");
  return { success: true };
}

// ── HISTÓRICO ─────────────────────────────────────────────────────────────────

export async function getControladoriaFrotaHistorico(): Promise<HistoricoControladoriaFrota[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("controladoria_frota_historico")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("Erro getControladoriaFrotaHistorico:", error);
    return [];
  }
  return data || [];
}

// ── IMPORTAÇÃO (planilha "Relação de Cartão de Acesso") ───────────────────────
// Substitui por nome+matrícula: uma nova importação do mesmo relatório periódico
// atualiza quem já existe e adiciona quem é novo, sem duplicar.

export async function importarControladoriaFrota(rows: any[]) {
  try {
    const supabase = createClient();
    const { cookies } = await import("next/headers");
    const filialId = cookies().get("x-user-filial")?.value || "MATRIZ";

    const getVal = (row: any, aliases: string[]) => {
      for (const alias of aliases) {
        const val = row[alias];
        if (val !== undefined && val !== null && val !== "") return val;
        const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
        if (key && row[key] !== undefined && row[key] !== null && row[key] !== "") return row[key];
      }
      return null;
    };

    const parseData = (raw: any): string | null => {
      if (!raw) return null;
      if (typeof raw === "number") {
        const date = new Date((raw - 25569) * 86400 * 1000);
        return date.toISOString().slice(0, 10);
      }
      const str = String(raw).trim();
      if (str.includes("/")) {
        const parts = str.split("/");
        if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
      }
      if (str.includes("-")) return str.slice(0, 10);
      return null;
    };

    const parseBool = (raw: any): boolean | null => {
      if (raw === undefined || raw === null || raw === "") return null;
      const str = String(raw).trim().toUpperCase();
      if (str === "SIM" || str === "S" || str === "TRUE" || str === "1") return true;
      if (str === "NÃO" || str === "NAO" || str === "N" || str === "FALSE" || str === "0") return false;
      return null;
    };

    const mapped = rows.map(row => {
      const nome = String(getVal(row, ["nome", "nome do colaborador"]) || "").trim();
      if (!nome) return null;

      return {
        matricula: getVal(row, ["mat", "matricula", "matrícula"]) ? String(getVal(row, ["mat", "matricula", "matrícula"])).trim() : null,
        nome,
        cpf: getVal(row, ["cpf"]) ? String(getVal(row, ["cpf"])).trim() : null,
        cargo: getVal(row, ["cargo básico descrição", "cargo basico descricao", "cargo"]) ? String(getVal(row, ["cargo básico descrição", "cargo basico descricao", "cargo"])).trim() : null,
        local: getVal(row, ["local"]) ? String(getVal(row, ["local"])).trim() : null,
        data_admissao: parseData(getVal(row, ["admissão", "admissao", "data_admissao"])),
        numero_cartao: getVal(row, ["n° cartão", "n cartão", "numero_cartao", "nº cartão", "cartão"]) ? String(getVal(row, ["n° cartão", "n cartão", "numero_cartao", "nº cartão", "cartão"])).trim() : null,
        cartao_ativo: parseBool(getVal(row, ["ativo", "cartao_ativo"])),
        termo_assinado_cartao: parseBool(getVal(row, ["termo assinado cartão ?", "termo assinado cartao", "termo_assinado_cartao"])),
        data_entrega_cartao: parseData(getVal(row, ["data de entrega", "data_entrega_cartao"])),
        termo_ciencia_monitoramento: parseBool(getVal(row, ["termo de ciencia monitoramento", "termo de ciência monitoramento", "termo_ciencia_monitoramento"])),
        politica_frotas: parseBool(getVal(row, ["politica de frotas", "política de frotas", "politica_frotas"])),
        cartao_devolvido: parseBool(getVal(row, ["cartão devolvido", "cartao devolvido", "cartao_devolvido"])),
        cnh_numero: getVal(row, ["cnh_numero", "numero cnh", "nº cnh"]) ? String(getVal(row, ["cnh_numero", "numero cnh", "nº cnh"])).trim() : null,
        cnh_categoria: getVal(row, ["cnh_categoria", "categoria cnh"]) ? String(getVal(row, ["cnh_categoria", "categoria cnh"])).trim() : null,
        cnh_validade: parseData(getVal(row, ["cnh_validade", "validade cnh", "vencimento cnh"])),
        filial_id: filialId,
      };
    }).filter(Boolean) as any[];

    if (mapped.length === 0) {
      const colunasEncontradas = rows.length > 0 ? Object.keys(rows[0]).join(", ") : "(planilha sem linhas lidas)";
      return { error: `Nenhum registro válido encontrado (coluna "Nome" não reconhecida). Colunas detectadas na planilha: ${colunasEncontradas || "nenhuma"}.` };
    }

    // Uma mesma pessoa pode aparecer mais de uma vez na própria planilha (ex: reemissão
    // de cartão) — sem isso, cada ocorrência vira uma linha nova em vez de uma atualizar
    // a outra, já que a checagem contra o banco (abaixo) é feita antes do loop. Dedupe
    // por matrícula (quando houver) ou nome, mantendo a ÚLTIMA ocorrência (mais recente).
    const porChaveNaPlanilha = new Map<string, any>();
    for (const m of mapped) {
      porChaveNaPlanilha.set(m.matricula || m.nome, m);
    }
    const mappedSemDuplicata = Array.from(porChaveNaPlanilha.values());

    // Substitui quem já existe — por matrícula quando ambos os lados tiverem uma (mais
    // confiável), senão por nome — pra reimportar o mesmo relatório sem duplicar,
    // preservando CNH/anexo já lançados manualmente antes (merge, não substituição total).
    const nomes = mappedSemDuplicata.map(m => m.nome);
    const matriculas = mappedSemDuplicata.map(m => m.matricula).filter(Boolean) as string[];
    const [{ data: porNomeRows }, { data: porMatriculaRows }] = await Promise.all([
      supabase.from("controladoria_frota").select("*").in("nome", nomes),
      matriculas.length > 0
        ? supabase.from("controladoria_frota").select("*").in("matricula", matriculas)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const existentesPorId = new Map<string, any>();
    [...(porNomeRows || []), ...(porMatriculaRows || [])].forEach(e => existentesPorId.set(e.id, e));
    const existentes = Array.from(existentesPorId.values());
    const porMatricula = new Map(existentes.filter((e: any) => e.matricula).map((e: any) => [e.matricula, e]));
    const porNome = new Map(existentes.map((e: any) => [e.nome, e]));

    const paraInserir: any[] = [];
    const paraAtualizar: { id: string; payload: any }[] = [];
    for (const m of mappedSemDuplicata) {
      const existente = (m.matricula && porMatricula.get(m.matricula)) || porNome.get(m.nome);
      if (existente) {
        paraAtualizar.push({
          id: existente.id,
          payload: {
            ...m,
            // Preserva CNH/anexo já cadastrados se a planilha não trouxer esses dados
            cnh_numero: m.cnh_numero ?? existente.cnh_numero,
            cnh_categoria: m.cnh_categoria ?? existente.cnh_categoria,
            cnh_validade: m.cnh_validade ?? existente.cnh_validade,
            cnh_anexo_url: existente.cnh_anexo_url,
            termos_anexo_url: existente.termos_anexo_url,
          },
        });
      } else {
        paraInserir.push(m);
      }
    }

    if (paraInserir.length > 0) {
      const { error } = await supabase.from("controladoria_frota").insert(paraInserir);
      if (error) return { error: error.message };
    }
    for (const item of paraAtualizar) {
      await supabase.from("controladoria_frota").update(item.payload).eq("id", item.id);
    }

    revalidatePath("/controladoria-frota");
    return { success: true, count: mapped.length, novos: paraInserir.length, atualizados: paraAtualizar.length };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

export async function excluirControladoriaFrotaEmLote(ids: string[]) {
  try {
    const supabase = createClient();
    const { data: rows } = await supabase.from("controladoria_frota").select("*").in("id", ids);

    const { error } = await supabase.from("controladoria_frota").delete().in("id", ids);
    if (error) return { error: error.message };

    if (rows && rows.length > 0) {
      await registrarExclusoesEmLote(
        supabase,
        "Controladoria de Gestão de Frota",
        "controladoria_frota",
        rows.map((r: any) => ({
          registroId: r.id,
          descricao: `${r.nome || ""} — ${r.cargo || ""}`,
          dados: r,
        })),
        "DIRETO"
      );
      for (const r of rows) {
        await registrarHistoricoControladoriaFrota({
          supabase, acao: "EXCLUSAO", registroId: r.id,
          descricao: `${r.nome || ""} — ${r.cargo || ""}`, dadosAntes: r,
        });
      }
    }

    revalidatePath("/controladoria-frota");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

// ── ALERTA DE CNH VENCIDA ──────────────────────────────────────────────────────
// Não há job agendado (cron) no projeto — a checagem roda "sob demanda", disparada
// pelo carregamento da página (ver page.tsx), que é naturalmente frequente o
// bastante pra quem usa o sistema. Pra não disparar a mesma notificação a cada
// visita, cada registro só é reavisado depois de alguns dias (cnh_alerta_enviado_em).
const DIAS_ENTRE_REALERTAS = 7;

export async function verificarAlertasCnhVencida() {
  try {
    const supabase = createClient();
    const hoje = new Date().toISOString().slice(0, 10);
    const limiteReAlerta = new Date(Date.now() - DIAS_ENTRE_REALERTAS * 24 * 60 * 60 * 1000).toISOString();

    const { data: vencidas, error } = await supabase
      .from("controladoria_frota")
      .select("id, nome, cnh_validade, cnh_alerta_enviado_em")
      .not("cnh_validade", "is", null)
      .lte("cnh_validade", hoje);
    if (error) return { error: error.message };

    const paraAlertar = (vencidas || []).filter(
      v => !v.cnh_alerta_enviado_em || v.cnh_alerta_enviado_em < limiteReAlerta
    );
    if (paraAlertar.length === 0) return { success: true, alertados: 0 };

    const nomes = paraAlertar.map(v => v.nome).join(", ");
    await notificarPapeis(["admin", "pcm"], {
      tipo: "cnh_vencida",
      titulo: paraAlertar.length === 1 ? "CNH vencida" : `${paraAlertar.length} CNHs vencidas`,
      mensagem: `${nomes} — confira a Controladoria de Gestão de Frota.`,
      link: "/controladoria-frota",
    });

    await supabase
      .from("controladoria_frota")
      .update({ cnh_alerta_enviado_em: new Date().toISOString() })
      .in("id", paraAlertar.map(v => v.id));

    return { success: true, alertados: paraAlertar.length };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}
