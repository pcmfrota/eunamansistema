/**
 * Repository Layer (BacklogRepository.ts)
 */
import { createClient } from '@/utils/supabase/server';
import { BacklogItemInsert, BacklogItemUpdate } from '../models/backlog';
import { registrarExclusoesEmLote } from '@/lib/audit-log';
import { registrarHistoricoBacklog } from '@/lib/backlog-historico';

// Colunas "leves" do backlog — tudo, menos as fotos de evidência em base64. A listagem
// em massa (`list`, até 5000 linhas) nunca deve trazer as fotos: isso foi a causa principal
// do projeto estourar a cota de saída (egress) do Supabase, porque toda tela de Backlog
// baixava de novo as fotos de TODOS os itens a cada atualização. Quem precisa da foto de
// um item específico usa `getImagens` abaixo.
//
// Precisa ser uma string literal de verdade (não uma string montada em runtime, tipo
// array.join() ou concatenação com "+") — a tipagem do supabase-js só consegue inferir o
// formato da linha retornada a partir do texto literal passado pra .select(); um `string`
// genérico cai num tipo de erro interno (GenericStringError) e quebra a tipagem de tudo
// que usa o retorno.
export const BACKLOG_SELECT_LEVE = 'id, semana, mes, ano, data_evidencia, modulo, regiao_programa, frota, tag, tipo, descricao, origem, colaborador, criticidade, tempo_execucao, campo_base, os, material, nr_rc, nr_ordem, fornecedor, status, data_conclusao, data_programacao, status_programacao, observacao, created_at, sistema_cod, subsistema_cod, componente_cod, mao_obra, detalhamento, data_rc, data_nec_material, previsao_material, situacao_rc, previsao_conclusao';

export const BACKLOG_SELECT_FOTOS = 'evidencia_imagem, evidencia_imagens, evidencia_imagens_conclusao';

export class BacklogRepository {
  static async list(limit: number = 5000) {
    const supabase = await createClient();
    return await supabase
      .from('backlog')
      .select(BACKLOG_SELECT_LEVE)
      .order('created_at', { ascending: false })
      .limit(limit);
  }

  static async getImagens(id: string) {
    const supabase = await createClient();
    return await supabase
      .from('backlog')
      .select(BACKLOG_SELECT_FOTOS)
      .eq('id', id)
      .maybeSingle();
  }

  static async upsert(item: BacklogItemInsert | BacklogItemUpdate) {
    const supabase = await createClient();
    return await supabase
      .from('backlog')
      .upsert([item])
      .select();
  }

  static async deleteMany(ids: string[]) {
    const supabase = await createClient();

    let rows: any[] = [];
    try {
      const { data } = await supabase.from('backlog').select('*').in('id', ids);
      rows = data || [];
    } catch (err) {
      console.warn('[BacklogRepository.deleteMany] Falha ao obter snapshot antes da exclusão:', err);
    }

    const result = await supabase.from('backlog').delete().in('id', ids);

    if (!result.error) {
      await registrarExclusoesEmLote(
        supabase,
        'Backlog',
        'backlog',
        rows.map(r => ({
          registroId: r.id,
          descricao: `${r.frota || 'S/ FROTA'} — ${r.descricao || ''}`,
          dados: r,
        }))
      );
      await Promise.all(rows.map(r => registrarHistoricoBacklog({
        supabase,
        acao: 'EXCLUSAO',
        registroId: r.id,
        descricao: `${r.frota || 'S/ FROTA'} — ${r.descricao || ''}`,
        dadosAntes: r,
      })));
    }

    return result;
  }

  static async insertMany(items: BacklogItemInsert[]) {
    const supabase = await createClient();
    return await supabase.from('backlog').insert(items);
  }
}
