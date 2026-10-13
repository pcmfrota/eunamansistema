// Port de app/backlog/actions.ts pro app de campo — sem "use server"/revalidatePath.
//
// FORA DO ESCOPO desta fase (não portadas, propositalmente):
// - gerarOSDeBacklog: depende de OSRepository/OSService (módulo OS ainda não portado
//   pro field-app). "Gerar O.S." continua só no site ao vivo por enquanto.
// - extrairPendenciasBacklogIA / lancarBacklogsExtraidos: usam GEMINI_API_KEY (chave de
//   servidor) — mesmo motivo já documentado no plano pra notificarPapeis (OS). Teria que
//   vazar a chave no app ou chamar um endpoint do site ao vivo; nenhum dos dois é o padrão
//   usado aqui. BacklogAIImportModal.tsx (que usa essas duas) não foi portado.
// - syncRolePermissions: bootstrap administrativo pontual, não é parte do fluxo de uso
//   normal do módulo.
import { BacklogService } from '@/src/services/BacklogService';
import { getUserFilial } from '@/utils/filial';
import { registrarExclusao } from '@/lib/audit-log';

export async function getBacklog(limit: number = 5000) {
  try {
    const data = await BacklogService.getAll(limit);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function upsertBacklogItem(item: any) {
  try {
    const { data } = await BacklogService.upsert(item);
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteBacklogItems(ids: string[]) {
  try {
    await BacklogService.deleteBulk(ids);
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarBacklog(rows: any[]) {
  try {
    const result = await BacklogService.import(rows);
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function encerrarBacklogs(ids: string[], osNumero: string, dataConclusao: string) {
  try {
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('backlog')
      .update({
        status: 'ENCERRADO',
        os: osNumero,
        data_conclusao: dataConclusao
      })
      .in('id', ids)
      .select();

    if (error) throw new Error(error.message);
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ── Solicitações de Exclusão de Backlog ─────────────────────────────────────
// Usuários não-administradores não excluem diretamente: eles criam uma solicitação
// (com motivo) que fica pendente até o administrador aprovar ou rejeitar.

export async function solicitarExclusaoBacklog(ids: string[], motivo: string) {
  try {
    if (!ids || ids.length === 0) return { error: 'Nenhum item selecionado.' };
    const motivoTrim = (motivo || '').trim();
    if (!motivoTrim) return { error: 'Informe o motivo da solicitação de exclusão.' };

    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    const solicitanteNome = profile?.full_name || user.email || 'Usuário';

    const { data: backlogItems, error: fetchError } = await supabase
      .from('backlog')
      .select('id, frota, modulo, criticidade, status, descricao, data_evidencia, tag')
      .in('id', ids);
    if (fetchError) throw new Error(fetchError.message);
    if (!backlogItems || backlogItems.length === 0) {
      return { error: 'Nenhum item válido encontrado para solicitar exclusão.' };
    }

    // Evita solicitações duplicadas para itens que já têm uma solicitação pendente
    const { data: existentes } = await supabase
      .from('backlog_delete_requests')
      .select('backlog_id')
      .eq('status', 'PENDENTE')
      .in('backlog_id', ids);
    const idsComPendencia = new Set((existentes || []).map((r: any) => r.backlog_id));
    const itensParaSolicitar = backlogItems.filter(item => !idsComPendencia.has(item.id));

    if (itensParaSolicitar.length === 0) {
      return { error: 'Este(s) item(ns) já possui(em) uma solicitação de exclusão pendente.' };
    }

    const rows = itensParaSolicitar.map(item => ({
      backlog_id: item.id,
      backlog_frota: item.frota,
      backlog_modulo: item.modulo,
      backlog_criticidade: item.criticidade,
      backlog_status: item.status,
      backlog_descricao: item.descricao,
      backlog_data_evidencia: item.data_evidencia,
      backlog_tag: item.tag,
      motivo: motivoTrim,
      solicitado_por: user.id,
      solicitado_por_nome: solicitanteNome,
    }));

    const { error } = await supabase.from('backlog_delete_requests').insert(rows);
    if (error) throw new Error(error.message);

    return { success: true, count: rows.length };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getSolicitacoesExclusaoBacklog() {
  try {
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('backlog_delete_requests')
      .select('*')
      .order('solicitado_em', { ascending: false });
    if (error) throw new Error(error.message);
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function responderSolicitacaoExclusao(requestId: string, aprovado: boolean) {
  try {
    const { createClient } = await import('@/utils/supabase/client');
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Não autenticado.' };

    // Cast: utils/filial.ts tipa o parâmetro com o SupabaseClient do node_modules da RAIZ
    // do repo; o client daqui vem do node_modules PRÓPRIO do field-app (projeto Vite
    // separado) — mesma forma, mas o tsc trata como classes distintas (membro protected).
    // Sem risco: getUserFilial só chama métodos padrão (.auth.getUser(), .from(...)).
    const { isAdmin } = await getUserFilial(supabase as any);
    if (!isAdmin) {
      return { error: 'Apenas o administrador pode aprovar ou rejeitar solicitações de exclusão.' };
    }

    const { data: request, error: fetchError } = await supabase
      .from('backlog_delete_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (fetchError) throw new Error(fetchError.message);
    if (!request) return { error: 'Solicitação não encontrada.' };
    if (request.status !== 'PENDENTE') return { error: 'Esta solicitação já foi respondida.' };

    // Atualiza o status primeiro: se aprovado, a exclusão do backlog em seguida
    // não pode apagar o rastro da solicitação (backlog_id vira NULL via ON DELETE SET NULL).
    const { error: updateError } = await supabase
      .from('backlog_delete_requests')
      .update({
        status: aprovado ? 'APROVADO' : 'REJEITADO',
        respondido_por: user.id,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', requestId);
    if (updateError) throw new Error(updateError.message);

    if (aprovado && request.backlog_id) {
      const { error: deleteError } = await supabase.from('backlog').delete().eq('id', request.backlog_id);
      if (deleteError) throw new Error(deleteError.message);

      await registrarExclusao({
        supabase,
        modulo: 'Backlog',
        tabelaOrigem: 'backlog',
        registroId: request.backlog_id,
        descricao: `${request.backlog_frota || 'S/ FROTA'} — ${request.backlog_descricao || ''}`,
        dados: request,
        origem: 'SOLICITACAO_APROVADA',
      });
    }

    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
