'use server'

import { EquipamentoService } from '@/src/services/EquipamentoService';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function buscarEquipamentos() {
  return await EquipamentoService.getAll();
}

export async function criarEquipamento(formData: FormData) {
  try {
    const data = {
      placa: (formData.get('placa') as string),
      tipo: (formData.get('tipo') as string),
      categoria: (formData.get('categoria') as string),
      modulo: (formData.get('modulo') as string),
    };

    await EquipamentoService.create(data);

    // Após criar, busca o ID do equipamento recém-criado para salvar horímetro
    const horimetroVal = parseFloat(formData.get('horimetro') as string);
    if (horimetroVal && horimetroVal > 0) {
      const supabase = createClient();
      const { data: eqCriado } = await supabase
        .from('equipamentos')
        .select('id')
        .eq('placa', data.placa.toUpperCase().trim())
        .single();

      if (eqCriado) {
        const dataRef = (formData.get('ultimaAtualizacao') as string) || new Date().toISOString().slice(0, 10);
        await supabase.from('horimetros').upsert({
          equipamento_id: eqCriado.id,
          data_referencia: dataRef,
          horimetro_inicial: 0,
          horimetro_final: horimetroVal,
          observacoes: 'Cadastro inicial via Base de Frotas',
        }, { onConflict: 'equipamento_id,data_referencia' });
      }
    }
    
    revalidatePath('/base-frotas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarEquipamento(id: string, formData: FormData) {
  try {
    const data = {
      placa: (formData.get('placa') as string),
      tipo: (formData.get('tipo') as string),
      categoria: (formData.get('categoria') as string),
      modulo: (formData.get('modulo') as string),
    };

    await EquipamentoService.update(id, data);

    // Salvar horímetro na tabela horimetros
    const horimetroVal = parseFloat(formData.get('horimetro') as string);
    if (!isNaN(horimetroVal) && horimetroVal > 0) {
      const supabase = createClient();
      const dataRef = (formData.get('ultimaAtualizacao') as string) || new Date().toISOString().slice(0, 10);

      // Busca o último registro deste equipamento para usar como horimetro_inicial
      const { data: ultimoReg } = await supabase
        .from('horimetros')
        .select('horimetro_final')
        .eq('equipamento_id', id)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .single();

      const horInicial = ultimoReg?.horimetro_final || 0;

      await supabase.from('horimetros').insert({
        equipamento_id: id,
        data_referencia: dataRef,
        horimetro_inicial: horInicial,
        horimetro_final: horimetroVal,
        observacoes: 'Atualizado via Base de Frotas',
      });
    }
    
    revalidatePath('/base-frotas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirEquipamento(id: string) {
  try {
    await EquipamentoService.delete(id);
    revalidatePath('/base-frotas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirEquipamentosMassivo(ids: string[]) {
  try {
    await EquipamentoService.deleteBulk(ids);
    revalidatePath('/base-frotas');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarEquipamentos(rows: any[]) {
  try {
    const result = await EquipamentoService.import(rows);
    revalidatePath('/base-frotas');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}
