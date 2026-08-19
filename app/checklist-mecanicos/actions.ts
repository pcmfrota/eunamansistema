'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { OSService } from '@/src/services/OSService'
import { OSInsert } from '@/src/models/os'
import { registrarExclusao } from '@/lib/audit-log'

export async function salvarChecklist(formData: FormData) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Não autenticado" }

    const placa = formData.get("placa") as string
    const tipo_caminhao = formData.get("tipo_caminhao") as string
    const local = formData.get("local") as string
    const co = formData.get("co") as string
    const respostas = JSON.parse(formData.get("respostas") as string || "{}")
    const pendencias_adicionais = formData.get("pendencias_adicionais") as string || ""
    const questionsLabels = JSON.parse(formData.get("questionsLabels") as string || "{}")

    // 1. Salvar o Checklist
    const { data: checklist, error: chkError } = await supabase
      .from('checklists_mecanicos')
      .insert([{
        placa,
        tipo_caminhao,
        local,
        co,
        data_checklist: new Date().toISOString().split('T')[0],
        status: 'Fechado',
        respostas,
        pendencias_adicionais,
        criado_por: user.id
      }])
      .select()
      .single()

    if (chkError) throw new Error(chkError.message)

    // Pegar o equipamento_id da placa (para vincular OS e Backlog)
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
        data_abertura: new Date().toISOString(),
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

      await OSService.createOS(novaOs)
    }

    // 3. Lançar pendências (NC, F e Extras) no Backlog
    if (equipamento_id) {
      const backlogItems = []

      // Lançar itens NC ou F (Pneus Fim de Vida)
      for (const key in respostas) {
        if (respostas[key] === 'NC' || respostas[key] === 'F') {
          // Extrair obs se houver
          const baseKey = key.includes('pneu_') ? 'pneus' : (key.split('_obs')[0])
          const obsKey = `${baseKey}_obs`
          const obs = respostas[obsKey] ? ` (Obs: ${respostas[obsKey]})` : ''
          
          let label = questionsLabels[key] || key
          if (key.startsWith('pneu_')) {
            label = `Pneu ${key.replace('pneu_', '')} em Fim de Vida`
          }

          backlogItems.push({
            equipamento_id,
            falha: `[Checklist ${tipo_caminhao}] - ${label}${obs}`,
            prioridade: 'Alta', // Fim de vida ou NC no checklist é prioridade alta
            relatado_por: user.id
          })
        }
      }

      // Lançar pendências extras (cada linha uma pendência)
      if (pendencias_adicionais.trim().length > 0) {
        const linhas = pendencias_adicionais.split('\n').filter(l => l.trim().length > 0)
        for (const linha of linhas) {
          backlogItems.push({
            equipamento_id,
            falha: `[Checklist ${tipo_caminhao}] (Pendente/Imagem) - ${linha.trim()}`,
            prioridade: 'Média',
            relatado_por: user.id
          })
        }
      }

      if (backlogItems.length > 0) {
        await supabase.from('backlog').insert(backlogItems)
      }
    }

    revalidatePath('/checklist-mecanicos')
    revalidatePath('/os')
    revalidatePath('/backlog')

    return { success: true, data: checklist }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function excluirChecklist(id: string) {
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

    revalidatePath('/checklist-mecanicos')
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
