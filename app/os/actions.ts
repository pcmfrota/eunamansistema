'use server'

import { revalidatePath } from 'next/cache'
import { OSService } from '@/src/services/OSService'
import { OSInsert, OSUpdate } from '@/src/models/os'
import { createClient } from '@/utils/supabase/server'
import { getUserFilial } from '@/utils/filial'
import { getCurrentLocalDatetime } from '@/src/utils/dateUtils'

const parseFormData = (formData: FormData): OSInsert => ({
  equipamento_id: formData.get('equipamento_id') as string,
  placa: formData.get('placa') as string,
  modulo: formData.get('modulo') as string,
  status: formData.get('status') as string || 'Aberta',
  data_abertura: formData.get('data_abertura') as string,
  data_fechamento: formData.get('data_fechamento') as string || null,
  horimetro: formData.get('horimetro') ? parseFloat(formData.get('horimetro') as string) : null,
  km: formData.get('km') ? parseFloat(formData.get('km') as string) : null,
  foto_horimetro: (formData.get('foto_horimetro') as string) || null,
  foto_km: (formData.get('foto_km') as string) || null,
  operacao_tipo: formData.get('operacao_tipo') as string,
  local: formData.get('local') as string,
  classe: formData.get('classe') as string || 'CORRETIVA',
  foi_enviado_reserva: formData.get('foi_enviado_reserva') === 'on',
  descricao: formData.get('descricao') as string,
  motivo: formData.get('motivo') as string,
  sistema: formData.get('sistema') as string,
  sub_sistema: formData.get('sub_sistema') as string,
  horas_manutencao: formData.get('horas_manutencao') ? parseFloat(formData.get('horas_manutencao') as string) : null,
  observacoes: formData.get('observacoes') as string,
  // Campos críticos para cálculo PCM DM/DO
  horario_parada: (formData.get('horario_parada') as string) || null,
  qual_reserva: (formData.get('qual_reserva') as string) || null,
  horas_reserva_chegou: (formData.get('horas_reserva_chegou') as string) || null,
  componente: (formData.get('componente') as string) || null,
  assinatura_mecanico: (formData.get('assinatura_mecanico') as string) || null,
  fotos: formData.getAll('fotos') as string[],
  numero_os: '' // Generator will handle this if empty
})

const extractMecanicos = (formData: FormData): string[] => {
  const mecanicos: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const nome = (formData.get(`mecanico_${i}`) as string || '').trim();
    if (nome) mecanicos.push(nome);
  }
  return mecanicos;
}


export async function criarOrdemServico(formData: FormData) {
  try {
    const data = parseFormData(formData)
    data.mecanicos = extractMecanicos(formData)
    
    // Determina o cargo e a filial do usuário autenticado no servidor
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'visitante';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, filial_id')
        .eq('id', user.id)
        .single();
      if (profile) {
        userRole = profile.role;
        // Injeta a filial_id automaticamente a partir do perfil do usuário
        ;(data as any).filial_id = profile.filial_id || 'MATRIZ';
      }
    }
    
    // Se criado por mecânico, inicia como pendente de aprovação (aprovado = false)
    data.aprovado = userRole !== 'mecanico';

    const result = await OSService.createOS(data)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      return result.data
    }
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

// Quando uma OS gerada a partir do Backlog (ver `gerarOSDeBacklog`) é fechada,
// os itens de backlog vinculados a ela (campo `backlog.os = numero_os`) devem
// encerrar junto — espelha o encerramento que já ocorre quando o vínculo é
// feito pelo caminho OS→Backlog (`encerrarBacklogs`, em app/backlog/actions.ts).
async function closeLinkedBacklogs(osRow: any) {
  if (!osRow?.numero_os) return;
  try {
    const supabase = createClient();
    const { data: linked } = await supabase
      .from('backlog')
      .select('id')
      .eq('os', osRow.numero_os)
      .neq('status', 'ENCERRADO');
    if (linked && linked.length > 0) {
      const { encerrarBacklogs } = await import('@/app/backlog/actions');
      await encerrarBacklogs(linked.map((l: any) => l.id), osRow.numero_os, osRow.data_fechamento || getCurrentLocalDatetime());
    }
  } catch (error) {
    console.error('[closeLinkedBacklogs] Falha ao encerrar backlogs vinculados:', error);
  }
}

export async function atualizarStatusOS(id: string, novoStatus: string) {
  try {
    const result = await OSService.updateOS(id, { status: novoStatus } as OSUpdate)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      if (result.data.status === 'Fechada') {
        await closeLinkedBacklogs(result.data)
      }
      return result.data
    }
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function atualizarOrdemServico(id: string, formData: FormData) {
  try {
    const data = parseFormData(formData)
    data.mecanicos = extractMecanicos(formData)
    
    // Se editado por mecânico, volta a requerer aprovação (aprovado = false)
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'visitante';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (profile) userRole = profile.role;
    }
    
    if (userRole === 'mecanico') {
      data.aprovado = false;
    }

    const result = await OSService.updateOS(id, data as OSUpdate)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      if (result.data.status === 'Fechada') {
        await closeLinkedBacklogs(result.data)
      }
      return result.data
    }
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function aprovarOrdemServico(id: string) {
  try {
    const supabase = createClient();
    
    // Verifica se quem está tentando atualizar é admin/pcm/gestao
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };
    
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (!profile || profile.role === 'mecanico' || profile.role === 'visitante') {
      return { error: "Apenas administradores, PCM ou gestores podem aprovar ordens de serviço." };
    }
    
    const result = await OSService.updateOS(id, { aprovado: true } as any)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      return result.data
    }
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function excluirOrdemServico(id: string) {
  try {
    const result = await OSService.deleteOS(id)
    revalidatePath('/os')
    revalidatePath('/')
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function excluirOrdensMassivo(ids: string[]) {
  try {
    const result = await OSService.deleteBulk(ids)
    revalidatePath('/os')
    revalidatePath('/')
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function importarOrdensServico(rows: any[]) {
  try {
    const result = await OSService.importOS(rows)
    revalidatePath('/os')
    revalidatePath('/')
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

