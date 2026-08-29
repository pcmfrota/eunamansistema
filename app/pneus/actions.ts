'use server'

import { PneusService } from '@/src/services/PneusService';
import { revalidatePath } from 'next/cache';
import { getCurrentLocalDate } from '@/src/utils/dateUtils';
import { createClient } from '@/utils/supabase/server';

const POSICOES = ['de','dd','tei','tee','tdi','tde','tei1','tee1','tdi1','tde1','estepe'] as const

// Cada posição vira 3 chaves de sulco: a base (sem sufixo) é o Sulco 2 (meio, mesmo campo
// já usado no Dashboard/gráficos principais), "_s1" é o Sulco 1 (lado direito) e "_s3" é o
// Sulco 3 (lado esquerdo). A condição geral do boletim considera o pior valor entre os 3
// sulcos de todas as posições — um lado bem desgastado não pode passar despercebido só
// porque o meio do pneu ainda está bom.
const CAMPOS_SULCO = POSICOES.flatMap(pos => [pos, `${pos}_s1`, `${pos}_s3`] as const)

function lerSulcosDoFormData(formData: FormData) {
  const posicoes: Record<string, number | null> = {};
  for (const campo of CAMPOS_SULCO) {
    const v = formData.get(campo);
    posicoes[campo] = v && v !== '' ? parseFloat(v as string) : null;
  }
  return posicoes;
}

// Quem está autenticado no momento — grava em cada boletim pra alimentar o Histórico
// e a restrição de visualização por usuário (mecânico só vê o que ele mesmo lançou).
async function getUsuarioAtual() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { registrado_por: null, registrado_por_nome: null };

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle();

  return {
    registrado_por: user.id,
    registrado_por_nome: profile?.full_name || user.email || 'Usuário',
  };
}

export async function registrarInspecaoPneu(formData: FormData) {
  try {
    const sulco_mm = parseFloat(formData.get('sulco_mm') as string);
    const posicoes: any = { [formData.get('eixo') as string]: sulco_mm };
    const condicao = PneusService.calcCondicao(posicoes);
    const usuario = await getUsuarioAtual();

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: getCurrentLocalDate(),
      km_atual: null,
      condicao,
      ...posicoes,
      ...usuario
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
    const posicoes = lerSulcosDoFormData(formData);

    const rawCondicao = formData.get('condicao') as string;
    const condicao = PneusService.sanitizeCondicao(rawCondicao, PneusService.calcCondicao(posicoes));
    const usuario = await getUsuarioAtual();

    const data = {
      equipamento_id: formData.get('equipamento_id') as string,
      data_inspecao: formData.get('data_inspecao')?.toString().split('T')[0] + 'T12:00:00',
      km_atual: formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null,
      horimetro_registro: formData.get('horimetro_registro') ? parseFloat(formData.get('horimetro_registro') as string) : null,
      observacoes: formData.get('observacoes') as string,
      condicao,
      ...posicoes,
      ...usuario
    };

    const res = await PneusService.create(data);

    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true, data: res.data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarInspecao(id: string, formData: FormData) {
  try {
    const posicoes = lerSulcosDoFormData(formData);

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

    const res = await PneusService.update(id, data);

    revalidatePath('/pneus');
    revalidatePath('/');
    return { success: true, data: res.data };
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
