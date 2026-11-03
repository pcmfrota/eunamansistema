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
import { OSInsert, OSUpdate } from '@/src/models/os';
import { getCurrentLocalDatetime } from '@/src/utils/dateUtils';

const parseFormData = (formData: FormData): OSInsert => ({
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
  descricao: formData.get('descricao') as string,
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
});

const extractMecanicos = (formData: FormData): string[] => {
  const mecanicos: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const nome = ((formData.get(`mecanico_${i}`) as string) || '').trim();
    if (nome) mecanicos.push(nome);
  }
  return mecanicos;
};

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

// As fotos/assinatura da OS saíram da listagem em massa (ver lib/offline-sync.ts) pra não
// estourar a cota de saída do Supabase — quem abre uma OS específica pra editar ou ver
// detalhes busca essas colunas aqui, sob demanda.
export async function getOSImagensClient(id: string) {
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

    // Só admin e PCM lançam já validado; qualquer outro cargo (mecânico, encarregado,
    // gestão, supervisor, ou lançamento feito pelo app de campo) entra pendente de validação.
    data.aprovado = usuario.role === 'admin' || usuario.role === 'pcm';

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

    // Se editado por quem não é admin/PCM, volta a requerer validação (aprovado = false)
    const precisaValidar = usuario.role !== 'admin' && usuario.role !== 'pcm';
    if (precisaValidar) {
      data.aprovado = false;
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

export async function aprovarOrdemServico(id: string) {
  try {
    const supabase = createClient();
    const usuario = await getUsuarioAtual(supabase);
    if (!usuario.id) return { error: 'Não autenticado' };

    if (usuario.role !== 'admin' && usuario.role !== 'pcm') {
      return { error: 'Apenas administradores ou PCM podem validar ordens de serviço.' };
    }

    const result = await OSService.updateOS(id, {
      aprovado: true,
      aprovado_por: usuario.id,
      aprovado_por_nome: usuario.nome,
      aprovado_em: getCurrentLocalDatetime(),
    } as any);
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
