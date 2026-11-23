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

/**
 * Dados do "Dashboard KM & Horímetro": SOMENTE frotas ativas (status 'Ativo' e não
 * excluídas, filtrado no banco) + as leituras delas entre `desde` e `fim`.
 * `desde` já vem com folga antes do período (base da última leitura anterior e período
 * de comparação). A data de cada leitura é resolvida aqui: data_referencia (modal) ou o
 * dia em Brasília do atualizado_em (leituras antigas).
 */
export async function getDashboardKmHorimetro(desde: string, fim: string): Promise<
  | { equipamentos: import('@/lib/horimetro-km-calc').EquipamentoAtivo[]; leituras: import('@/lib/horimetro-km-calc').LeituraBruta[]; rfAtual: { ano: number; mes: number; inicio: string; fim: string } | null }
  | { error: string }
> {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const { diaLocalSP } = await import('@/lib/horimetro-km-calc');
    const supabase = createClient();

    const { data: eqs, error: eqErr } = await supabase
      .from('equipamentos')
      .select('id, placa, tipo, categoria, modulo')
      .ilike('status', 'ativo')
      .is('deleted_at', null)
      .order('placa');
    if (eqErr) throw new Error(eqErr.message);
    const equipamentos = (eqs || []) as { id: string; placa: string; tipo: string | null; categoria: string | null; modulo: string | null }[];

    const hoje = diaLocalSP(new Date().toISOString());
    const { data: rf } = await supabase
      .from('calendario_suzano')
      .select('ano, mes, data_inicio, data_fim')
      .lte('data_inicio', hoje)
      .gte('data_fim', hoje)
      .limit(1);
    const rfRow = rf?.[0] as { ano: number; mes: number; data_inicio: string; data_fim: string } | undefined;
    const rfAtual = rfRow ? { ano: rfRow.ano, mes: rfRow.mes, inicio: String(rfRow.data_inicio).slice(0, 10), fim: String(rfRow.data_fim).slice(0, 10) } : null;

    if (!equipamentos.length) return { equipamentos, leituras: [], rfAtual };

    // Margem de 1 dia no atualizado_em por causa do fuso; o corte exato é feito pela data resolvida.
    const ini = new Date(desde + 'T00:00:00Z'); ini.setUTCDate(ini.getUTCDate() - 1);
    const fimMais = new Date(fim + 'T00:00:00Z'); fimMais.setUTCDate(fimMais.getUTCDate() + 2);
    const { data, error } = await supabase
      .from('historico_horimetros')
      .select('id, equipamento_id, unidade, valor_novo, km_novo, data_referencia, atualizado_em, atualizado_por_nome, observacoes')
      .in('equipamento_id', equipamentos.map(e => e.id))
      .or(`and(data_referencia.gte.${desde},data_referencia.lte.${fim}),and(data_referencia.is.null,atualizado_em.gte.${ini.toISOString()},atualizado_em.lt.${fimMais.toISOString()})`)
      .order('atualizado_em', { ascending: true })
      .limit(20000);
    if (error) throw new Error(error.message);

    type Row = { id: string; equipamento_id: string; unidade: string; valor_novo: number | string; km_novo: number | string | null; data_referencia: string | null; atualizado_em: string; atualizado_por_nome: string | null; observacoes: string | null };
    const leituras = ((data || []) as Row[])
      .filter(r => r.valor_novo != null)
      .map(r => ({
        id: r.id,
        equipamento_id: r.equipamento_id,
        unidade: r.unidade,
        valor_novo: Number(r.valor_novo),
        km_novo: r.km_novo != null ? Number(r.km_novo) : null,
        data: r.data_referencia ? String(r.data_referencia).slice(0, 10) : diaLocalSP(r.atualizado_em),
        ordem: r.atualizado_em,
        por: r.atualizado_por_nome,
        obs: r.observacoes,
      }))
      .filter(l => l.data >= desde && l.data <= fim);

    return { equipamentos, leituras, rfAtual };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
