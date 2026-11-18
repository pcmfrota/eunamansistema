'use server'

import { PreventivaService } from '@/src/services/PreventivaService';
import { revalidatePath } from 'next/cache';
import { registrarAtualizacaoHorimetro, inferUnidadeHorimetro } from '@/lib/horimetro-log';

export async function criarPreventiva(formData: FormData) {
  try {
    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      ultimo_horimetro: parseFloat(formData.get('ultimo_horimetro') as string),
      horimetro_atual: parseFloat(formData.get('horimetro_atual') as string),
      intervalo_horas: parseFloat(formData.get('intervalo_horas') as string) || 500,
      data_atualizacao: formData.get('data_atualizacao') as string
    };

    const extra = {
      tipo: formData.get('tipo') as string,
      modulo: formData.get('modulo') as string
    };

    await PreventivaService.create(data, extra);
    
    revalidatePath('/preventivas');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirPreventiva(id: string) {
  try {
    await PreventivaService.delete(id);
    revalidatePath('/preventivas');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarPreventiva(id: string, dados: {
  ultimo_horimetro?: number;
  horimetro_atual?: number;
  intervalo_horas?: number;
  data_atualizacao?: string;
}) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: atual, error: fetchError } = await supabase
      .from('preventivas')
      .select('horimetro_atual, equipamento_id, equipamentos(placa, tipo, categoria)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('preventivas')
      .update({ ...dados, data_atualizacao: dados.data_atualizacao || new Date().toISOString().split('T')[0] })
      .eq('id', id);
    if (error) throw error;

    if (dados.horimetro_atual !== undefined && dados.horimetro_atual !== atual?.horimetro_atual) {
      const eq: any = atual?.equipamentos;
      await registrarAtualizacaoHorimetro({
        supabase,
        equipamentoId: atual?.equipamento_id,
        placa: eq?.placa,
        tipo: eq?.tipo,
        categoria: eq?.categoria,
        unidade: inferUnidadeHorimetro(eq?.categoria, eq?.tipo),
        valorAnterior: atual?.horimetro_atual,
        valorNovo: dados.horimetro_atual,
        origem: 'EDICAO_MANUAL',
      });
    }

    revalidatePath('/preventivas');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}


export async function importarPreventivas(data: any[]) {
  try {
    const result = await PreventivaService.importBulk(data);
    revalidatePath('/preventivas');
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function registrarHorimetro(formData: FormData) {
  try {
    const { HorimetroService } = await import('@/src/services/HorimetroService');
    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_referencia: (formData.get('data_referencia') || formData.get('data')) as string,
      horimetro_inicial: parseFloat(formData.get('horimetro_inicial') as string),
      horimetro_final: parseFloat(formData.get('horimetro_final') as string),
      observacoes: formData.get('observacoes') as string
    };

    if (isNaN(data.horimetro_inicial) || isNaN(data.horimetro_final)) {
      throw new Error('Horímetros inicial e final devem ser números válidos');
    }

    // Busca a preventiva existente ANTES de gravar, para validar contra o último valor registrado
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data: existing, error: fetchError } = await supabase
      .from('preventivas')
      .select('id, horimetro_atual')
      .eq('equipamento_id', data.equipamento_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      console.error('Erro ao buscar preventiva:', fetchError);
    }

    if (existing?.horimetro_atual != null && data.horimetro_final < existing.horimetro_atual) {
      throw new Error(`O horímetro/km não pode ser menor que o último valor registrado (${existing.horimetro_atual}).`);
    }

    const { data: equipamento } = await supabase
      .from('equipamentos')
      .select('placa, tipo, categoria')
      .eq('id', data.equipamento_id)
      .maybeSingle();

    // 1. Registrar no histórico de horímetros
    await HorimetroService.create(data);

    // 2. Sincronizar com a tabela de preventivas
    if (existing) {
      // Atualiza registro existente
      const { error: updateError } = await supabase
        .from('preventivas')
        .update({ 
          horimetro_atual: data.horimetro_final,
          data_atualizacao: data.data_referencia 
        })
        .eq('id', existing.id);
      
      if (updateError) throw updateError;
    } else {
      // Cria novo registro de controle preventivo
      const { error: insertError } = await supabase
        .from('preventivas')
        .insert({
          equipamento_id: data.equipamento_id,
          ultimo_horimetro: data.horimetro_inicial,
          horimetro_atual: data.horimetro_final,
          intervalo_horas: 500, // Padrão
          data_atualizacao: data.data_referencia
        });
      
      if (insertError) throw insertError;
    }

    await registrarAtualizacaoHorimetro({
      supabase,
      equipamentoId: data.equipamento_id,
      placa: equipamento?.placa,
      tipo: equipamento?.tipo,
      categoria: equipamento?.categoria,
      unidade: inferUnidadeHorimetro(equipamento?.categoria, equipamento?.tipo),
      valorAnterior: existing?.horimetro_atual ?? data.horimetro_inicial,
      valorNovo: data.horimetro_final,
      origem: 'NOVO_APONTAMENTO',
      observacoes: data.observacoes,
    });

    revalidatePath('/preventivas');
    return { success: true };
  } catch (error: any) {
    console.error('Erro em registrarHorimetro:', error);
    return { error: error.message || 'Erro interno ao salvar apontamento' };
  }
}

/** Coluna nova ainda não criada no banco (migration 20261118000000_horimetro_km.sql pendente). */
function colunaInexistente(error: any): boolean {
  const msg = String(error?.message || '');
  return error?.code === '42703' || error?.code === 'PGRST204' || /km_atual|ultimo_km|km_novo|km_anterior|data_referencia/.test(msg);
}

export type AtualizacaoHorimetroKm = {
  /** Data da leitura (yyyy-mm-dd) — é a data que aparece no Calendário de Leituras. */
  data_referencia: string;
  /** Valor principal do controle: horas (pesados/Zocar) ou km (leves). */
  horimetro_atual: number;
  /** KM do veículo — só pesados/Zocar (nos leves o valor principal já é o km). */
  km_atual?: number | null;
  ultimo_km?: number | null;
  /** Ajustes da preventiva (opcionais): horímetro da última preventiva e intervalo. */
  ultimo_horimetro?: number;
  intervalo_horas?: number;
  observacoes?: string | null;
};

/**
 * Modal "Atualizar Horímetro e KM": grava a leitura na preventiva e SEMPRE registra uma
 * linha no histórico (mesmo se o horímetro não mudou, porque o KM/data da leitura importam
 * pro Calendário de Leituras).
 */
export async function atualizarHorimetroKm(id: string, dados: AtualizacaoHorimetroKm) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    if (!dados.data_referencia) throw new Error('Informe a data da leitura.');
    if (dados.horimetro_atual == null || isNaN(dados.horimetro_atual)) throw new Error('Informe o valor atual.');

    const { data: atual, error: fetchError } = await supabase
      .from('preventivas')
      .select('*, equipamentos(placa, tipo, categoria)')
      .eq('id', id)
      .maybeSingle();
    if (fetchError) throw fetchError;
    if (!atual) throw new Error('Registro não encontrado.');

    const eq: any = (atual as any).equipamentos;
    const unidade = inferUnidadeHorimetro(eq?.categoria, eq?.tipo);

    const base: Record<string, any> = {
      horimetro_atual: dados.horimetro_atual,
      data_atualizacao: dados.data_referencia,
    };
    if (dados.ultimo_horimetro != null && !isNaN(dados.ultimo_horimetro)) base.ultimo_horimetro = dados.ultimo_horimetro;
    if (dados.intervalo_horas != null && !isNaN(dados.intervalo_horas)) base.intervalo_horas = dados.intervalo_horas;
    const comKm: Record<string, any> = { ...base };
    if (unidade === 'h') {
      if (dados.km_atual != null && !isNaN(dados.km_atual)) comKm.km_atual = dados.km_atual;
      if (dados.ultimo_km != null && !isNaN(dados.ultimo_km)) comKm.ultimo_km = dados.ultimo_km;
    }

    let { error } = await supabase.from('preventivas').update(comKm).eq('id', id);
    let kmGravado = true;
    if (error && colunaInexistente(error)) {
      kmGravado = false;
      ({ error } = await supabase.from('preventivas').update(base).eq('id', id));
    }
    if (error) throw error;

    // Histórico (alimenta a aba Histórico e o Calendário de Leituras).
    const { data: { user } } = await supabase.auth.getUser();
    let nome = user?.email || 'Sistema';
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      nome = profile?.full_name || user.email || 'Usuário';
    }
    const linha: Record<string, any> = {
      equipamento_id: (atual as any).equipamento_id || null,
      placa: eq?.placa || '—',
      tipo: eq?.tipo || null,
      categoria: eq?.categoria || null,
      unidade,
      valor_anterior: (atual as any).horimetro_atual ?? null,
      valor_novo: dados.horimetro_atual,
      origem: 'ATUALIZACAO_MODAL',
      observacoes: dados.observacoes || null,
      atualizado_por: user?.id || null,
      atualizado_por_nome: nome,
    };
    const linhaKm = {
      ...linha,
      data_referencia: dados.data_referencia,
      km_anterior: unidade === 'km' ? ((atual as any).horimetro_atual ?? null) : ((atual as any).km_atual ?? null),
      km_novo: unidade === 'km' ? dados.horimetro_atual : (comKm.km_atual ?? null),
    };
    let { error: histErr } = await supabase.from('historico_horimetros').insert(linhaKm);
    if (histErr && colunaInexistente(histErr)) {
      ({ error: histErr } = await supabase.from('historico_horimetros').insert(linha));
    }
    if (histErr) console.error('[Horímetro e KM] Falha ao registrar histórico:', histErr);

    revalidatePath('/preventivas');
    return { success: true, kmGravado };
  } catch (error: any) {
    return { error: error.message || 'Erro ao atualizar horímetro e KM' };
  }
}

/** Leituras (histórico) cuja data cai no intervalo — pro Calendário de Leituras. */
export async function getLeiturasHorimetroKm(inicio: string, fim: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    const cols = 'id, equipamento_id, placa, unidade, valor_anterior, valor_novo, origem, observacoes, atualizado_por_nome, atualizado_em';

    // Leitura nova tem data_referencia; as antigas (antes do KM) só têm atualizado_em.
    // Margem de 1 dia no atualizado_em por causa do fuso (UTC x horário de Brasília).
    const ini = new Date(inicio + 'T00:00:00Z'); ini.setUTCDate(ini.getUTCDate() - 1);
    const fimMais = new Date(fim + 'T00:00:00Z'); fimMais.setUTCDate(fimMais.getUTCDate() + 2);
    const { data, error } = await supabase
      .from('historico_horimetros')
      .select(cols + ', km_anterior, km_novo, data_referencia')
      .or(`and(data_referencia.gte.${inicio},data_referencia.lte.${fim}),and(data_referencia.is.null,atualizado_em.gte.${ini.toISOString()},atualizado_em.lt.${fimMais.toISOString()})`)
      .order('atualizado_em', { ascending: true })
      .limit(5000);

    if (error && colunaInexistente(error)) {
      const r = await supabase
        .from('historico_horimetros')
        .select(cols)
        .gte('atualizado_em', ini.toISOString())
        .lt('atualizado_em', fimMais.toISOString())
        .order('atualizado_em', { ascending: true })
        .limit(5000);
      if (r.error) throw new Error(r.error.message);
      return { data: r.data || [] };
    }
    if (error) throw new Error(error.message);
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getHistoricoHorimetros(limit: number = 1000) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();

    const { data, error } = await supabase
      .from('historico_horimetros')
      .select('*')
      .order('atualizado_em', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return { data: data || [] };
  } catch (error: any) {
    return { error: error.message };
  }
}
