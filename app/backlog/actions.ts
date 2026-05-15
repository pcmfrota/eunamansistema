'use server'

import { BacklogService } from '@/src/services/BacklogService';
import { revalidatePath } from 'next/cache';

export async function getBacklog(limit: number = 5000) {
  try {
    const data = await BacklogService.getAll(limit);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function upsertBacklogItem(item: any) {
  try {
    const { data } = await BacklogService.upsert(item);
    revalidatePath('/backlog');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function deleteBacklogItems(ids: string[]) {
  try {
    await BacklogService.deleteBulk(ids);
    revalidatePath('/backlog');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function importarBacklog(rows: any[]) {
  try {
    const result = await BacklogService.import(rows);
    revalidatePath('/backlog');
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}
