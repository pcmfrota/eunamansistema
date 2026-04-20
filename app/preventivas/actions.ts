'use server'

import { PreventivaService } from '@/src/services/PreventivaService';
import { revalidatePath } from 'next/cache';

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
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirPreventiva(id: string) {
  try {
    await PreventivaService.delete(id);
    revalidatePath('/preventivas');
    revalidatePath('/');
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
    const { error } = await supabase
      .from('preventivas')
      .update({ ...dados, data_atualizacao: dados.data_atualizacao || new Date().toISOString().split('T')[0] })
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/preventivas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}


export async function importarPreventivas(data: any[]) {
  try {
    const result = await PreventivaService.importBulk(data);
    revalidatePath('/preventivas');
    revalidatePath('/');
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

    await HorimetroService.create(data);
    
    // Sincronizar com a tabela de preventivas (atualizar horímetro atual e data)
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    await supabase
      .from('preventivas')
      .update({ 
        horimetro_atual: data.horimetro_final,
        data_atualizacao: data.data_referencia 
      })
      .eq('equipamento_id', data.equipamento_id);

    revalidatePath('/preventivas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
