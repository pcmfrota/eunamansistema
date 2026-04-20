'use server'

import { PneusService } from '@/src/services/PneusService';
import { revalidatePath } from 'next/cache';
import { getCurrentLocalDate } from '@/src/utils/dateUtils';

const POSICOES = ['de','dd','tei','tee','tdi','tde','tei1','tee1','tdi1','tde1','estepe'] as const

export async function registrarInspecaoPneu(formData: FormData) {
  try {
    const sulco_mm = parseFloat(formData.get('sulco_mm') as string);
    const posicoes: any = { [formData.get('eixo') as string]: sulco_mm };
    const condicao = PneusService.calcCondicao(posicoes);

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: getCurrentLocalDate(),
      km_atual: null,
      condicao,
      ...posicoes
    };

    await PneusService.create(data);
    
    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarInspecoesPneus(rows: any[]) {
  try {
    const result = await PneusService.import(rows);
    revalidatePath('/pneus');
    revalidatePath('/');
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function registrarInspecaoCompleta(formData: FormData) {
  try {
    const posicoes: any = {};
    for (const pos of POSICOES) {
      const v = formData.get(pos);
      posicoes[pos] = v && v !== '' ? parseFloat(v as string) : null;
    }

    const rawCondicao = formData.get('condicao') as string;
    const condicao = PneusService.sanitizeCondicao(rawCondicao, PneusService.calcCondicao(posicoes));

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: formData.get('data_inspecao')?.toString().split('T')[0] + 'T12:00:00',
      km_atual: formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null,
      horimetro_registro: formData.get('horimetro_registro') ? parseFloat(formData.get('horimetro_registro') as string) : null,
      observacoes: formData.get('observacoes') as string,
      condicao,
      ...posicoes
    };

    await PneusService.create(data);
    
    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarInspecao(id: string, formData: FormData) {
  try {
    const posicoes: any = {};
    for (const pos of POSICOES) {
      const v = formData.get(pos);
      posicoes[pos] = v && v !== '' ? parseFloat(v as string) : null;
    }

    const rawCondicao = formData.get('condicao') as string;
    const condicao = PneusService.sanitizeCondicao(rawCondicao, PneusService.calcCondicao(posicoes));

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: formData.get('data_inspecao')?.toString().split('T')[0] + 'T12:00:00',
      km_atual: formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null,
      horimetro_registro: formData.get('horimetro_registro') ? parseFloat(formData.get('horimetro_registro') as string) : null,
      observacoes: formData.get('observacoes') as string,
      condicao,
      ...posicoes
    };

    await PneusService.update(id, data);
    
    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirInspecao(id: string) {
  try {
    await PneusService.delete(id);
    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirInspecoesMassivo(ids: string[]) {
  try {
    await PneusService.deleteBulk(ids);
    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
