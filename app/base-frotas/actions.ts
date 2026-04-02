'use server'

import { EquipamentoService } from '@/src/services/EquipamentoService';
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
      ultimoHist: parseFloat(formData.get('horimetro') as string) || 0
    };

    await EquipamentoService.create(data);
    
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
      ultimoHist: parseFloat(formData.get('horimetro') as string) || 0
    };

    await EquipamentoService.update(id, data);
    
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
