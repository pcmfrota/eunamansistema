/**
 * HISTÓRICO DE ATUALIZAÇÕES DE HORÍMETRO/KM
 * Utilitário chamado a partir das server actions do Controle de Horímetros,
 * logo após uma atualização de horímetro/km ter sido gravada com sucesso.
 *
 * Nunca lança erro: uma falha ao registrar o histórico não pode impedir a
 * atualização que o usuário pediu.
 */

export type OrigemAtualizacaoHorimetro = 'NOVO_APONTAMENTO' | 'EDICAO_MANUAL';

export type RegistrarAtualizacaoHorimetroParams = {
  /** Cliente Supabase já autenticado da requisição atual (server action em curso) */
  supabase: any;
  equipamentoId?: string | null;
  placa?: string | null;
  tipo?: string | null;
  categoria?: string | null;
  unidade: 'h' | 'km';
  valorAnterior?: number | null;
  valorNovo: number;
  /** NOVO_APONTAMENTO (modal "Novo Apontamento") ou EDICAO_MANUAL (edição direto na tabela) */
  origem: OrigemAtualizacaoHorimetro;
  observacoes?: string | null;
};

export async function registrarAtualizacaoHorimetro({
  supabase,
  equipamentoId,
  placa,
  tipo,
  categoria,
  unidade,
  valorAnterior,
  valorNovo,
  origem,
  observacoes,
}: RegistrarAtualizacaoHorimetroParams): Promise<void> {
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

    await supabase.from('historico_horimetros').insert({
      equipamento_id: equipamentoId || null,
      placa: placa || '—',
      tipo: tipo || null,
      categoria: categoria || null,
      unidade,
      valor_anterior: valorAnterior ?? null,
      valor_novo: valorNovo,
      origem,
      observacoes: observacoes || null,
      atualizado_por: user?.id || null,
      atualizado_por_nome: nome,
    });
  } catch (err) {
    console.error(`[Histórico de Horímetros] Falha ao registrar atualização de "${placa}":`, err);
  }
}

/** Classifica a unidade de medida (horas ou km) a partir do tipo/categoria do equipamento, mesma regra usada no dashboard de Pesados x Leves. */
export function inferUnidadeHorimetro(categoria?: string | null, tipo?: string | null): 'h' | 'km' {
  const cat = categoria?.toUpperCase() || '';
  const tp = tipo?.toUpperCase() || '';
  const isLeve = cat === 'LEVE' || ['CARRO', 'PICKUP', 'VAN', 'CAMINHONETE', 'LEVE'].includes(tp);
  return isLeve ? 'km' : 'h';
}
