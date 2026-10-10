"use server";

import { createClient } from "@/utils/supabase/server";
import { InsumoTipo } from "./config";

export type PontoDia = { dia: string; litros: number };
export type PontoEquipamento = { equipamento: string; litros: number };
export type PontoInsumo = { insumo_tipo: InsumoTipo; quantidade: number };
export type PontoCategoria = { categoria: string; litros: number };

async function getIdsFichasPeriodo(supabase: any, dataInicio: string, dataFim: string): Promise<{ id: string; data: string }[]> {
  const { data } = await supabase
    .from("insumos_fichas_abastecimento").select("id, data")
    .eq("status", "FINALIZADA").gte("data", dataInicio).lte("data", dataFim);
  return data || [];
}

export async function getConsumoDieselPorDia(dataInicio: string, dataFim: string): Promise<PontoDia[]> {
  const supabase = createClient();
  const fichas = await getIdsFichasPeriodo(supabase, dataInicio, dataFim);
  if (!fichas.length) return [];

  const diaPorFicha = new Map(fichas.map((f) => [f.id, f.data]));
  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("ficha_id, saiu")
    .in("ficha_id", fichas.map((f) => f.id)).in("insumo_tipo", ["DIESEL_T1", "DIESEL_T2"]);

  const porDia = new Map<string, number>();
  (insumos || []).forEach((i: any) => {
    const dia = diaPorFicha.get(i.ficha_id);
    if (!dia) return;
    porDia.set(dia, (porDia.get(dia) || 0) + Number(i.saiu || 0));
  });

  return Array.from(porDia.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([dia, litros]) => ({ dia, litros }));
}

export async function getConsumoPorEquipamento(dataInicio: string, dataFim: string): Promise<PontoEquipamento[]> {
  const supabase = createClient();
  const fichas = await getIdsFichasPeriodo(supabase, dataInicio, dataFim);
  if (!fichas.length) return [];

  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("equipamento_texto, diesel_litros").in("ficha_id", fichas.map((f) => f.id));

  const porEquip = new Map<string, number>();
  (linhas || []).forEach((l: any) => {
    const nome = l.equipamento_texto || "Não informado";
    porEquip.set(nome, (porEquip.get(nome) || 0) + Number(l.diesel_litros || 0));
  });

  return Array.from(porEquip.entries())
    .map(([equipamento, litros]) => ({ equipamento, litros }))
    .filter((p) => p.litros > 0)
    .sort((a, b) => b.litros - a.litros)
    .slice(0, 10);
}

export async function getConsumoPorInsumo(dataInicio: string, dataFim: string): Promise<PontoInsumo[]> {
  const supabase = createClient();
  const fichas = await getIdsFichasPeriodo(supabase, dataInicio, dataFim);
  if (!fichas.length) return [];

  const { data: insumos } = await supabase.from("insumos_ficha_insumos").select("insumo_tipo, saiu").in("ficha_id", fichas.map((f) => f.id));

  const porTipo = new Map<string, number>();
  (insumos || []).forEach((i: any) => porTipo.set(i.insumo_tipo, (porTipo.get(i.insumo_tipo) || 0) + Number(i.saiu || 0)));

  // DIESEL_T1 e T2 são o mesmo insumo pra fins de análise (só tanques físicos diferentes).
  const diesel = (porTipo.get("DIESEL_T1") || 0) + (porTipo.get("DIESEL_T2") || 0);
  porTipo.delete("DIESEL_T1");
  porTipo.delete("DIESEL_T2");
  if (diesel > 0) porTipo.set("DIESEL_T1", diesel);

  return Array.from(porTipo.entries())
    .map(([insumo_tipo, quantidade]) => ({ insumo_tipo: insumo_tipo as InsumoTipo, quantidade }))
    .filter((p) => p.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade);
}

// Categoria do veículo que RECEBEU o insumo — cruza o texto lançado na linha com o Cadastro
// de Máquinas Suzano (campo "tipo": HV, FW ou GRU). O que não bate com nenhuma máquina
// cadastrada (texto livre, veículo de outra frota) cai em "Outro/Não identificado".
export async function getConsumoPorCategoriaVeiculo(dataInicio: string, dataFim: string): Promise<PontoCategoria[]> {
  const supabase = createClient();
  const fichas = await getIdsFichasPeriodo(supabase, dataInicio, dataFim);
  if (!fichas.length) return [];

  const { data: linhas } = await supabase.from("insumos_abastecimento_linhas").select("equipamento_texto, diesel_litros").in("ficha_id", fichas.map((f) => f.id));
  const { data: maquinas } = await supabase.from("insumos_maquinas_suzano").select("codigo, tipo");
  const tipoPorCodigo = new Map((maquinas || []).map((m: any) => [m.codigo, m.tipo]));

  const CATEGORIA_LABEL: Record<string, string> = { HV: "Frente HV", FW: "Frente FW", GRU: "Gruas (Carregamento)" };

  const porCategoria = new Map<string, number>();
  (linhas || []).forEach((l: any) => {
    const tipo = tipoPorCodigo.get(l.equipamento_texto);
    const categoria = tipo ? (CATEGORIA_LABEL[tipo] || tipo) : "Outro / Não identificado";
    porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + Number(l.diesel_litros || 0));
  });

  return Array.from(porCategoria.entries())
    .map(([categoria, litros]) => ({ categoria, litros }))
    .filter((p) => p.litros > 0)
    .sort((a, b) => b.litros - a.litros);
}
