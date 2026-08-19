/**
 * HISTÓRICO CENTRAL DE EXCLUSÕES
 * Utilitário chamado a partir das server actions de cada módulo, sempre logo antes
 * (com o snapshot já em mãos) ou logo depois de um `.delete()`/soft-delete real.
 *
 * Nunca lança erro: uma falha ao registrar o histórico não pode impedir a exclusão
 * que o usuário pediu.
 */

export type OrigemExclusao = 'DIRETO' | 'SOLICITACAO_APROVADA';

export type RegistrarExclusaoParams = {
  /** Cliente Supabase já autenticado da requisição atual (server action em curso) */
  supabase: any;
  /** Nome amigável do módulo/tipo de serviço, ex: "Ordem de Serviço", "CIV/CIPP" */
  modulo: string;
  /** Tabela real no Supabase, ex: "ordens_servico" */
  tabelaOrigem: string;
  /** Id do registro excluído */
  registroId?: string | number | null;
  /** Resumo legível do que foi excluído, ex: "OS Nº 1234 — Placa ABC1234" */
  descricao?: string | null;
  /** Snapshot completo do registro no momento da exclusão */
  dados?: any;
  /** DIRETO (padrão) ou SOLICITACAO_APROVADA quando vem de um fluxo de aprovação */
  origem?: OrigemExclusao;
};

export async function registrarExclusao({
  supabase,
  modulo,
  tabelaOrigem,
  registroId,
  descricao,
  dados,
  origem = 'DIRETO',
}: RegistrarExclusaoParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let nome = user?.email || 'Sistema';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      nome = profile?.full_name || user.email || 'Usuário';
    }

    await supabase.from('historico_exclusoes').insert({
      modulo,
      tabela_origem: tabelaOrigem,
      registro_id: registroId != null ? String(registroId) : null,
      descricao: descricao || null,
      dados: dados ?? null,
      excluido_por: user?.id || null,
      excluido_por_nome: nome,
      origem,
    });
  } catch (err) {
    console.error(`[Histórico de Exclusões] Falha ao registrar exclusão de "${modulo}":`, err);
  }
}

/** Atalho para logar várias exclusões de uma vez (exclusão em massa). */
export async function registrarExclusoesEmLote(
  supabase: any,
  modulo: string,
  tabelaOrigem: string,
  itens: Array<{ registroId?: string | number | null; descricao?: string | null; dados?: any }>,
  origem: OrigemExclusao = 'DIRETO'
): Promise<void> {
  await Promise.all(
    itens.map(item =>
      registrarExclusao({
        supabase,
        modulo,
        tabelaOrigem,
        registroId: item.registroId,
        descricao: item.descricao,
        dados: item.dados,
        origem,
      })
    )
  );
}
