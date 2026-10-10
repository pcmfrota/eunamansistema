"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { InsumoTipo } from "./config";

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type OrigemRecarga = "SKID" | "ALMOXARIFADO" | "FORNECEDOR" | "OUTRO";

export type ItemRecargaInput = {
  material_id: string;
  quantidade: number;
  req_nf: string | null;
  tanque_diesel?: 1 | 2 | null;
};

export type RecargaInput = {
  equipamento_id: string;
  modulo_id: string | null;
  turno: "1" | "2" | "3" | null;
  data: string;
  hora: string | null;
  motorista_nome: string | null;
  motorista_matricula: string | null;
  observacao: string | null;
  origem_tipo: OrigemRecarga;
  origem_skid_id: string | null;
  origem_deposito: string | null;
  origem_outro_texto: string | null;
  local_recarga: string | null;
  responsavel_nome: string | null;
  responsavel_matricula: string | null;
  responsavel_assinatura_url: string | null;
  itens: ItemRecargaInput[];
};

export type SaldoSkidItem = { material_id: string; material_nome: string; ni: string; unidade: string; saldo: number };
export type Skid = { id: string; placa: string; modelo: string | null };

// ─── Util ───────────────────────────────────────────────────────────────────

async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null as string | null, nome: null as string | null };
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  return { id: user.id, nome: profile?.full_name || user.email || "Usuário" };
}

function aplicacaoParaInsumoTipo(aplicacao: string, tanqueDiesel?: 1 | 2 | null): InsumoTipo {
  if (aplicacao === "DIESEL") return tanqueDiesel === 2 ? "DIESEL_T2" : "DIESEL_T1";
  if (aplicacao === "ADITIVO") return "ARLA";
  return aplicacao as InsumoTipo;
}

async function calcularSaldoSkidMaterial(supabase: any, equipamentoId: string, materialId: string): Promise<number> {
  const { data } = await supabase.from("insumos_skid_movimentos").select("tipo, quantidade").eq("equipamento_id", equipamentoId).eq("material_id", materialId);
  return (data || []).reduce((s: number, m: any) => s + (m.tipo === "ENTRADA" ? Number(m.quantidade) : -Number(m.quantidade)), 0);
}

export async function getSkidsDisponiveis(): Promise<Skid[]> {
  const supabase = createClient();
  const { data } = await supabase.from("equipamentos").select("id, placa, modelo").eq("tipo", "SKID").is("deleted_at", null).order("placa");
  return data || [];
}

export async function getSaldoSkid(equipamentoId: string): Promise<SaldoSkidItem[]> {
  const supabase = createClient();
  const { data: materiais } = await supabase.from("insumos_materiais").select("id, material, ni, unidade").eq("ativo", true).order("codigo");
  const { data: movimentos } = await supabase.from("insumos_skid_movimentos").select("material_id, tipo, quantidade").eq("equipamento_id", equipamentoId);

  return (materiais || []).map((m: any) => {
    const saldo = (movimentos || []).filter((mv: any) => mv.material_id === m.id)
      .reduce((s: number, mv: any) => s + (mv.tipo === "ENTRADA" ? Number(mv.quantidade) : -Number(mv.quantidade)), 0);
    return { material_id: m.id, material_nome: m.material, ni: m.ni, unidade: m.unidade, saldo };
  });
}

// Aplica um insumo recebido (recarga) na ficha de abastecimento informada, somando em
// "entrou" e recalculando "restou" — mesma regra de cálculo usada no fechamento da ficha.
async function aplicarItemNaFicha(supabase: any, fichaId: string, tipo: InsumoTipo, quantidade: number) {
  const { data: insumo } = await supabase.from("insumos_ficha_insumos").select("id, entrou, quantidade_inicial, saiu").eq("ficha_id", fichaId).eq("insumo_tipo", tipo).maybeSingle();
  if (!insumo) return;
  const novoEntrou = Number(insumo.entrou || 0) + quantidade;
  const restou = Number(insumo.quantidade_inicial || 0) + novoEntrou - Number(insumo.saiu || 0);
  await supabase.from("insumos_ficha_insumos").update({ entrou: novoEntrou, restou, updated_at: new Date().toISOString() }).eq("id", insumo.id);
}

// Chamado tanto ao finalizar uma recarga (se já houver ficha em rascunho) quanto ao abrir
// uma ficha nova (pra aplicar recargas que ficaram pendentes esperando a próxima ficha).
export async function aplicarRecargasPendentes(supabase: any, equipamentoId: string, fichaId: string) {
  const { data: pendentes } = await supabase
    .from("insumos_fichas_recarga").select("id")
    .eq("equipamento_id", equipamentoId).eq("status", "FINALIZADA").is("aplicado_em_ficha_id", null);

  for (const recarga of pendentes || []) {
    const { data: itens } = await supabase
      .from("insumos_recarga_itens").select("material_id, quantidade, tanque_diesel, insumos_materiais(aplicacao)")
      .eq("recarga_id", recarga.id);

    for (const item of itens || []) {
      const aplicacao = (item as any).insumos_materiais?.aplicacao;
      if (!aplicacao) continue;
      await aplicarItemNaFicha(supabase, fichaId, aplicacaoParaInsumoTipo(aplicacao, item.tanque_diesel), Number(item.quantidade));
    }
    await supabase.from("insumos_fichas_recarga").update({ aplicado_em_ficha_id: fichaId }).eq("id", recarga.id);
  }
}

export async function criarRecargaFinalizada(input: RecargaInput): Promise<{ success?: true; recargaId?: string; error?: string }> {
  if (!input.itens.length) return { error: "Adicione pelo menos um item à recarga." };

  const supabase = createClient();

  if (input.origem_tipo === "ALMOXARIFADO" || input.origem_tipo === "FORNECEDOR") {
    if (input.itens.some((i) => !i.req_nf?.trim())) {
      return { error: "REQ/NF é obrigatório pra todos os itens quando a origem é Almoxarifado ou Fornecedor." };
    }
  }

  const { data: materiaisInfo } = await supabase.from("insumos_materiais").select("id, material, aplicacao").in("id", input.itens.map((i) => i.material_id));
  const mapaMateriais = new Map((materiaisInfo || []).map((m: any) => [m.id, m]));

  if (input.origem_tipo === "SKID" && input.origem_skid_id) {
    for (const item of input.itens) {
      const saldo = await calcularSaldoSkidMaterial(supabase, input.origem_skid_id, item.material_id);
      if (item.quantidade > saldo) {
        const nome = mapaMateriais.get(item.material_id)?.material || "insumo";
        return { error: `Quantidade de "${nome}" (${item.quantidade}) é maior que o saldo disponível no skid (${saldo}).` };
      }
    }
  }

  const usuario = await getUsuarioAtual(supabase);

  const { data: recarga, error } = await supabase.from("insumos_fichas_recarga").insert({
    equipamento_id: input.equipamento_id, modulo_id: input.modulo_id, turno: input.turno,
    data: input.data, hora: input.hora, motorista_nome: input.motorista_nome, motorista_matricula: input.motorista_matricula,
    observacao: input.observacao, origem_tipo: input.origem_tipo, origem_skid_id: input.origem_skid_id,
    origem_deposito: input.origem_deposito, origem_outro_texto: input.origem_outro_texto, local_recarga: input.local_recarga,
    responsavel_nome: input.responsavel_nome, responsavel_matricula: input.responsavel_matricula,
    responsavel_assinatura_url: input.responsavel_assinatura_url,
    status: "FINALIZADA", criado_por: usuario.id, criado_por_nome: usuario.nome,
  }).select("id").single();
  if (error || !recarga) return { error: error?.message || "Erro ao criar a recarga." };

  await supabase.from("insumos_recarga_itens").insert(
    input.itens.map((i) => ({ recarga_id: recarga.id, material_id: i.material_id, quantidade: i.quantidade, req_nf: i.req_nf, tanque_diesel: i.tanque_diesel || null }))
  );

  if (input.origem_tipo === "SKID" && input.origem_skid_id) {
    await supabase.from("insumos_skid_movimentos").insert(
      input.itens.map((i) => ({
        equipamento_id: input.origem_skid_id, material_id: i.material_id, tipo: "SAIDA", quantidade: i.quantidade,
        origem_recarga_id: recarga.id, data: input.data, criado_por: usuario.id,
      }))
    );
  }

  const { data: fichaAberta } = await supabase
    .from("insumos_fichas_abastecimento").select("id")
    .eq("equipamento_id", input.equipamento_id).eq("status", "RASCUNHO").maybeSingle();

  if (fichaAberta) {
    for (const item of input.itens) {
      const material = mapaMateriais.get(item.material_id);
      if (!material) continue;
      await aplicarItemNaFicha(supabase, fichaAberta.id, aplicacaoParaInsumoTipo(material.aplicacao, item.tanque_diesel), Number(item.quantidade));
    }
    await supabase.from("insumos_fichas_recarga").update({ aplicado_em_ficha_id: fichaAberta.id }).eq("id", recarga.id);
  }

  revalidatePath("/insumos");
  return { success: true, recargaId: recarga.id };
}

// Entrada de insumo no skid (vindo do almoxarifado/fornecedor) — alimenta o saldo que a
// recarga Skid -> Comboio depois consome.
export async function registrarEntradaSkid(
  equipamentoId: string, materialId: string, quantidade: number, data: string,
  reqNf: string | null, fotoUrl: string | null, observacao: string | null
): Promise<{ success?: true; error?: string }> {
  if (quantidade <= 0) return { error: "Informe uma quantidade maior que zero." };
  const supabase = createClient();
  const usuario = await getUsuarioAtual(supabase);

  const { error } = await supabase.from("insumos_skid_movimentos").insert({
    equipamento_id: equipamentoId, material_id: materialId, tipo: "ENTRADA", quantidade,
    data, req_nf: reqNf, foto_url: fotoUrl, observacao, criado_por: usuario.id,
    responsavel_nome: usuario.nome,
  });
  if (error) return { error: error.message };
  revalidatePath("/insumos");
  return { success: true };
}

// ─── Lista e detalhe ────────────────────────────────────────────────────────

export type FichaRecargaResumo = {
  id: string; numero_sequencial: number; data: string; placa: string;
  origem_tipo: OrigemRecarga; origem_label: string; status: string; aplicado: boolean;
};

export async function getFichasRecarga(filtro: { dataInicio?: string; dataFim?: string; equipamentoId?: string } = {}): Promise<FichaRecargaResumo[]> {
  const supabase = createClient();
  let query = supabase
    .from("insumos_fichas_recarga")
    .select("id, numero_sequencial, data, status, origem_tipo, origem_deposito, origem_outro_texto, aplicado_em_ficha_id, equipamentos!insumos_fichas_recarga_equipamento_id_fkey(placa), origem_skid:equipamentos!insumos_fichas_recarga_origem_skid_id_fkey(placa)")
    .order("data", { ascending: false }).order("numero_sequencial", { ascending: false }).limit(200);

  if (filtro.dataInicio) query = query.gte("data", filtro.dataInicio);
  if (filtro.dataFim) query = query.lte("data", filtro.dataFim);
  if (filtro.equipamentoId) query = query.eq("equipamento_id", filtro.equipamentoId);

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((f: any) => {
    const origemLabel = f.origem_tipo === "SKID" ? (f.origem_skid?.placa || "Skid")
      : f.origem_tipo === "ALMOXARIFADO" ? (f.origem_deposito || "Almoxarifado")
      : f.origem_tipo === "FORNECEDOR" ? "Fornecedor" : (f.origem_outro_texto || "Outro");
    return {
      id: f.id, numero_sequencial: f.numero_sequencial, data: f.data,
      placa: f.equipamentos?.placa || "-", origem_tipo: f.origem_tipo, origem_label: origemLabel,
      status: f.status, aplicado: !!f.aplicado_em_ficha_id,
    };
  });
}

export type RecargaCompleta = {
  recarga: RecargaInput & { id: string; numero_sequencial: number; status: string; aplicado_em_ficha_id: string | null; criado_por_nome: string | null };
  itensDetalhados: { material_id: string; material_nome: string; unidade: string; quantidade: number; req_nf: string | null; tanque_diesel: number | null }[];
};

export async function getRecarga(recargaId: string): Promise<{ recarga?: RecargaCompleta; error?: string }> {
  const supabase = createClient();
  const { data: recarga } = await supabase.from("insumos_fichas_recarga").select("*").eq("id", recargaId).maybeSingle();
  if (!recarga) return { error: "Recarga não encontrada." };

  const { data: itens } = await supabase.from("insumos_recarga_itens").select("material_id, quantidade, req_nf, tanque_diesel, insumos_materiais(material, unidade)").eq("recarga_id", recargaId);

  return {
    recarga: {
      recarga: { ...recarga, itens: [] },
      itensDetalhados: (itens || []).map((i: any) => ({
        material_id: i.material_id, material_nome: i.insumos_materiais?.material || "-", unidade: i.insumos_materiais?.unidade || "",
        quantidade: Number(i.quantidade), req_nf: i.req_nf, tanque_diesel: i.tanque_diesel,
      })),
    },
  };
}
