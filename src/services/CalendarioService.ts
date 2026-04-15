import { createClient } from "@/utils/supabase/server";

export type CalendarioSuzano = {
  id?: string;
  ano: number;
  mes: number;
  data_inicio: string;
  data_fim: string;
  total_dias: number;
};

export class CalendarioService {
  static async getAll() {
    const supabase = createClient();
    const { data } = await supabase
      .from("calendario_suzano")
      .select("*")
      .order("ano", { ascending: false })
      .order("mes", { ascending: true });
    return data as CalendarioSuzano[];
  }

  static async getPeriodo(mes: number, ano: number) {
    const supabase = createClient();
    const { data } = await supabase
      .from("calendario_suzano")
      .select("*")
      .eq("mes", mes)
      .eq("ano", ano)
      .single();
    return data as CalendarioSuzano | null;
  }

  static async save(item: CalendarioSuzano) {
    const supabase = createClient();
    if (item.id) {
      return await supabase.from("calendario_suzano").update(item).eq("id", item.id);
    }
    return await supabase.from("calendario_suzano").insert(item);
  }
}
