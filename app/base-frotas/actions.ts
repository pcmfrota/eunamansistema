'use server'

import { EquipamentoService } from '@/src/services/EquipamentoService';
import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function buscarEquipamentos() {
  return await EquipamentoService.getAll();
}

export async function buscarEquipamentosComEscala() {
  const supabase = createClient();
  const [eqs, escalas] = await Promise.all([
    EquipamentoService.getAll(),
    supabase.from('escala_frota').select('*'),
  ]);
  const escalaMap = new Map((escalas.data ?? []).map((e: any) => [
    String(e.placa ?? '').toUpperCase().replace(/\s+/g, ''),
    e,
  ]));
  return (eqs as any[]).map(eq => ({
    ...eq,
    escala: escalaMap.get(String(eq.placa ?? '').toUpperCase().replace(/\s+/g, '')) ?? null,
  }));
}

/** Salva tudo de uma vez: campos básicos + horímetro + escala */
export async function salvarVeiculoCompleto(id: string, dados: {
  tipo: string;
  categoria: string;
  modulo: string;
  area?: string;
  status: string;
  horimetro: string;
  ultimaAtualizacao: string;
  carga_horaria: string;
  periodo_inicio: string;
  periodo_fim: string;
  placa: string; // apenas leitura, precisamos para escala
}) {
  const supabase = createClient();

  // 1. Atualiza campos básicos do equipamento
  const { error: eqErr } = await supabase.from('equipamentos').update({
    tipo: dados.tipo?.toUpperCase().trim(),
    categoria: dados.categoria?.toUpperCase().trim(),
    modulo: dados.modulo?.trim(),
    area: dados.area?.toUpperCase().trim(),
    status: dados.status,
  }).eq('id', id);

  if (eqErr) return { error: `Erro ao atualizar equipamento: ${eqErr.message}` };

  // 2. Salva horímetro (delete existente + insert novo)
  const horVal = parseFloat(dados.horimetro);
  let horimetroWarning: string | null = null;
  if (!isNaN(horVal) && horVal > 0 && dados.ultimaAtualizacao) {
    try {
      const { data: ultimoReg } = await supabase
        .from('horimetros')
        .select('horimetro_final')
        .eq('equipamento_id', id)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();

      const horInicial = ultimoReg?.horimetro_final ?? 0;

      // Remove registro existente da mesma data (se houver)
      await supabase.from('horimetros')
        .delete()
        .eq('equipamento_id', id)
        .eq('data_referencia', dados.ultimaAtualizacao);

      const { error: horErr } = await supabase.from('horimetros').insert({
        equipamento_id: id,
        data_referencia: dados.ultimaAtualizacao,
        horimetro_inicial: horInicial,
        horimetro_final: horVal,
        observacoes: 'Atualizado via Base de Frotas',
      });

      if (horErr) {
        horimetroWarning = horErr.message;
        console.warn('[horimetros] Erro ao inserir:', horErr.message);
      }
    } catch (err: any) {
      horimetroWarning = err?.message;
      console.warn('[horimetros] Exceção:', err?.message);
    }
  }


  // 3. Salva escala se carga_horaria definida
  const cargaHoraria = parseFloat(dados.carga_horaria);
  if (!isNaN(cargaHoraria) && cargaHoraria > 0 && dados.placa) {
    const placaNorm = String(dados.placa).toUpperCase().replace(/\s+/g, '');
    const { error: escErr } = await supabase.from('escala_frota').upsert({
      placa: placaNorm,
      carga_horaria: cargaHoraria,
      periodo_inicio: dados.periodo_inicio || '08:00',
      periodo_fim: dados.periodo_fim || '16:00',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'placa' });

    if (escErr) return { error: `Erro ao salvar escala: ${escErr.message}` };
  }

  revalidatePath('/base-frotas');
  revalidatePath('/');
  return { success: true };
}

export async function salvarEscalaFrota(placa: string, dados: {
  carga_horaria: number;
  periodo_inicio: string;
  periodo_fim: string;
  categoria?: string;
  modelo?: string;
  modulo?: string;
  tipo?: string;
}) {
  const supabase = createClient();
  const placaNorm = String(placa).toUpperCase().replace(/\s+/g, '');
  const { error } = await supabase.from('escala_frota').upsert({
    placa: placaNorm,
    ...dados,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'placa' });
  if (error) return { error: error.message };
  revalidatePath('/base-frotas');
  revalidatePath('/');
  return { success: true };
}

export async function criarEquipamento(formData: FormData) {
  try {
    const data = {
      placa: (formData.get('placa') as string),
      tipo: (formData.get('tipo') as string),
      categoria: (formData.get('categoria') as string),
      modulo: (formData.get('modulo') as string),
      area: (formData.get('area') as string),
      status: (formData.get('status') as string) || 'Ativo',
    };

    await EquipamentoService.create(data);

    const supabase = createClient();
    const { data: eqCriado } = await supabase
      .from('equipamentos')
      .select('id')
      .eq('placa', data.placa.toUpperCase().trim())
      .single();

    if (eqCriado) {
      const horimetroVal = parseFloat(formData.get('horimetro') as string);
      const dataRef = (formData.get('ultimaAtualizacao') as string) || new Date().toISOString().slice(0, 10);

      if (!isNaN(horimetroVal)) {
        await supabase.from('horimetros')
          .delete()
          .eq('equipamento_id', eqCriado.id)
          .eq('data_referencia', dataRef);

        await supabase.from('horimetros').insert({
          equipamento_id: eqCriado.id,
          data_referencia: dataRef,
          horimetro_inicial: 0,
          horimetro_final: horimetroVal,
          observacoes: 'Cadastro inicial via Base de Frotas',
        });
      }

      // Salva escala do novo veículo
      const cargaHoraria = parseFloat(formData.get('carga_horaria') as string);
      if (!isNaN(cargaHoraria) && cargaHoraria > 0) {
        const placaNorm = data.placa.toUpperCase().replace(/\s+/g, '');
        await supabase.from('escala_frota').upsert({
          placa: placaNorm,
          carga_horaria: cargaHoraria,
          periodo_inicio: (formData.get('periodo_inicio') as string) || '08:00',
          periodo_fim: (formData.get('periodo_fim') as string) || '16:00',
        }, { onConflict: 'placa' });
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
      area: (formData.get('area') as string),
      status: (formData.get('status') as string) || 'Ativo',
    };

    await EquipamentoService.update(id, data);

    const supabase = createClient();
    const horimetroVal = parseFloat(formData.get('horimetro') as string);
    const dataRef = (formData.get('ultimaAtualizacao') as string) || new Date().toISOString().slice(0, 10);

    // Salva horímetro (delete + insert)
    if (!isNaN(horimetroVal)) {
      const { data: ultimoReg } = await supabase
        .from('horimetros')
        .select('horimetro_final')
        .eq('equipamento_id', id)
        .order('data_referencia', { ascending: false })
        .limit(1)
        .maybeSingle();

      const horInicial = ultimoReg?.horimetro_final ?? 0;

      await supabase.from('horimetros')
        .delete()
        .eq('equipamento_id', id)
        .eq('data_referencia', dataRef);

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

export async function buscarColaboradores() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('colaboradores')
      .select('*')
      .order('tipo', { ascending: false }) // 'MOTORISTA' then 'MECÂNICO'
      .order('nome', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (error: any) {
    console.error('Erro ao buscar colaboradores:', error);
    return [];
  }
}

export async function criarColaborador(dados: {
  nome: string;
  matricula?: string;
  tipo?: string;
  cargo?: string;
  local?: string;
  status?: string;
}) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('colaboradores')
      .insert([{
        nome: dados.nome.trim(),
        matricula: dados.matricula?.trim(),
        tipo: dados.tipo || 'MECÂNICO',
        cargo: dados.cargo?.trim(),
        local: dados.local?.trim(),
        status: dados.status || 'Ativo',
      }])
      .select()
      .single();
    if (error) throw error;
    revalidatePath('/base-frotas');
    revalidatePath('/backlog');
    return { success: true, data };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirColaborador(id: string) {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from('colaboradores')
      .delete()
      .eq('id', id);
    if (error) throw error;
    revalidatePath('/base-frotas');
    revalidatePath('/backlog');
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}
