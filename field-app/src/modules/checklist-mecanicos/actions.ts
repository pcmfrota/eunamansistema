// Port de app/checklist-mecanicos/actions.ts pro app de campo — sem "use server"/
// revalidatePath, e com @/utils/supabase/server trocado por @/utils/supabase/client
// (mesmo padrão de todos os outros módulos portados). A cascata original (checklist +
// OS automática + itens de backlog) fica inteira dentro de salvarChecklistMecanico pra
// funcionar como um único item da fila offline — ver field-app/src/compat/offline-actions.ts.
import { createClient } from '@/utils/supabase/client';
import { OSService } from '@/src/services/OSService';
import { OSInsert } from '@/src/models/os';
import { registrarExclusao } from '@/lib/audit-log';
import { upsertBacklogItem } from '../backlog/actions';
import { getCurrentLocalDate, getCurrentLocalDatetime } from '@/src/utils/dateUtils';

async function getUsuarioAtual(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { id: null as string | null, nome: null as string | null };
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
  return { id: user.id as string, nome: (profile?.full_name || user.email || 'Usuário') as string };
}

export async function salvarChecklistMecanico(formData: FormData) {
  try {
    const supabase = createClient();
    const usuario = await getUsuarioAtual(supabase);
    if (!usuario.id) return { error: 'Não autenticado' };

    const placa = formData.get('placa') as string;
    const tipo_caminhao = formData.get('tipo_caminhao') as string;
    const local = formData.get('local') as string
    const co = formData.get('co') as string
    const respostas = JSON.parse(formData.get('respostas') as string || '{}')
    const pendencias_adicionais = formData.get('pendencias_adicionais') as string || ''
    const questionsLabels = JSON.parse(formData.get('questionsLabels') as string || '{}')

    // 1. Salvar o Checklist
    const { data: checklist, error: chkError } = await supabase
      .from('checklists_mecanicos')
      .insert([{
        placa,
        tipo_caminhao,
        local,
        co,
        data_checklist: getCurrentLocalDate(),
        status: 'Fechado',
        respostas,
        pendencias_adicionais,
        criado_por: usuario.id
      }])
      .select()
      .single()

    if (chkError) throw new Error(chkError.message)

    // Pegar o equipamento_id da placa (pra vincular OS e Backlog)
    const { data: equipamento } = await supabase
      .from('equipamentos')
      .select('id')
      .ilike('placa', placa)
      .single()

    const equipamento_id = equipamento?.id || null

    // 2. Gerar OS Automática (Aberta)
    if (equipamento_id) {
      const novaOs: OSInsert = {
        equipamento_id,
        placa,
        modulo: local,
        status: 'Aberta',
        data_abertura: getCurrentLocalDatetime(),
        data_fechamento: null,
        horimetro: null,
        operacao_tipo: 'CHECKLIST',
        local,
        classe: 'PREVENTIVA',
        foi_enviado_reserva: false,
        descricao: `OS Aberta via Checklist Mecânico (${tipo_caminhao})`,
        motivo: 'PREVENTIVA',
        sistema: '',
        sub_sistema: '',
        horas_manutencao: null,
        observacoes: 'Gerado automaticamente pelo fechamento de um checklist mecânico detalhado.',
        horario_parada: null,
        qual_reserva: null,
        horas_reserva_chegou: null,
        componente: null,
        assinatura_mecanico: null,
        fotos: [],
        numero_os: '',
        aprovado: true,
        mecanicos: []
      }

      try {
        await OSService.createOS(novaOs)
      } catch (osError) {
        // Mesmo comportamento da Server Action original: falha ao abrir a OS automática
        // não derruba o checklist já salvo, só fica registrada no console.
        console.warn('[Checklist Mecânico] Falha ao gerar OS automática:', osError)
      }
    }

    // 3. Lançar pendências (NC, F e Extras) no Backlog — usa o schema NOVO da tabela
    // (frota/descricao/criticidade/detalhamento, reaproveitando upsertBacklogItem já
    // portado) em vez das colunas legadas (equipamento_id/falha/prioridade) que a Server
    // Action original insere direto — essas colunas legadas não existem mais no
    // BACKLOG_SELECT_LEVE/BacklogDashboard atual, então ficariam invisíveis no site.
    if (equipamento_id) {
      const dataEvidencia = getCurrentLocalDatetime()
      const itensParaLancar: { descricao: string; criticidade: 'A' | 'B' }[] = []

      for (const key in respostas) {
        if (respostas[key] === 'NC' || respostas[key] === 'F') {
          const baseKey = key.includes('pneu_') ? 'pneus' : key.split('_obs')[0]
          const obsKey = `${baseKey}_obs`
          const obs = respostas[obsKey] ? ` (Obs: ${respostas[obsKey]})` : ''

          let label = questionsLabels[key] || key
          if (key.startsWith('pneu_')) {
            label = `Pneu ${key.replace('pneu_', '')} em Fim de Vida`
          }

          itensParaLancar.push({
            descricao: `[Checklist ${tipo_caminhao}] - ${label}${obs}`,
            criticidade: 'A', // Fim de vida ou NC no checklist é prioridade alta
          })
        }
      }

      if (pendencias_adicionais.trim().length > 0) {
        const linhas = pendencias_adicionais.split('\n').filter((l: string) => l.trim().length > 0)
        for (const linha of linhas) {
          itensParaLancar.push({
            descricao: `[Checklist ${tipo_caminhao}] (Pendente/Imagem) - ${linha.trim()}`,
            criticidade: 'B',
          })
        }
      }

      for (const item of itensParaLancar) {
        const res = await upsertBacklogItem({
          data_evidencia: dataEvidencia,
          status: 'PENDENTE',
          criticidade: item.criticidade,
          modulo: local,
          frota: placa,
          tag: tipo_caminhao,
          tipo: 'CHECKLIST',
          descricao: item.descricao,
          origem: 'Checklist Mecânico',
          colaborador: usuario.nome,
          detalhamento: 'AG. REQUISIÇÃO',
        })
        if (res && 'error' in res) {
          console.warn('[Checklist Mecânico] Falha ao lançar item de backlog:', res.error)
        }
      }
    }

    return { success: true, data: checklist }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function excluirChecklistMecanico(id: string) {
  try {
    const supabase = createClient()

    let checklistSnapshot: any = null
    try {
      const { data } = await supabase
        .from('checklists_mecanicos')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      checklistSnapshot = data
    } catch (snapshotError) {
      console.warn(`Falha ao capturar snapshot do checklist ${id} antes da exclusão:`, snapshotError)
    }

    const { error } = await supabase.from('checklists_mecanicos').delete().eq('id', id)
    if (error) throw new Error(error.message)

    await registrarExclusao({
      supabase,
      modulo: 'Checklist Mecânicos',
      tabelaOrigem: 'checklists_mecanicos',
      registroId: id,
      descricao: checklistSnapshot ? `${checklistSnapshot.placa} — ${checklistSnapshot.tipo_caminhao} (${checklistSnapshot.data_checklist})` : null,
      dados: checklistSnapshot,
    })

    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
