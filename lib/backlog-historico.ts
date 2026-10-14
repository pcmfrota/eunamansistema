/**
 * HISTÓRICO/AUDITORIA DO BACKLOG
 * Reaproveita o mesmo padrão já usado em custos_historico (app/custos/actions.ts) —
 * quem criou, editou ou excluiu cada item, com o antes/depois completo pra exibir o
 * diff. Fica num arquivo compartilhado (em vez de local a app/backlog/actions.ts)
 * porque tanto as Server Actions quanto o Repository (exclusão em lote) precisam
 * chamar isso.
 *
 * Nunca lança erro: uma falha ao registrar o histórico não pode impedir a ação real
 * que o usuário pediu.
 */

export type AcaoHistoricoBacklog = 'CRIACAO' | 'EDICAO' | 'EXCLUSAO';

export type HistoricoBacklog = {
  id: string;
  acao: AcaoHistoricoBacklog;
  registro_id: string | null;
  descricao: string | null;
  dados_antes: any;
  dados_depois: any;
  usuario_id: string | null;
  usuario_nome: string | null;
  filial_id: string;
  created_at: string;
};

export async function registrarHistoricoBacklog({
  supabase,
  acao,
  registroId,
  descricao,
  dadosAntes,
  dadosDepois,
}: {
  supabase: any;
  acao: AcaoHistoricoBacklog;
  registroId?: string | number | null;
  descricao?: string | null;
  dadosAntes?: any;
  dadosDepois?: any;
}): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let nome = user?.email || 'Sistema';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      nome = profile?.full_name || user.email || 'Usuário';
    }

    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';

    await supabase.from('backlog_historico').insert({
      acao,
      registro_id: registroId != null ? String(registroId) : null,
      descricao: descricao || null,
      dados_antes: dadosAntes ?? null,
      dados_depois: dadosDepois ?? null,
      usuario_id: user?.id || null,
      usuario_nome: nome,
      filial_id: filialId,
    });
  } catch (err) {
    console.error('[Histórico de Backlog] Falha ao registrar:', err);
  }
}
