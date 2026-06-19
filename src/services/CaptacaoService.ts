import { createClient } from "@/utils/supabase/server";
import { FichaCaptacao, LancamentoCaptacao } from "../models/captacao";

export class CaptacaoService {
  static async getFichas() {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fichas_captacao")
      .select("*, lancamentos:lancamentos_captacao(*)")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar fichas de captação:", error);
      throw error;
    }
    return data as FichaCaptacao[];
  }

  static async getFichaById(id: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fichas_captacao")
      .select("*, lancamentos:lancamentos_captacao(*)")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`Erro ao buscar ficha ${id}:`, error);
      throw error;
    }
    return data as FichaCaptacao;
  }

  static async createFicha(ficha: Omit<FichaCaptacao, "id" | "status" | "created_at">) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Validar se já existe uma ficha para esta placa neste período (mes/ano)
    const { data: existing, error: checkError } = await supabase
      .from("fichas_captacao")
      .select("id")
      .eq("placa", ficha.placa)
      .eq("mes", ficha.mes)
      .eq("ano", ficha.ano)
      .limit(1);

    if (checkError) {
      console.error("Erro ao verificar duplicados na criação da ficha:", checkError);
    } else if (existing && existing.length > 0) {
      throw new Error(`Já existe uma ficha cadastrada para a placa ${ficha.placa} neste período!`);
    }

    const newFicha = {
      ...ficha,
      status: "Aberta" as const,
      criado_por: user?.id || null,
      created_at: new Date().toISOString().split(".")[0], // ISO format without timezone offset milliseconds
    };

    const { data, error } = await supabase
      .from("fichas_captacao")
      .insert(newFicha)
      .select()
      .single();

    if (error) {
      console.error("Erro ao criar ficha de captação:", error);
      throw error;
    }
    return data as FichaCaptacao;
  }

  static async updateFicha(id: string, updates: Partial<FichaCaptacao>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("fichas_captacao")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar ficha ${id}:`, error);
      throw error;
    }
    return data as FichaCaptacao;
  }

  static async deleteFicha(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("fichas_captacao")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Erro ao deletar ficha ${id}:`, error);
      throw error;
    }
    return { success: true };
  }

  static async addLancamento(lancamento: Omit<LancamentoCaptacao, "id" | "created_at">) {
    const supabase = createClient();
    const newLancamento = {
      ...lancamento,
      created_at: new Date().toISOString().split(".")[0],
    };

    const { data, error } = await supabase
      .from("lancamentos_captacao")
      .insert(newLancamento)
      .select()
      .single();

    if (error) {
      console.error("Erro ao adicionar lançamento de captação:", error);
      throw error;
    }
    return data as LancamentoCaptacao;
  }

  static async deleteLancamento(id: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from("lancamentos_captacao")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`Erro ao deletar lançamento ${id}:`, error);
      throw error;
    }
    return { success: true };
  }

  static async updateLancamento(id: string, updates: Partial<LancamentoCaptacao>) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("lancamentos_captacao")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`Erro ao atualizar lançamento ${id}:`, error);
      throw error;
    }
    return data as LancamentoCaptacao;
  }
}
