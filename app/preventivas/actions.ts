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

    if (dados.horimetro_atual !== undefined) {
      if (atual?.horimetro_atual != null && dados.horimetro_atual < atual.horimetro_atual) {
        throw new Error(`O horímetro/km não pode ser menor que o último valor registrado (${atual.horimetro_atual}).`);
      }
    }

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
