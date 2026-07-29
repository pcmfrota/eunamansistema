'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

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
    const { error } = await supabase
      .from('fichas_mao_obra')
      .delete()
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
