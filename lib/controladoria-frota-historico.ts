/**
 * HISTÓRICO/AUDITORIA DA CONTROLADORIA DE GESTÃO DE FROTA
 * Mesmo padrão já usado em lib/backlog-historico.ts e custos_historico — quem
 * criou, editou ou excluiu cada registro, com o antes/depois completo pra
 * exibir o diff.
 *
 * Nunca lança erro: uma falha ao registrar o histórico não pode impedir a ação
 * real que o usuário pediu.
 */

export type AcaoHistoricoControladoriaFrota = 'CRIACAO' | 'EDICAO' | 'EXCLUSAO';

export type HistoricoControladoriaFrota = {
  id: string;
  acao: AcaoHistoricoControladoriaFrota;
  registro_id: string | null;
  descricao: string | null;
  dados_antes: any;
  dados_depois: any;
  usuario_id: string | null;
  usuario_nome: string | null;
  filial_id: string;
  created_at: string;
};

export async function registrarHistoricoControladoriaFrota({
  supabase,
  acao,
  registroId,
  descricao,
  dadosAntes,
  dadosDepois,
}: {
  supabase: any;
  acao: AcaoHistoricoControladoriaFrota;
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

    await supabase.from('controladoria_frota_historico').insert({
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
    console.error('[Histórico de Controladoria de Frota] Falha ao registrar:', err);
  }
}
