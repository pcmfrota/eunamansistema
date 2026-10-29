import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarExclusao } from '@/lib/audit-log';

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
  horimetro_inicio?: number | null;
  horimetro_fim?: number | null;
  mecanico_responsavel: string;
  ajudante?: string | null;
  checklist_lubrificacao: any[];
  checklist_geral: any[];
  calibragem: any[];
  reapertos: any[];
  // Opcionais de propósito: a listagem em massa (getAll) não traz mais essas colunas (ver
  // COLUNAS_LEVES acima) — só vêm preenchidas quando buscadas à parte via getImagens.
  fotos_antes?: string[];
  fotos_depois?: string[];
  gps_lat?: number | null;
  gps_lng?: number | null;
  observacoes?: string | null;
  assinatura_mecanico?: string;
  assinatura_lider?: string | null;
  status: string;
  filial_id?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  equipamento?: { placa?: string; modulo?: string; tipo?: string } | null;
}

// Fotos (fotos_antes/fotos_depois) e assinaturas (assinatura_mecanico/assinatura_lider)
// ficam de fora da listagem em massa — eram a maior fatia de base64 deste módulo, sem
// limite de linhas, baixadas de novo a cada carregamento. Quem abre uma ficha específica
// busca essas colunas sob demanda (ver getImagens abaixo).
const COLUNAS_LEVES = 'id, data_registro, hora_inicio, hora_fim, equipamento_id, placa, modulo, local_servico, cliente, horimetro_inicio, horimetro_fim, mecanico_responsavel, ajudante, checklist_lubrificacao, checklist_geral, calibragem, reapertos, gps_lat, gps_lng, observacoes, status, filial_id, created_at, updated_at, deleted_at, equipamento:equipamentos(placa, modulo, tipo)';

export class LubrificacaoService {
  static async getAll() {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fichas_lubrificacao')
        .select(COLUNAS_LEVES)
        .is('deleted_at', null)
        .order('data_registro', { ascending: false });

      if (error) {
        console.warn('[LubrificacaoService] Erro ao buscar do Supabase:', error.message);
        return [];
      }
      // O parser de tipos do supabase-js não confirma que `equipamento` é uma relação
      // "para um" sem um Database schema gerado (este projeto não tem um — ver
      // WORKING_NOTES) quando o select vem de uma string literal em vez de '*'; em
      // runtime o Postgres sempre devolve um objeto único aqui, nunca um array.
      return (data || []) as unknown as FichaLubrificacao[];
    } catch (err) {
      console.error('[LubrificacaoService] Exceção ao buscar fichas:', err);
      return [];
    }
  }

  static async getImagens(id: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('fichas_lubrificacao')
        .select('fotos_antes, fotos_depois, assinatura_mecanico, assinatura_lider')
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data;
    } catch (err) {
      console.error('[LubrificacaoService] Erro ao buscar imagens da ficha:', err);
      return null;
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

      let row: any = null;
      try {
        const { data } = await supabase
          .from('fichas_lubrificacao')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        row = data;
      } catch (err) {
        console.warn('[LubrificacaoService] Falha ao buscar snapshot antes da exclusão:', err);
      }

      const { error } = await supabase
        .from('fichas_lubrificacao')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw new Error(error.message);

      await registrarExclusao({
        supabase,
        modulo: 'Lubrificação',
        tabelaOrigem: 'fichas_lubrificacao',
        registroId: id,
        descricao: row ? `${row.placa} — ${row.cliente || ''} (${row.data_registro})` : null,
        dados: row,
      });

      return true;
    } catch (err: any) {
      console.error('[LubrificacaoService] Erro ao deletar ficha:', err);
      throw err;
    }
  }
}
