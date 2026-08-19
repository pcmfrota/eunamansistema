"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { registrarExclusao, registrarExclusoesEmLote } from "@/lib/audit-log";

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

export type DocCrlve = {
  id: string;
  local: string;
  co: string;
  placa: string;
  ano: string;
  data_vencimento: string;
  observacoes?: string;
  anexo_url?: string;
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
  return data;
}

export async function getCivCipps() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_civ_cipp').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getCivCipps:", error);
    return [];
  }
  return data;
}

export async function getLaudosEletro() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_laudo_eletromecanico').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getLaudosEletro:", error);
    return [];
  }
  return data;
}

export async function getLaudosImplemento() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_laudo_implemento').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getLaudosImplemento:", error);
    return [];
  }
  return data;
}

export async function getCrlvePesados() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_crlve_pesados').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getCrlvePesados:", error);
    return [];
  }
  return data;
}

export async function getCrlveLeve() {
  const supabase = createClient();
  const { data, error } = await supabase.from('docs_crlve_leve').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error("Erro getCrlveLeve:", error);
    return [];
  }
  return data;
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
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, data_vencimento, anexo_url };

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

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_tacografo').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_tacografo antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_tacografo').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'Tacógrafo',
    tabelaOrigem: 'docs_tacografo',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

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
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, data_vencimento, anexo_url };

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

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_civ_cipp').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_civ_cipp antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_civ_cipp').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'CIV/CIPP',
    tabelaOrigem: 'docs_civ_cipp',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

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
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, periodo, data_expedicao, data_vencimento, observacoes, anexo_url };

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

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_laudo_eletromecanico').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_laudo_eletromecanico antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_laudo_eletromecanico').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'Laudo Eletromecânico',
    tabelaOrigem: 'docs_laudo_eletromecanico',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

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
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, periodo, data_expedicao, data_vencimento, observacoes, anexo_url };

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

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_laudo_implemento').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_laudo_implemento antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_laudo_implemento').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'Laudo Implemento',
    tabelaOrigem: 'docs_laudo_implemento',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

  revalidatePath('/documentos');
  return { success: true };
}

// CRLVE Pesados
export async function upsertCrlvePesados(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const rawDate = formData.get('data_vencimento') as string | null;
  const data_vencimento = rawDate && rawDate.trim() !== "" ? rawDate : null;
  const ano = formData.get('ano') as string;
  const observacoes = formData.get('observacoes') as string;
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, data_vencimento, ano, observacoes, anexo_url };

  if (id) {
    const { error } = await supabase.from('docs_crlve_pesados').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    const { error } = await supabase.from('docs_crlve_pesados').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteCrlvePesados(id: string) {
  const supabase = createClient();

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_crlve_pesados').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_crlve_pesados antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_crlve_pesados').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'CRLVE Pesados',
    tabelaOrigem: 'docs_crlve_pesados',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

  revalidatePath('/documentos');
  return { success: true };
}

// CRLVE Leve
export async function upsertCrlveLeve(formData: FormData) {
  const supabase = createClient();
  
  const id = formData.get('id') as string | null;
  const local = formData.get('local') as string;
  const co = formData.get('co') as string;
  const placa = formData.get('placa') as string;
  const rawDate = formData.get('data_vencimento') as string | null;
  const data_vencimento = rawDate && rawDate.trim() !== "" ? rawDate : null;
  const ano = formData.get('ano') as string;
  const observacoes = formData.get('observacoes') as string;
  const anexo_url = formData.get('anexo_url') as string;

  const payload = { local, co, placa, data_vencimento, ano, observacoes, anexo_url };

  if (id) {
    const { error } = await supabase.from('docs_crlve_leve').update(payload).eq('id', id);
    if (error) return { error: error.message };
  } else {
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';
    const { error } = await supabase.from('docs_crlve_leve').insert({ ...payload, filial_id: filialId });
    if (error) return { error: error.message };
  }

  revalidatePath('/documentos');
  return { success: true };
}

export async function deleteCrlveLeve(id: string) {
  const supabase = createClient();

  let row: any = null;
  try {
    const { data } = await supabase.from('docs_crlve_leve').select('*').eq('id', id).maybeSingle();
    row = data;
  } catch (err) {
    console.warn('Falha ao buscar snapshot de docs_crlve_leve antes de excluir:', err);
  }

  const { error } = await supabase.from('docs_crlve_leve').delete().eq('id', id);
  if (error) return { error: error.message };

  await registrarExclusao({
    supabase,
    modulo: 'CRLVE Leve',
    tabelaOrigem: 'docs_crlve_leve',
    registroId: id,
    descricao: `${row?.placa || ''} — ${row?.local || ''} (${row?.co || ''})`,
    dados: row,
  });

  revalidatePath('/documentos');
  return { success: true };
}

// Importador unificado de planilhas para Documentos da Frota
export async function importarDocumentos(tabela: string, rows: any[]) {
  try {
    const supabase = createClient();
    const { cookies } = await import('next/headers');
    const filialId = cookies().get('x-user-filial')?.value || 'MATRIZ';

    const mapped = rows.map(row => {
      const getVal = (aliases: string[]) => {
        for (const alias of aliases) {
          const val = row[alias];
          if (val !== undefined && val !== null && val !== '') return val;
          const key = Object.keys(row).find(k => k.toLowerCase().trim() === alias.toLowerCase().trim());
          if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
        }
        return null;
      };

      const placaVal = String(getVal(['placa', 'veiculo', 'veículo', 'equipamento', 'placa_veiculo']) || '').toUpperCase().trim();
      if (!placaVal) return null;

      const dataVencRaw = getVal([
        'data_vencimento', 'vencimento', 'validade', 'venc', 'data vencimento',
        'tacografo (venc)', 'tacógrafo (venc)', 'civ e cipp (venc)', 'civ/cipp (venc)', 'civ e cipp', 'tacógrafo', 'tacografo'
      ]);
      let data_vencimento: string | null = null;
      if (dataVencRaw) {
        if (typeof dataVencRaw === 'number') {
          const date = new Date((dataVencRaw - 25569) * 86400 * 1000);
          data_vencimento = date.toISOString().slice(0, 10);
        } else {
          const str = String(dataVencRaw).trim();
          if (str.includes('/')) {
            const parts = str.split('/');
            if (parts.length === 3) {
              data_vencimento = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          } else if (str.includes('-')) {
            data_vencimento = str.slice(0, 10);
          }
        }
      }

      const baseRow: any = {
        placa: placaVal,
        local: String(getVal(['local', 'setor', 'modulo', 'módulo', 'area', 'área']) || 'BASE').toUpperCase().trim(),
        co: String(getVal(['co', 'c.o', 'tipo', 'descricao', 'descrição', 'categoria']) || 'OUTROS').toUpperCase().trim(),
        filial_id: filialId,
        data_vencimento: data_vencimento
      };

      if (tabela === 'docs_laudo_eletromecanico' || tabela === 'docs_laudo_implemento') {
        const dataExpRaw = getVal(['data_expedicao', 'expedicao', 'expedição', 'data_exp', 'data expedicao']);
        let data_expedicao = new Date().toISOString().slice(0, 10);
        if (dataExpRaw) {
          if (typeof dataExpRaw === 'number') {
            const date = new Date((dataExpRaw - 25569) * 86400 * 1000);
            data_expedicao = date.toISOString().slice(0, 10);
          } else {
            const str = String(dataExpRaw).trim();
            if (str.includes('/')) {
              const parts = str.split('/');
              if (parts.length === 3) {
                data_expedicao = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (str.includes('-')) {
              data_expedicao = str.slice(0, 10);
            }
          }
        }
        baseRow.data_expedicao = data_expedicao;
        baseRow.periodo = String(getVal(['periodo', 'período', 'vigencia', 'vigência']) || '6 MESES').toUpperCase().trim();
        baseRow.observacoes = getVal(['observacoes', 'observação', 'obs']) ? String(getVal(['observacoes', 'observação', 'obs'])).trim() : null;
      }

      if (tabela === 'docs_crlve_pesados' || tabela === 'docs_crlve_leve') {
        baseRow.ano = getVal(['ano', 'exercicio', 'exercício']) ? String(getVal(['ano', 'exercicio', 'exercício'])).trim() : new Date().getFullYear().toString();
        baseRow.observacoes = getVal(['observacoes', 'observação', 'obs']) ? String(getVal(['observacoes', 'observação', 'obs'])).trim() : null;
      }

      return baseRow;
    }).filter(Boolean);

    if (mapped.length === 0) {
      return { error: 'Nenhum registro válido encontrado para importação.' };
    }

    // Para evitar duplicidade de registros ativos, deletamos placas que já constam na lista
    const placas = mapped.map(m => m.placa);
    if (placas.length > 0) {
      let rowsToDelete: any[] = [];
      try {
        const { data } = await supabase.from(tabela).select('*').in('placa', placas);
        rowsToDelete = data || [];
      } catch (err) {
        console.warn(`Falha ao buscar snapshot de ${tabela} antes de excluir por importação:`, err);
      }

      await supabase.from(tabela).delete().in('placa', placas);

      if (rowsToDelete.length > 0) {
        const MODULO_POR_TABELA: Record<string, string> = {
          docs_tacografo: 'Tacógrafo',
          docs_civ_cipp: 'CIV/CIPP',
          docs_laudo_eletromecanico: 'Laudo Eletromecânico',
          docs_laudo_implemento: 'Laudo Implemento',
          docs_crlve_pesados: 'CRLVE Pesados',
          docs_crlve_leve: 'CRLVE Leve',
        };
        const moduloNome = MODULO_POR_TABELA[tabela] || tabela;

        await registrarExclusoesEmLote(
          supabase,
          moduloNome,
          tabela,
          rowsToDelete.map(r => ({
            registroId: r.id,
            descricao: `${r.placa || ''} — ${r.local || ''}`,
            dados: r,
          })),
          'DIRETO'
        );
      }
    }

    const { error } = await supabase.from(tabela).insert(mapped);
    if (error) return { error: error.message };

    revalidatePath('/documentos');
    return { success: true, count: mapped.length };
  } catch (err: any) {
    return { error: err.message || String(err) };
  }
}

