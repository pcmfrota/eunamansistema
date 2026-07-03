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

export async function encerrarBacklogs(ids: string[], osNumero: string, dataConclusao: string) {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    
    const { data, error } = await supabase
      .from('backlog')
      .update({
        status: 'ENCERRADO',
        os: osNumero,
        data_conclusao: dataConclusao
      })
      .in('id', ids)
      .select();
      
    if (error) throw new Error(error.message);
    revalidatePath('/backlog');
    revalidatePath('/os');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function syncRolePermissions() {
  try {
    const { createClient } = await import('@/utils/supabase/server');
    const supabase = createClient();
    
    const { data: permissionsList, error: getError } = await supabase
      .from('role_permissions')
      .select('role, allowed_tabs');
      
    if (getError) throw new Error(getError.message);
    
    if (permissionsList && permissionsList.length > 0) {
      for (const row of permissionsList) {
        let changed = false;
        const tabs = row.allowed_tabs || [];
        
        if (['admin', 'pcm', 'gestao', 'mecanico'].includes(row.role)) {
          if (!tabs.includes('/afiacao')) {
            tabs.push('/afiacao');
            changed = true;
          }
        }
        
        if (['admin', 'pcm', 'gestao', 'mecanico', 'motorista'].includes(row.role)) {
          if (!tabs.includes('/captacao')) {
            tabs.push('/captacao');
            changed = true;
          }
          if (!tabs.includes('/documentos')) {
            tabs.push('/documentos');
            changed = true;
          }
        }
        
        if (['admin', 'pcm', 'gestao', 'mecanico'].includes(row.role)) {
          if (!tabs.includes('/checklist-mecanicos')) {
            tabs.push('/checklist-mecanicos');
            changed = true;
          }
        }
        
        if (changed) {
          await supabase
            .from('role_permissions')
            .update({ allowed_tabs: tabs })
            .eq('role', row.role);
        }
      }
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("Erro ao sincronizar permissões:", error);
    return { error: error.message };
  }
}

