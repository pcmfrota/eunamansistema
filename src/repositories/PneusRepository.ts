import { createClient } from '@/utils/supabase/server'
import { InspecaoPneuInsert, InspecaoPneuUpdate } from '../models/pneus'
import { registrarExclusao, registrarExclusoesEmLote } from '@/lib/audit-log'

export class PneusRepository {
  static async list() {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').select('*, equipamentos(placa)')
      .order('data_inspecao', { ascending: false })
      .order('created_at', { ascending: false })
  }

  static async create(data: InspecaoPneuInsert) {
    const supabase = createClient()
    // .select().single() pra devolver o registro salvo (com id gerado e nome de quem
    // registrou) — usado pra gerar a ficha em PDF logo após o registro, sem precisar
    // de uma segunda consulta.
    return await supabase.from('inspecoes_pneus').insert(data).select('*, equipamentos(placa, tipo)').single()
  }

  static async createMany(data: InspecaoPneuInsert[]) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').insert(data)
  }

  static async update(id: string, data: InspecaoPneuUpdate) {
    const supabase = createClient()
    return await supabase.from('inspecoes_pneus').update(data).eq('id', id).select('*, equipamentos(placa, tipo)').single()
  }

  static async delete(id: string) {
    const supabase = createClient()

    let row: any = null
    try {
      const { data } = await supabase.from('inspecoes_pneus').select('*').eq('id', id).maybeSingle()
      row = data
    } catch (err) {
      console.warn('[PneusRepository.delete] Falha ao obter snapshot antes da exclusão:', err)
    }

    const result = await supabase.from('inspecoes_pneus').delete().eq('id', id)

    if (!result.error) {
      let placa: string | null = null
      if (row?.equipamento_id) {
        try {
          const { data: equipamento } = await supabase
            .from('equipamentos')
            .select('placa')
            .eq('id', row.equipamento_id)
            .maybeSingle()
          placa = equipamento?.placa || null
        } catch (err) {
          console.warn('[PneusRepository.delete] Falha ao resolver placa do equipamento:', err)
        }
      }

      await registrarExclusao({
        supabase,
        modulo: 'Boletim de Pneus',
        tabelaOrigem: 'inspecoes_pneus',
        registroId: id,
        descricao: `Inspeção de Pneus — Placa ${placa || row?.equipamento_id} (${row?.data_inspecao})`,
        dados: row,
      })
    }

    return result
  }

  static async deleteMany(ids: string[]) {
    const supabase = createClient()

    let rows: any[] = []
    try {
      const { data } = await supabase.from('inspecoes_pneus').select('*').in('id', ids)
      rows = data || []
    } catch (err) {
      console.warn('[PneusRepository.deleteMany] Falha ao obter snapshot antes da exclusão:', err)
    }

    const result = await supabase.from('inspecoes_pneus').delete().in('id', ids)

    if (!result.error) {
      const placasPorEquipamento = new Map<string, string | null>()
      const equipamentoIds = Array.from(
        new Set(rows.map(r => r.equipamento_id).filter((id: any) => !!id))
      )
      if (equipamentoIds.length > 0) {
        try {
          const { data: equipamentos } = await supabase
            .from('equipamentos')
            .select('id, placa')
            .in('id', equipamentoIds)
          for (const equipamento of equipamentos || []) {
            placasPorEquipamento.set(equipamento.id, equipamento.placa)
          }
        } catch (err) {
          console.warn('[PneusRepository.deleteMany] Falha ao resolver placas dos equipamentos:', err)
        }
      }

      await registrarExclusoesEmLote(
        supabase,
        'Boletim de Pneus',
        'inspecoes_pneus',
        rows.map(r => {
          const placa = placasPorEquipamento.get(r.equipamento_id) || null
          return {
            registroId: r.id,
            descricao: `Inspeção de Pneus — Placa ${placa || r.equipamento_id} (${r.data_inspecao})`,
            dados: r,
          }
        })
      )
    }

    return result
  }
}
