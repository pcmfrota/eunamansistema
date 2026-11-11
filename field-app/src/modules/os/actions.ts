// Port de app/os/actions.ts pro app de campo — sem "use server"/revalidatePath, e com
// @/utils/supabase/server trocado por client (mesmo padrão de sempre).
//
// FORA DO ESCOPO desta fase (não portadas, propositalmente):
// - notificarPapeis: usa SUPABASE_SERVICE_ROLE_KEY (chave de servidor) — as 2 chamadas do
//   original (OS pendente de validação ao criar/editar) não existem aqui. A notificação
//   continua só pelo site ao vivo; no app de campo a OS só fica marcada aprovado=false,
//   visível na aba "Validação" de quem pode aprovar.
// - importarOrdensServico / excluirOrdensMassivo: importação de planilha e seleção em massa
//   são fluxos de Escritório (Web) — ver OSService.ts.
import { createClient } from '@/utils/supabase/client';
import { OSService } from '@/src/services/OSService';
import { OSInsert, OSUpdate, DescricaoAtividade } from '@/src/models/os';
import { getCurrentLocalDatetime } from '@/src/utils/dateUtils';

// Resumo concatenado dos blocos de descricoes_atividade — mantém a coluna legada `descricao`
// (texto livre) coerente com o que o site/listagens ainda leem, mesmo vindo do novo formulário
// com múltiplas descrições.
const resumoDescricoes = (blocos: DescricaoAtividade[]): string =>
  blocos
    .map((b, i) => (b.descricao || '').trim())
    .filter(Boolean)
    .map((texto, i) => `${i + 1}) ${texto}`)
    .join('\n\n');

const parseFormData = (formData: FormData): OSInsert => {
  let descricoesAtividade: DescricaoAtividade[] = [];
  try {
    descricoesAtividade = JSON.parse((formData.get('descricoes_atividade') as string) || '[]');
    if (!Array.isArray(descricoesAtividade)) descricoesAtividade = [];
  } catch {
    descricoesAtividade = [];
  }
  const descricaoLegado = (formData.get('descricao') as string) || resumoDescricoes(descricoesAtividade);

  return ({
  equipamento_id: formData.get('equipamento_id') as string,
  placa: formData.get('placa') as string,
  modulo: formData.get('modulo') as string,
  status: (formData.get('status') as string) || 'Aberta',
  data_abertura: formData.get('data_abertura') as string,
  data_fechamento: (formData.get('data_fechamento') as string) || null,
  horimetro: formData.get('horimetro') ? parseFloat(formData.get('horimetro') as string) : null,
  km: formData.get('km') ? parseFloat(formData.get('km') as string) : null,
  foto_horimetro: (formData.get('foto_horimetro') as string) || null,
  foto_km: (formData.get('foto_km') as string) || null,
  operacao_tipo: formData.get('operacao_tipo') as string,
  local: formData.get('local') as string,
  // Classificação (Tipo de Manutenção/Reserva/Sistema-Sub-Sistema-Componente) é só
  // Escritório (Web) — o próprio NovoModal.tsx original já esconde esses campos quando
  // rodando dentro do app Android (`isAndroidApp`), então aqui nem existem no formulário.
  classe: 'CORRETIVA',
  foi_enviado_reserva: false,
  descricao: descricaoLegado,
  descricoes_atividade: descricoesAtividade,
  motivo: (formData.get('motivo') as string) || null,
  sistema: null,
  sub_sistema: null,
  horas_manutencao: formData.get('horas_manutencao') ? parseFloat(formData.get('horas_manutencao') as string) : null,
  observacoes: formData.get('observacoes') as string,
  horario_parada: (formData.get('horario_parada') as string) || null,
  qual_reserva: null,
  horas_reserva_chegou: null,
  componente: null,
  assinatura_mecanico: (formData.get('assinatura_mecanico') as string) || null,
  fotos: formData.getAll('fotos') as string[],
  numero_os: '', // Gerado automaticamente se vazio
  } as OSInsert);
};

const extractMecanicos = (formData: FormData): string[] => {
  const mecanicos: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const nome = ((formData.get(`mecanico_${i}`) as string) || '').trim();
    if (nome) mecanicos.push(nome);
  }
  return mecanicos;
};

// Aprovação em duas etapas (ver migration 20261112000100_aprovacao_os_duas_etapas.sql e
// app/os/actions.ts, mesma regra no app principal):
//   - admin e supervisor_manutencao: dispensam as DUAS etapas na própria OS.
//   - pcm: dispensa só a própria etapa; ainda precisa do Supervisor de Manutenção.
//   - qualquer outro cargo (mecânico, encarregado etc. — inclusive lançamento via APK):
//     precisa das duas etapas.
function etapasExigidas(role: string): { precisaPcm: boolean; precisaSupervisor: boolean } {
  if (role === 'admin' || role === 'supervisor_manutencao') return { precisaPcm: false, precisaSupervisor: false };
  if (role === 'pcm') return { precisaPcm: false, precisaSupervisor: true };
  return { precisaPcm: true, precisaSupervisor: true };
}

async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null as string | null, nome: null as string | null, role: 'visitante' };
  const { data: profile } = await supabase.from('profiles').select('role, full_name, filial_id').eq('id', user.id).maybeSingle();
  return {
    id: user.id as string,
    nome: (profile?.full_name || user.email || 'Usuário') as string,
    role: (profile?.role || 'visitante') as string,
    filial_id: profile?.filial_id || 'MATRIZ',
  };
}

// As fotos/assinatura/descricoes_atividade (que também carrega fotos por bloco) da OS
// saíram da listagem em massa (ver lib/offline-sync.ts) pra não estourar a cota de saída
// do Supabase — quem abre uma OS específica pra editar ou ver detalhes busca essas
// colunas aqui, sob demanda.
export async function getOSImagensClient(id: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ordens_servico')
      .select('foto_horimetro, foto_km, fotos, assinatura_mecanico, descricoes_atividade, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { data };
  } catch (error: any) {
    return { error: error.message };
  }
}

// Quando uma OS gerada a partir do Backlog (ver `gerarOSDeBacklog`, em ../backlog/actions)
// é fechada, os itens de backlog vinculados a ela (campo `backlog.os = numero_os`) devem
// encerrar junto — espelha o encerramento que já ocorre quando o vínculo é feito pelo
// caminho OS→Backlog no app principal (`closeLinkedBacklogs`, em app/os/actions.ts).
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
      const { encerrarBacklogs } = await import('../backlog/actions');
      await encerrarBacklogs(linked.map((l: any) => l.id), osRow.numero_os, osRow.data_fechamento || getCurrentLocalDatetime());
    }
  } catch (error) {
    console.error('[closeLinkedBacklogs] Falha ao encerrar backlogs vinculados:', error);
  }
}

export async function criarOrdemServico(formData: FormData) {
  try {
    const data = parseFormData(formData);
    data.mecanicos = extractMecanicos(formData);

    const supabase = createClient();
    const usuario = await getUsuarioAtual(supabase);
    if (usuario.id) {
      (data as any).filial_id = (usuario as any).filial_id;
      (data as any).created_by = usuario.id;
      (data as any).created_by_nome = usuario.nome;
    }

    const { precisaPcm, precisaSupervisor } = etapasExigidas(usuario.role);
    (data as any).aprovado_pcm = !precisaPcm;
    (data as any).aprovado_supervisor = !precisaSupervisor;
    data.aprovado = !precisaPcm && !precisaSupervisor;
    if (data.aprovado && usuario.id) {
      (data as any).aprovado_por = usuario.id;
      (data as any).aprovado_por_nome = usuario.nome;
      (data as any).aprovado_em = getCurrentLocalDatetime();
    }

    const result = await OSService.createOS(data);
    if (result.success && result.data) return result.data;
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarStatusOS(id: string, novoStatus: string) {
  try {
    const result = await OSService.updateOS(id, { status: novoStatus } as OSUpdate);
    if (result.success && result.data) {
      if (result.data.status === 'Fechada') {
        await closeLinkedBacklogs(result.data);
      }
      return result.data;
    }
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function atualizarOrdemServico(id: string, formData: FormData) {
  try {
    const data = parseFormData(formData);
    data.mecanicos = extractMecanicos(formData);

    const supabase = createClient();
    const usuario = await getUsuarioAtual(supabase);

    // Editar reabre a validação como se fosse um novo lançamento feito por quem editou —
    // mesma regra de etapasExigidas() usada na criação.
    const { precisaPcm, precisaSupervisor } = etapasExigidas(usuario.role);
    (data as any).aprovado_pcm = !precisaPcm;
    (data as any).aprovado_supervisor = !precisaSupervisor;
    data.aprovado = !precisaPcm && !precisaSupervisor;
    if (data.aprovado && usuario.id) {
      (data as any).aprovado_por = usuario.id;
      (data as any).aprovado_por_nome = usuario.nome;
      (data as any).aprovado_em = getCurrentLocalDatetime();
    }

    const result = await OSService.updateOS(id, data as OSUpdate);
    if (result.success && result.data) {
      if (result.data.status === 'Fechada') {
        await closeLinkedBacklogs(result.data);
      }
      return result.data;
    }
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function aprovarOrdemServico(id: string, etapa?: 'pcm' | 'supervisor') {
  try {
    const supabase = createClient();
    const usuario = await getUsuarioAtual(supabase);
    if (!usuario.id) return { error: 'Não autenticado' };

    const podeAprovarPcm = usuario.role === 'admin' || usuario.role === 'pcm';
    const podeAprovarSupervisor = usuario.role === 'admin' || usuario.role === 'supervisor_manutencao';
    if (!podeAprovarPcm && !podeAprovarSupervisor) {
      return { error: 'Você não tem permissão para validar ordens de serviço.' };
    }

    const { data: osAtual, error: fetchError } = await supabase
      .from('ordens_servico')
      .select('aprovado_pcm, aprovado_supervisor')
      .eq('id', id)
      .maybeSingle();
    if (fetchError || !osAtual) return { error: 'OS não encontrada.' };

    const etapasParaAprovar: Array<'pcm' | 'supervisor'> = etapa
      ? [etapa]
      : [
          ...(podeAprovarPcm && osAtual.aprovado_pcm === false ? (['pcm'] as const) : []),
          ...(podeAprovarSupervisor && osAtual.aprovado_supervisor === false ? (['supervisor'] as const) : []),
        ];

    if (etapasParaAprovar.length === 0) {
      return { error: 'Não há etapa pendente que você possa validar nesta OS.' };
    }

    const agora = getCurrentLocalDatetime();
    const update: any = {};
    for (const et of etapasParaAprovar) {
      if (et === 'pcm') {
        if (!podeAprovarPcm) return { error: 'Apenas PCM ou administradores podem validar a etapa do PCM.' };
        update.aprovado_pcm = true;
        update.aprovado_pcm_por = usuario.id;
        update.aprovado_pcm_por_nome = usuario.nome;
        update.aprovado_pcm_em = agora;
      } else {
        if (!podeAprovarSupervisor) return { error: 'Apenas o Supervisor de Manutenção ou administradores podem validar esta etapa.' };
        update.aprovado_supervisor = true;
        update.aprovado_supervisor_por = usuario.id;
        update.aprovado_supervisor_por_nome = usuario.nome;
        update.aprovado_supervisor_em = agora;
      }
    }

    const pcmFinal = update.aprovado_pcm ?? osAtual.aprovado_pcm;
    const supervisorFinal = update.aprovado_supervisor ?? osAtual.aprovado_supervisor;
    if (pcmFinal && supervisorFinal) {
      update.aprovado = true;
      update.aprovado_por = usuario.id;
      update.aprovado_por_nome = usuario.nome;
      update.aprovado_em = agora;
    }

    const result = await OSService.updateOS(id, update as any);
    if (result.success && result.data) return result.data;
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function excluirOrdemServico(id: string) {
  try {
    const result = await OSService.deleteOS(id);
    return result;
  } catch (error: any) {
    return { error: error.message };
  }
}
