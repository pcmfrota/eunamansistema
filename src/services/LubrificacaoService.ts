import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export interface FichaLubrificacao {
  id: string;
  data_registro: string;
  hora_inicio: string;
  hora_fim: string;
  equipamento_id: string;
  placa: string;
  modulo: string;
  local_servico: string;
  cliente: string;
  horimetro_inicio: number;
  horimetro_fim: number;
  mecanico_responsavel: string;
  ajudante?: string | null;
  checklist_lubrificacao: any[];
  checklist_geral: any[];
  calibragem: any[];
  reapertos: any[];
  fotos_antes: string[];
  fotos_depois: string[];
  gps_lat?: number | null;
  gps_lng?: number | null;
  observacoes?: string | null;
  assinatura_mecanico: string;
  assinatura_lider?: string | null;
  status: string;
  filial_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  equipamento?: { placa?: string; modulo?: string; tipo?: string } | null;
}

export class LubrificacaoService {
  static async getAll() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fichas_lubrificacao')
        .select('*, equipamento:equipamentos(placa, modulo, tipo)')
        .is('deleted_at', null)
        .order('data_registro', { ascending: false });

      if (error) {
        console.warn('[LubrificacaoService] Erro ao buscar do Supabase:', error.message);
        return [];
      }
      return data || [];
    } catch (err) {
      console.error('[LubrificacaoService] Exceção ao buscar fichas:', err);
      return [];
    }
  }

  static async create(payload: Partial<FichaLubrificacao>) {
    try {
      const supabase = createClient();
      const cleanPayload = {
        ...payload,
        data_registro: payload.data_registro || new Date().toISOString(),
        status: payload.status || 'CONCLUÍDO',
      };

      const { data, error } = await supabase
        .from('fichas_lubrificacao')
        .insert(cleanPayload)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (err: any) {
      console.error('[LubrificacaoService] Erro ao criar ficha:', err);
      throw err;
    }
  }

  static async update(id: string, payload: Partial<FichaLubrificacao>) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fichas_lubrificacao')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data;
    } catch (err: any) {
      console.error('[LubrificacaoService] Erro ao atualizar ficha:', err);
      throw err;
    }
  }

  static async delete(id: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('fichas_lubrificacao')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);
      return true;
    } catch (err: any) {
      console.error('[LubrificacaoService] Erro ao deletar ficha:', err);
      throw err;
    }
  }
}
