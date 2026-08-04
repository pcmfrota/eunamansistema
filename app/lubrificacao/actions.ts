'use server';

import { LubrificacaoService, FichaLubrificacao } from '@/src/services/LubrificacaoService';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function obterFichasLubrificacao() {
  try {
    const data = await LubrificacaoService.getAll();
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message || 'Erro ao buscar fichas de lubrificação' };
  }
}

export async function obterEquipamentosLubrificacao() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('equipamentos')
      .select('id, placa, modulo, tipo, area')
      .is('deleted_at', null)
      .order('placa', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { error: error.message || 'Erro ao buscar equipamentos' };
  }
}

export async function obterMecanicosLubrificacao() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('colaboradores')
      .select('id, nome, cargo')
      .order('nome', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (error: any) {
    return { error: error.message || 'Erro ao buscar colaboradores' };
  }
}

export async function registrarFichaLubrificacao(payload: Partial<FichaLubrificacao>) {
  try {
    const res = await LubrificacaoService.create(payload);
    revalidatePath('/lubrificacao');
    revalidatePath('/');
    return { success: true, data: res };
  } catch (error: any) {
    return { error: error.message || 'Erro ao salvar ficha de lubrificação' };
  }
}

export async function atualizarFichaLubrificacao(id: string, payload: Partial<FichaLubrificacao>) {
  try {
    const res = await LubrificacaoService.update(id, payload);
    revalidatePath('/lubrificacao');
    revalidatePath('/');
    return { success: true, data: res };
  } catch (error: any) {
    return { error: error.message || 'Erro ao atualizar ficha de lubrificação' };
  }
}

export async function excluirFichaLubrificacao(id: string) {
  try {
    await LubrificacaoService.delete(id);
    revalidatePath('/lubrificacao');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message || 'Erro ao excluir ficha de lubrificação' };
  }
}
