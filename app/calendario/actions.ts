"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function getCalendario() {
  const supabase = createClient();
  const { data } = await supabase
    .from("calendario_suzano")
    .select("*")
    .order("ano", { ascending: false })
    .order("mes", { ascending: true });
  return data || [];
}

export async function saveCalendario(item: any) {
  const supabase = createClient();
  
  const data = {
    ano: Number(item.ano),
    mes: Number(item.mes),
    data_inicio: item.data_inicio,
    data_fim: item.data_fim,
    total_dias: Number(item.total_dias),
  };

  if (item.id) {
    const { error } = await supabase.from("calendario_suzano").update(data).eq("id", item.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("calendario_suzano").insert(data);
    if (error) throw error;
  }

  revalidatePath("/calendario");
}

export async function importarCronograma2026() {
  const supabase = createClient();

  // Verificar se já existem registros de 2026 antes de importar
  const { data: existentes } = await supabase
    .from("calendario_suzano")
    .select("mes")
    .eq("ano", 2026);

  const mesesExistentes = new Set((existentes || []).map((r: any) => r.mes));

  const cronograma2026 = [
    { ano: 2026, mes: 1,  data_inicio: "2025-12-22", data_fim: "2026-01-21", total_dias: 31 },
    { ano: 2026, mes: 2,  data_inicio: "2026-01-22", data_fim: "2026-02-19", total_dias: 29 },
    { ano: 2026, mes: 3,  data_inicio: "2026-02-20", data_fim: "2026-03-22", total_dias: 31 },
    { ano: 2026, mes: 4,  data_inicio: "2026-03-23", data_fim: "2026-04-21", total_dias: 30 },
    { ano: 2026, mes: 5,  data_inicio: "2026-04-22", data_fim: "2026-05-21", total_dias: 30 },
    { ano: 2026, mes: 6,  data_inicio: "2026-05-22", data_fim: "2026-06-15", total_dias: 25 },
    { ano: 2026, mes: 7,  data_inicio: "2026-06-16", data_fim: "2026-07-22", total_dias: 37 },
    { ano: 2026, mes: 8,  data_inicio: "2026-07-23", data_fim: "2026-08-20", total_dias: 29 },
    { ano: 2026, mes: 9,  data_inicio: "2026-08-21", data_fim: "2026-09-20", total_dias: 31 },
    { ano: 2026, mes: 10, data_inicio: "2026-09-21", data_fim: "2026-10-21", total_dias: 31 },
    { ano: 2026, mes: 11, data_inicio: "2026-10-22", data_fim: "2026-11-21", total_dias: 31 },
    { ano: 2026, mes: 12, data_inicio: "2026-11-22", data_fim: "2026-12-21", total_dias: 30 },
  ];

  // Inserir apenas os meses que ainda não existem
  const novos = cronograma2026.filter((r) => !mesesExistentes.has(r.mes));

  if (novos.length === 0) {
    throw new Error("O cronograma 2026 já foi importado. Use 'Limpar Duplicatas' se houver repetições.");
  }

  const { error } = await supabase.from("calendario_suzano").insert(novos);
  if (error) throw error;

  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function limparDuplicatasCalendario() {
  const supabase = createClient();

  // Buscar todos os registros
  const { data, error: fetchError } = await supabase
    .from("calendario_suzano")
    .select("*")
    .order("id", { ascending: true });

  if (fetchError) throw fetchError;
  if (!data || data.length === 0) return;

  // Agrupar por mes+ano e identificar duplicatas (manter o de menor ID)
  const vistos = new Map<string, number>();
  const idsParaDeletar: number[] = [];

  for (const registro of data) {
    const chave = `${registro.mes}-${registro.ano}`;
    if (vistos.has(chave)) {
      // Este é duplicata — deletar
      idsParaDeletar.push(registro.id);
    } else {
      vistos.set(chave, registro.id);
    }
  }

  if (idsParaDeletar.length === 0) return;

  // Deletar todas as duplicatas
  const { error: deleteError } = await supabase
    .from("calendario_suzano")
    .delete()
    .in("id", idsParaDeletar);

  if (deleteError) throw deleteError;

  revalidatePath("/calendario");
  revalidatePath("/");
}

export async function deleteCalendario(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from("calendario_suzano").delete().eq("id", id);
  if (error) throw error;
  revalidatePath("/calendario");
}
