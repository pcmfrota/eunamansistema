"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// Cadastros (admin) do módulo Controle de Insumos: módulos, materiais, máquinas Suzano,
// colaboradores e impedimentos. "Excluir" aqui sempre significa desativar (ativo=false /
// status='Inativo'), nunca apagar de verdade — esses registros são referenciados por fichas
// já lançadas, então um hard delete quebraria o histórico. Desativado some das listas
// suspensas dos formulários, mas continua existindo pra qualquer ficha antiga que o usou.

type Resultado<T> = { item?: T; error?: string };

// ─── Módulos ────────────────────────────────────────────────────────────────

export type ModuloCadastro = { id: string; codigo: string; nome: string; centro: string | null; deposito: string | null; controle: string | null; ativo: boolean };

export async function getModulosCadastro(): Promise<ModuloCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase.from("insumos_modulos").select("*").order("codigo");
  return data || [];
}

export async function salvarModulo(id: string | null, dados: Omit<ModuloCadastro, "id">): Promise<Resultado<ModuloCadastro>> {
  if (!dados.codigo?.trim() || !dados.nome?.trim()) return { error: "Código e nome são obrigatórios." };
  const supabase = createClient();
  const payload = { codigo: dados.codigo.trim(), nome: dados.nome.trim(), centro: dados.centro || null, deposito: dados.deposito || null, controle: dados.controle || null, ativo: dados.ativo };

  const query = id ? supabase.from("insumos_modulos").update(payload).eq("id", id) : supabase.from("insumos_modulos").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return { error: error.code === "23505" ? "Já existe um módulo com esse código." : error.message };
  revalidatePath("/insumos");
  return { item: data };
}

// ─── Materiais ──────────────────────────────────────────────────────────────

export type MaterialCadastro = { id: string; codigo: number | null; ni: string; referencia: string; material: string; unidade: string; aplicacao: string; ativo: boolean };

export async function getMateriaisCadastro(): Promise<MaterialCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase.from("insumos_materiais").select("*").order("codigo");
  return data || [];
}

export async function salvarMaterial(id: string | null, dados: Omit<MaterialCadastro, "id">): Promise<Resultado<MaterialCadastro>> {
  if (!dados.ni?.trim() || !dados.material?.trim() || !dados.aplicacao) return { error: "NI, material e aplicação são obrigatórios." };
  const supabase = createClient();
  const payload = {
    codigo: dados.codigo || null, ni: dados.ni.trim(), referencia: dados.referencia?.trim() || dados.material.trim(),
    material: dados.material.trim(), unidade: dados.unidade || "L", aplicacao: dados.aplicacao, ativo: dados.ativo,
  };
  const query = id ? supabase.from("insumos_materiais").update(payload).eq("id", id) : supabase.from("insumos_materiais").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return { error: error.message };
  revalidatePath("/insumos");
  return { item: data };
}

// ─── Máquinas Suzano ────────────────────────────────────────────────────────

export type MaquinaCadastro = { id: string; codigo: string; modulo_id: string | null; frente: string | null; tipo: string | null; origem: string; foto_url: string | null; ativo: boolean };

export async function getMaquinasCadastro(): Promise<MaquinaCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase.from("insumos_maquinas_suzano").select("*").order("codigo");
  return data || [];
}

export async function salvarMaquina(id: string | null, dados: { codigo: string; modulo_id: string | null; frente: string | null; tipo: string | null; ativo: boolean }): Promise<Resultado<MaquinaCadastro>> {
  if (!dados.codigo?.trim()) return { error: "Informe o código/placa da máquina." };
  const supabase = createClient();
  const payload = { codigo: dados.codigo.trim().toUpperCase(), modulo_id: dados.modulo_id || null, frente: dados.frente || null, tipo: dados.tipo || null, ativo: dados.ativo };
  const query = id ? supabase.from("insumos_maquinas_suzano").update(payload).eq("id", id) : supabase.from("insumos_maquinas_suzano").insert({ ...payload, origem: "CADASTRO" });
  const { data, error } = await query.select("*").single();
  if (error) return { error: error.code === "23505" ? "Já existe uma máquina cadastrada com esse código." : error.message };
  revalidatePath("/insumos");
  return { item: data };
}

// ─── Colaboradores ──────────────────────────────────────────────────────────

export type ColaboradorCadastro = { id: string; nome: string; matricula: string | null; cargo: string | null; tipo: string | null; status: string | null };

export async function getColaboradoresCadastro(): Promise<ColaboradorCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase.from("colaboradores").select("id, nome, matricula, cargo, tipo, status").order("nome");
  return data || [];
}

export async function salvarColaborador(id: string | null, dados: Omit<ColaboradorCadastro, "id">): Promise<Resultado<ColaboradorCadastro>> {
  if (!dados.nome?.trim()) return { error: "Informe o nome do colaborador." };
  const supabase = createClient();
  const payload = { nome: dados.nome.trim(), matricula: dados.matricula || null, cargo: dados.cargo || null, tipo: dados.tipo || null, status: dados.status || "Ativo" };
  const query = id ? supabase.from("colaboradores").update(payload).eq("id", id) : supabase.from("colaboradores").insert(payload);
  const { data, error } = await query.select("id, nome, matricula, cargo, tipo, status").single();
  if (error) return { error: error.code === "23505" ? "Já existe um colaborador com esse nome." : error.message };
  revalidatePath("/insumos");
  return { item: data };
}

// ─── Impedimentos ───────────────────────────────────────────────────────────

export type ImpedimentoCadastro = { id: string; codigo: string | null; descricao: string; ativo: boolean };

export async function getImpedimentosCadastro(): Promise<ImpedimentoCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase.from("insumos_impedimentos").select("*").order("descricao");
  return data || [];
}

export async function salvarImpedimento(id: string | null, dados: Omit<ImpedimentoCadastro, "id">): Promise<Resultado<ImpedimentoCadastro>> {
  if (!dados.descricao?.trim()) return { error: "Informe a descrição do impedimento." };
  const supabase = createClient();
  const payload = { codigo: dados.codigo?.trim() || null, descricao: dados.descricao.trim(), ativo: dados.ativo };
  const query = id ? supabase.from("insumos_impedimentos").update(payload).eq("id", id) : supabase.from("insumos_impedimentos").insert(payload);
  const { data, error } = await query.select("*").single();
  if (error) return { error: error.message };
  revalidatePath("/insumos");
  return { item: data };
}

// ─── Frota (Comboios/Skids) — edição dos campos específicos de insumos ─────

export type FrotaCadastro = {
  id: string; placa: string; modelo: string | null; tipo: string;
  deposito_suzano: string | null; numero_tanques_diesel: number; capacidade_tanque_litros: number | null;
};

export async function getFrotaCadastro(): Promise<FrotaCadastro[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("equipamentos").select("id, placa, modelo, tipo, deposito_suzano, numero_tanques_diesel, capacidade_tanque_litros")
    .in("tipo", ["COMBOIO", "SKID"]).is("deleted_at", null).order("tipo").order("placa");
  return data || [];
}

export async function salvarFrotaInsumos(
  id: string, dados: { deposito_suzano: string | null; numero_tanques_diesel: number; capacidade_tanque_litros: number | null }
): Promise<{ success?: true; error?: string }> {
  const supabase = createClient();
  const { error } = await supabase.from("equipamentos").update({
    deposito_suzano: dados.deposito_suzano || null,
    numero_tanques_diesel: dados.numero_tanques_diesel || 1,
    capacidade_tanque_litros: dados.capacidade_tanque_litros || null,
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/insumos");
  return { success: true };
}
