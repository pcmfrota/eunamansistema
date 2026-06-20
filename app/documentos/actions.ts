"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type DocTacografo = {
  id: string;
  local: string;
  co: string;
  placa: string;
  data_vencimento: string;
  filial_id: string;
  created_at?: string;
};

export type DocCivCipp = {
  id: string;
  local: string;
  co: string;
  placa: string;
  data_vencimento: string;
  filial_id: string;
  created_at?: string;
};

export type DocLaudoEletromecanico = {
  id: string;
  local: string;
  co: string;
  placa: string;
  periodo: string;
  data_expedicao: string;
  data_vencimento: string;
  observacoes?: string;
  filial_id: string;
  created_at?: string;
};

export type DocLaudoImplemento = {
  id: string;
  local: string;
  co: string;
  placa: string;
  periodo: string;
  data_expedicao: string;
  data_vencimento: string;
  observacoes?: string;
  filial_id: string;
  created_at?: string;
};

// ── GET Functions ─────────────────────────────────────────────────────────────

export async function getTacografos() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_tacografo').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getTacografos:", error);
    return [];
  }
  return data as DocTacografo[];
}

export async function getCivCipps() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_civ_cipp').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getCivCipps:", error);
    return [];
  }
  return data as DocCivCipp[];
}

export async function getLaudosEletro() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_laudo_eletromecanico').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getLaudosEletro:", error);
    return [];
  }
  return data as DocLaudoEletromecanico[];
}

export async function getLaudosImplemento() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_laudo_implemento').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getLaudosImplemento:", error);
    return [];
  }
  return data as DocLaudoImplemento[];
}

// ── CREATE / UPDATE / DELETE Functions ────────────────────────────────────────

// Tacografo
export async function upsertTacografo(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const data_vencimento = formData.get('data_vencimento') as string;

  const payload = { local, co, placa, data_vencimento };

  if (id) {
    const { error } = await supabase.from('docs_tacografo').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    // Pegar a filial_id do auth seria ideal, mas as tabelas têm triggers ou policies? 
    // Como estamos usando cookies pra context ou o db injeta default?
    // Se precisarmos injetar, podemos puxar dos cookies. Como não temos certeza do padrão do seu BD, 
    // assumimos que a policy fará o check, mas para a inserção precisaremos definir a filial.
    // Lendo o 'getFiliais' anterior, a filial está no cookie 'x-user-filial'.
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    
    const { error } = await supabase.from('docs_tacografo').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteTacografo(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('docs_tacografo').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/documentos');
  return { success: true };
}

// CIV/CIPP
export async function upsertCivCipp(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const rawDate = formData.get('data_vencimento') as string | null;
  const data_vencimento = rawDate && rawDate.trim() !== "" ? rawDate : null;

  const payload = { local, co, placa, data_vencimento };

  if (id) {
    const { error } = await supabase.from('docs_civ_cipp').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    const { error } = await supabase.from('docs_civ_cipp').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteCivCipp(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('docs_civ_cipp').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/documentos');
  return { success: true };
}

// Laudo Eletromecanico
export async function upsertLaudoEletro(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const periodo = formData.get('periodo') as string;
  const data_expedicao = formData.get('data_expedicao') as string;
  const data_vencimento = formData.get('data_vencimento') as string;
  const observacoes = formData.get('observacoes') as string;

  const payload = { local, co, placa, periodo, data_expedicao, data_vencimento, observacoes };

  if (id) {
    const { error } = await supabase.from('docs_laudo_eletromecanico').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    const { error } = await supabase.from('docs_laudo_eletromecanico').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteLaudoEletro(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('docs_laudo_eletromecanico').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/documentos');
  return { success: true };
}

// Laudo Implemento
export async function upsertLaudoImplemento(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const periodo = formData.get('periodo') as string;
  const data_expedicao = formData.get('data_expedicao') as string;
  const data_vencimento = formData.get('data_vencimento') as string;
  const observacoes = formData.get('observacoes') as string;

  const payload = { local, co, placa, periodo, data_expedicao, data_vencimento, observacoes };

  if (id) {
    const { error } = await supabase.from('docs_laudo_implemento').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    const { error } = await supabase.from('docs_laudo_implemento').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteLaudoImplemento(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('docs_laudo_implemento').delete().eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/documentos');
  return { success: true };
}
