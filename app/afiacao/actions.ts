"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function salvarAfiacao(data: any) {
  try {
    const { data: inserted, error } = await supabase
      .from("afiacao")
      .insert([
        {
          data: data.data,
          afiador: data.afiador,
          modulo: data.modulo,
          maquina: data.maquina,
          letra: data.letra,
          kit: data.kit,
          tipo_formulario: data.tipo_formulario,
          detalhes: data.detalhes
        }
      ])
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, data: inserted };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function atualizarAfiacao(id: string, data: any) {
  try {
    const { data: updated, error } = await supabase
      .from("afiacao")
      .update({
        data: data.data,
        afiador: data.afiador,
        modulo: data.modulo,
        maquina: data.maquina,
        letra: data.letra,
        kit: data.kit,
        tipo_formulario: data.tipo_formulario,
        detalhes: data.detalhes
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletarAfiacao(id: string) {
  try {
    const { error } = await supabase
      .from("afiacao")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function listarAfiacoes() {
  try {
    const { data, error } = await supabase
      .from("afiacao")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error("Erro ao listar afiacoes:", err);
    return [];
  }
}

// Ações para a tabela aux_afiacao (banco de dados auxiliar)
export async function buscarAuxiliaresAfiacao() {
  try {
    const { data, error } = await supabase
      .from("aux_afiacao")
      .select("*")
      .order("value", { ascending: true });

    if (error) {
      console.warn("Erro ao buscar aux_afiacao, tabela pode não existir:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("Erro ao buscar auxiliares:", err);
    return [];
  }
}

export async function salvarAuxiliarAfiacao(category: string, value: string, modulo?: string) {
  try {
    const val = value.trim().toUpperCase();
    if (!val) return { error: "Valor não pode ser vazio" };

    const { error } = await supabase
      .from("aux_afiacao")
      .upsert(
        { category, value: val, modulo: modulo || null },
        { onConflict: "category, modulo, value" }
      );

    if (error) throw error;
    
    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function excluirAuxiliarAfiacao(id: string) {
  try {
    const { error } = await supabase
      .from("aux_afiacao")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

