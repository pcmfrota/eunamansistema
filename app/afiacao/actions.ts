"use server";

import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function salvarAfiacao(data: any) {
  try {
    const { error } = await supabase
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
      ]);

    if (error) throw error;

    revalidatePath("/afiacao");
    return { success: true, data };
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
