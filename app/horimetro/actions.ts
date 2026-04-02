'use server'

import { HorimetroService } from '@/src/services/HorimetroService';
import { revalidatePath } from 'next/cache';

export async function registrarHorimetro(formData: FormData) {
  try {
    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_referencia: (formData.get('data_referencia') || formData.get('data')) as string,
      horimetro_inicial: parseFloat(formData.get('horimetro_inicial') as string),
      horimetro_final: parseFloat(formData.get('horimetro_final') as string),
      observacoes: formData.get('observacoes') as string
    };

    await HorimetroService.create(data);
    
    revalidatePath('/horimetro');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarHorimetro(id: string, formData: FormData) {
  try {
    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_referencia: formData.get('data_referencia') as string,
      horimetro_inicial: parseFloat(formData.get('horimetro_inicial') as string),
      horimetro_final: parseFloat(formData.get('horimetro_final') as string),
      observacoes: formData.get('observacoes') as string
    };

    await HorimetroService.update(id, data);
    
    revalidatePath('/horimetro');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirHorimetro(id: string) {
  try {
    await HorimetroService.delete(id);
    revalidatePath('/horimetro');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
