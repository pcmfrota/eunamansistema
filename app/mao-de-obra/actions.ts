'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { registrarExclusao } from '@/lib/audit-log';

export async function getFichasMaoObra(limit: number = 2000) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('fichas_mao_obra')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function salvarFichaMaoObra(ficha: any) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      ...ficha,
      updated_at: new Date().toISOString(),
      created_by: user?.id || ficha.created_by || null,
    };

    // Se id começar com temp_, removemos o id para que o Supabase gere um UUID válido
    if (typeof payload.id === 'string' && payload.id.startsWith('temp_')) {
      delete payload.id;
    }

    // Campo só existe no cache local (IndexedDB), nunca é uma coluna real
    delete payload._isPendingSync;

    if (payload.equipamento_id === "" || payload.equipamento_id === undefined) {
      delete payload.equipamento_id;
    }
    if (payload.created_by === "" || payload.created_by === undefined) {
      delete payload.created_by;
    }

    // Sanitizar campos numéricos para evitar erros de sintaxe no PostgreSQL
    if (payload.horimetro === "" || payload.horimetro === undefined || isNaN(Number(payload.horimetro))) {
      delete payload.horimetro;
    } else {
      payload.horimetro = Number(payload.horimetro);
    }

    if (payload.km === "" || payload.km === undefined || isNaN(Number(payload.km))) {
      delete payload.km;
    } else {
      payload.km = Number(payload.km);
    }

    if (payload.latitude === "" || payload.latitude === undefined || isNaN(Number(payload.latitude))) {
      delete payload.latitude;
    } else {
      payload.latitude = Number(payload.latitude);
    }

    if (payload.longitude === "" || payload.longitude === undefined || isNaN(Number(payload.longitude))) {
      delete payload.longitude;
    } else {
      payload.longitude = Number(payload.longitude);
    }

    if (payload.tempo_total_horas === "" || payload.tempo_total_horas === undefined || isNaN(Number(payload.tempo_total_horas))) {
      payload.tempo_total_horas = 0;
    } else {
      payload.tempo_total_horas = Number(payload.tempo_total_horas);
    }

    const { data, error } = await supabase
      .from('fichas_mao_obra')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath('/mao-de-obra');
    return { success: true, data };
  } catch (error: any) {
    console.error('Erro ao salvar ficha de mão de obra:', error);
    return { error: error.message };
  }
}

export async function excluirFichaMaoObra(id: string) {
  try {
    const supabase = createClient();

    let fichaSnapshot: any = null;
    try {
      const { data } = await supabase
        .from('fichas_mao_obra')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      fichaSnapshot = data;
    } catch (snapshotError) {
      console.warn(`Falha ao capturar snapshot da ficha de mão de obra ${id} antes da exclusão:`, snapshotError);
    }

    const { error } = await supabase
      .from('fichas_mao_obra')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    await registrarExclusao({
      supabase,
      modulo: 'Ficha Mão de Obra',
      tabelaOrigem: 'fichas_mao_obra',
      registroId: id,
      descricao: fichaSnapshot ? `Ficha Nº ${fichaSnapshot.numero_ficha} — ${fichaSnapshot.mecanico_nome} (${fichaSnapshot.placa})` : null,
      dados: fichaSnapshot,
    });

    revalidatePath('/mao-de-obra');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function reabrirJornada(id: string) {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('fichas_mao_obra')
      .update({ status: 'Em andamento', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath('/mao-de-obra');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function duplicarFichaMaoObra(id: string) {
  try {
    const supabase = createClient();
    const { data: original, error: getErr } = await supabase
      .from('fichas_mao_obra')
      .select('*')
      .eq('id', id)
      .single();

    if (getErr || !original) throw new Error(getErr?.message || 'Ficha não encontrada.');

    const newNum = `MO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const copyPayload = {
      ...original,
      id: undefined,
      numero_ficha: newNum,
      status: 'Em andamento',
      data_jornada: new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    delete copyPayload.id;

    const { data, error } = await supabase
      .from('fichas_mao_obra')
      .insert(copyPayload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath('/mao-de-obra');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// ─── APONTAMENTOS INDIVIDUAIS DA JORNADA (histórico/auditoria por atividade) ───
// Cada atividade é sua própria linha (não um JSONB reescrito por inteiro), justamente
// porque vários colaboradores apontam ao mesmo tempo, cada um pelo próprio celular —
// inserir/atualizar uma linha por vez evita que uma sessão sobrescreva o que outra
// já tinha salvo.

export async function getApontamentos(limit: number = 10000) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('apontamentos_mao_obra')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Recalcula e grava na jornada (fichas_mao_obra) os totais agregados dos apontamentos
// dessa jornada — mantém o dashboard/histórico corretos sem precisar reabrir a ficha.
// Nunca lança: uma falha aqui não pode derrubar o save/delete do apontamento em si.
async function atualizarTotaisJornada(supabase: any, jornadaId: string) {
  try {
    const { data: apontamentos, error: fetchError } = await supabase
      .from('apontamentos_mao_obra')
      .select('tempo_gasto_minutos, produtivo')
      .eq('jornada_id', jornadaId);

    if (fetchError) throw fetchError;

    let totalMin = 0;
    let produtivoMin = 0;
    (apontamentos || []).forEach((a: any) => {
      const min = Number(a.tempo_gasto_minutos) || 0;
      totalMin += min;
      if (a.produtivo) produtivoMin += min;
    });

    await supabase
      .from('fichas_mao_obra')
      .update({
        tempo_total_horas: Number((totalMin / 60).toFixed(2)),
        tempo_produtivo_horas: Number((produtivoMin / 60).toFixed(2)),
        tempo_ocioso_horas: Number(((totalMin - produtivoMin) / 60).toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jornadaId);
  } catch (err) {
    console.error('[Mão de Obra] Falha ao recalcular totais da jornada:', err);
  }
}

export async function salvarApontamento(apontamento: any) {
  try {
    const supabase = createClient();
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

    // Payload explícito (não spread): "tempo_gasto" (string "HH:MM") e outros campos
    // que só existem no lado do cliente nunca podem ir pro upsert, ou o Supabase rejeita
    // a coluna inexistente.
    const payload = {
      id: apontamento.id,
      jornada_id: apontamento.jornada_id,
      tipo_atividade: apontamento.tipo_atividade,
      tipo_manutencao: apontamento.tipo_manutencao || null,
      apontamento_codigo: apontamento.apontamento_codigo || null,
      produtivo: Boolean(apontamento.produtivo),
      placa: apontamento.placa || null,
      descricao: apontamento.descricao || null,
      hora_inicio: apontamento.hora_inicio || null,
      hora_fim: apontamento.hora_fim || null,
      tempo_gasto_minutos: Number(apontamento.tempo_gasto_minutos) || 0,
      registrado_por: user?.id || null,
      registrado_por_nome: nome,
      atualizado_em: new Date().toISOString(),
    };

    if (!payload.id) throw new Error('Apontamento sem id.');
    if (!payload.jornada_id) throw new Error('Apontamento sem jornada vinculada.');

    const { data, error } = await supabase
      .from('apontamentos_mao_obra')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await atualizarTotaisJornada(supabase, payload.jornada_id);

    revalidatePath('/mao-de-obra');
    return { success: true, data };
  } catch (error: any) {
    console.error('Erro ao salvar apontamento:', error);
    return { error: error.message };
  }
}

export async function excluirApontamento(id: string) {
  try {
    const supabase = createClient();

    const { data: existente } = await supabase
      .from('apontamentos_mao_obra')
      .select('jornada_id')
      .eq('id', id)
      .maybeSingle();

    const { error } = await supabase
      .from('apontamentos_mao_obra')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    if (existente?.jornada_id) {
      await atualizarTotaisJornada(supabase, existente.jornada_id);
    }

    revalidatePath('/mao-de-obra');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
