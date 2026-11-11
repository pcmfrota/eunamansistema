'use server'

import { revalidatePath } from 'next/cache'
import { OSService } from '@/src/services/OSService'
import { OSInsert, OSUpdate } from '@/src/models/os'
import { createClient } from '@/utils/supabase/server'
import { getUserFilial } from '@/utils/filial'
import { getCurrentLocalDatetime } from '@/src/utils/dateUtils'
import { notificarPapeis } from '@/lib/notificacoes'

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

// As fotos/assinatura da OS saíram da listagem em massa (ver lib/offline-sync.ts) pra não
// estourar a cota de saída do Supabase — quem abre uma OS específica pra editar ou ver a
// ficha busca essas colunas aqui, sob demanda.
export async function getOSImagens(id: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('foto_horimetro, foto_km, fotos, assinatura_mecanico')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

const extractMecanicos = (formData: FormData): string[] => {
  const mecanicos: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const nome = (formData.get(`mecanico_${i}`) as string || '').trim();
    if (nome) mecanicos.push(nome);
  }
  return mecanicos;
}

// Aprovação em duas etapas (ver migration 20261112000100_aprovacao_os_duas_etapas.sql):
//   - admin e supervisor_manutencao: dispensam as DUAS etapas na própria OS (autoridade
//     máxima / autoaprovação não faz sentido pedir confirmação de si mesmo).
//   - pcm: dispensa só a própria etapa; ainda precisa do Supervisor de Manutenção.
//   - qualquer outro cargo (mecânico, encarregado etc. — inclusive lançamento via APK):
//     precisa das duas etapas.
function etapasExigidas(role: string): { precisaPcm: boolean; precisaSupervisor: boolean } {
  if (role === 'admin' || role === 'supervisor_manutencao') return { precisaPcm: false, precisaSupervisor: false }
  if (role === 'pcm') return { precisaPcm: false, precisaSupervisor: true }
  return { precisaPcm: true, precisaSupervisor: true }
}

export async function criarOrdemServico(formData: FormData) {
  try {
    const data = parseFormData(formData)
    data.mecanicos = extractMecanicos(formData)

    // Determina o cargo e a filial do usuário autenticado no servidor
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'visitante';
    let userNome = 'Um usuário';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, filial_id, full_name')
        .eq('id', user.id)
        .single();
      if (profile) {
        userRole = profile.role;
        userNome = profile.full_name || user.email || userNome;
        // Injeta a filial_id automaticamente a partir do perfil do usuário
        ;(data as any).filial_id = profile.filial_id || 'MATRIZ';
      }
      // Quem lançou — pra dar visibilidade ao PCM/admin de quem registrou cada OS
      // (fica gravado só na criação; editar não muda quem lançou originalmente).
      ;(data as any).created_by = user.id;
      ;(data as any).created_by_nome = userNome;
    }

    const { precisaPcm, precisaSupervisor } = etapasExigidas(userRole);
    ;(data as any).aprovado_pcm = !precisaPcm;
    ;(data as any).aprovado_supervisor = !precisaSupervisor;
    data.aprovado = !precisaPcm && !precisaSupervisor;
    if (data.aprovado) {
      ;(data as any).aprovado_por = user?.id || null;
      ;(data as any).aprovado_por_nome = userNome;
      ;(data as any).aprovado_em = getCurrentLocalDatetime();
    }

    const result = await OSService.createOS(data)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      if (!result.data.aprovado) {
        const papeis = new Set(['admin']);
        if (precisaPcm) papeis.add('pcm');
        if (precisaSupervisor) papeis.add('supervisor_manutencao');
        await notificarPapeis(Array.from(papeis), {
          tipo: 'os_pendente_validacao',
          titulo: 'Nova OS pendente de validação',
          mensagem: `${userNome} lançou a OS ${result.data.numero_os} na placa ${result.data.placa}.`,
          link: `/os?abrir=${result.data.id}`,
        })
      }
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

    // Editar reabre a validação como se fosse um novo lançamento feito por quem editou —
    // mesma regra de etapasExigidas() usada na criação (ver criarOrdemServico acima).
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    let userRole = 'visitante';
    let userNome = 'Um usuário';
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .single();
      if (profile) {
        userRole = profile.role;
        userNome = profile.full_name || user.email || userNome;
      }
    }

    const { precisaPcm, precisaSupervisor } = etapasExigidas(userRole);
    const precisaValidar = precisaPcm || precisaSupervisor;
    ;(data as any).aprovado_pcm = !precisaPcm;
    ;(data as any).aprovado_supervisor = !precisaSupervisor;
    data.aprovado = !precisaValidar;
    if (data.aprovado) {
      ;(data as any).aprovado_por = user?.id || null;
      ;(data as any).aprovado_por_nome = userNome;
      ;(data as any).aprovado_em = getCurrentLocalDatetime();
    }

    const result = await OSService.updateOS(id, data as OSUpdate)
    revalidatePath('/os')
    revalidatePath('/')
    if (result.success && result.data) {
      if (result.data.status === 'Fechada') {
        await closeLinkedBacklogs(result.data)
      }
      if (precisaValidar) {
        const papeis = new Set(['admin']);
        if (precisaPcm) papeis.add('pcm');
        if (precisaSupervisor) papeis.add('supervisor_manutencao');
        await notificarPapeis(Array.from(papeis), {
          tipo: 'os_pendente_validacao',
          titulo: 'OS editada — pendente de validação',
          mensagem: `${userNome} editou a OS ${result.data.numero_os} na placa ${result.data.placa}.`,
          link: `/os?abrir=${result.data.id}`,
        })
      }
      return result.data
    }
    return result
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function aprovarOrdemServico(id: string, etapa?: 'pcm' | 'supervisor') {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Não autenticado" };

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    if (!profile) return { error: "Perfil não encontrado." };

    const nome = profile.full_name || user.email || 'Usuário';
    const podeAprovarPcm = profile.role === 'admin' || profile.role === 'pcm';
    const podeAprovarSupervisor = profile.role === 'admin' || profile.role === 'supervisor_manutencao';

    if (!podeAprovarPcm && !podeAprovarSupervisor) {
      return { error: "Você não tem permissão para validar ordens de serviço." };
    }

    const { data: osAtual, error: fetchError } = await supabase
      .from('ordens_servico')
      .select('aprovado_pcm, aprovado_supervisor')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !osAtual) return { error: "OS não encontrada." };

    // Sem `etapa` explícita (ex: clique de admin), aprova de uma vez toda etapa pendente
    // que o cargo do usuário autoriza.
    const etapasParaAprovar: Array<'pcm' | 'supervisor'> = etapa
      ? [etapa]
      : [
          ...(podeAprovarPcm && osAtual.aprovado_pcm === false ? (['pcm'] as const) : []),
          ...(podeAprovarSupervisor && osAtual.aprovado_supervisor === false ? (['supervisor'] as const) : []),
        ];

    if (etapasParaAprovar.length === 0) {
      return { error: "Não há etapa pendente que você possa validar nesta OS." };
    }

    const agora = getCurrentLocalDatetime();
    const update: any = {};
    for (const et of etapasParaAprovar) {
      if (et === 'pcm') {
        if (!podeAprovarPcm) return { error: "Apenas PCM ou administradores podem validar a etapa do PCM." };
        update.aprovado_pcm = true;
        update.aprovado_pcm_por = user.id;
        update.aprovado_pcm_por_nome = nome;
        update.aprovado_pcm_em = agora;
      } else {
        if (!podeAprovarSupervisor) return { error: "Apenas o Supervisor de Manutenção ou administradores podem validar esta etapa." };
        update.aprovado_supervisor = true;
        update.aprovado_supervisor_por = user.id;
        update.aprovado_supervisor_por_nome = nome;
        update.aprovado_supervisor_em = agora;
      }
    }

    const pcmFinal = update.aprovado_pcm ?? osAtual.aprovado_pcm;
    const supervisorFinal = update.aprovado_supervisor ?? osAtual.aprovado_supervisor;
    if (pcmFinal && supervisorFinal) {
      update.aprovado = true;
      update.aprovado_por = user.id;
      update.aprovado_por_nome = nome;
      update.aprovado_em = agora;
    }

    const result = await OSService.updateOS(id, update as any)
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

