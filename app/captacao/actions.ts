'use server'

import { revalidatePath } from 'next/cache';
import { CaptacaoService } from '@/src/services/CaptacaoService';
import { FichaCaptacao, LancamentoCaptacao } from '@/src/models/captacao';

export async function criarFicha(data: Omit<FichaCaptacao, 'id' | 'status' | 'created_at'>) {
  try {
    const result = await CaptacaoService.createFicha(data);
    revalidatePath('/captacao');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Erro na action criarFicha:", error);
    return { error: error.message || "Erro ao criar ficha de captação." };
  }
}

export async function atualizarFicha(id: string, updates: Partial<FichaCaptacao>) {
  try {
    const result = await CaptacaoService.updateFicha(id, updates);
    revalidatePath('/captacao');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Erro na action atualizarFicha:", error);
    return { error: error.message || "Erro ao atualizar ficha de captação." };
  }
}

export async function excluirFicha(id: string) {
  try {
    await CaptacaoService.deleteFicha(id);
    revalidatePath('/captacao');
    return { success: true };
  } catch (error: any) {
    console.error("Erro na action excluirFicha:", error);
    return { error: error.message || "Erro ao excluir ficha de captação." };
  }
}

export async function fecharFicha(id: string) {
  try {
    const result = await CaptacaoService.updateFicha(id, { status: 'Fechada' });
    revalidatePath('/captacao');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Erro na action fecharFicha:", error);
    return { error: error.message || "Erro ao fechar ficha." };
  }
}

export async function adicionarLancamento(data: Omit<LancamentoCaptacao, 'id' | 'created_at'>) {
  try {
    const result = await CaptacaoService.addLancamento(data);
    revalidatePath('/captacao');
    return { success: true, data: result };
  } catch (error: any) {
    console.error("Erro na action adicionarLancamento:", error);
    return { error: error.message || "Erro ao adicionar lançamento de captação." };
  }
}

export async function excluirLancamento(id: string) {
  try {
    await CaptacaoService.deleteLancamento(id);
    revalidatePath('/captacao');
    return { success: true };
  } catch (error: any) {
    console.error("Erro na action excluirLancamento:", error);
    return { error: error.message || "Erro ao excluir lançamento de captação." };
  }
}
