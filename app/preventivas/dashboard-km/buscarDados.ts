import { createClient } from '@/utils/supabase/client'
import { diaLocalSP, type EquipamentoAtivo, type LeituraBruta } from '@/lib/horimetro-km-calc'

export type DadosDashboard = {
  equipamentos: EquipamentoAtivo[]
  leituras: LeituraBruta[]
  rfAtual: PeriodoSuzano | null
  /** Períodos Suzano (RF) já iniciados, do mais recente pro mais antigo. */
  rfs: PeriodoSuzano[]
}

export type PeriodoSuzano = { ano: number; mes: number; inicio: string; fim: string }

type RowLeitura = {
  id: string; equipamento_id: string; unidade: string; valor_novo: number | string; km_novo: number | string | null
  data_referencia: string | null; atualizado_em: string; atualizado_por_nome: string | null; observacoes: string | null
}

const POR_PAGINA = 1000

/**
 * Frotas ativas + leituras entre `desde` e `fim`, buscadas direto do navegador (RLS de SELECT
 * já libera quem tem o módulo). Sem server action: as server actions do Next rodam uma por vez,
 * então o painel ficava esperando na fila atrás das outras chamadas da página.
 * As três consultas rodam em paralelo; as leituras vêm paginadas (limite de 1000 por resposta).
 */
export async function buscarDadosDashboard(desde: string, fim: string): Promise<DadosDashboard> {
  const supabase = createClient()
  const hoje = diaLocalSP(new Date().toISOString())

  // Margem de 1 dia no atualizado_em por causa do fuso; o corte exato é feito pela data resolvida.
  const ini = new Date(desde + 'T00:00:00Z'); ini.setUTCDate(ini.getUTCDate() - 1)
  const fimMais = new Date(fim + 'T00:00:00Z'); fimMais.setUTCDate(fimMais.getUTCDate() + 2)
  const filtroData = `and(data_referencia.gte.${desde},data_referencia.lte.${fim}),and(data_referencia.is.null,atualizado_em.gte.${ini.toISOString()},atualizado_em.lt.${fimMais.toISOString()})`

  const buscarLeituras = async (): Promise<RowLeitura[]> => {
    const todas: RowLeitura[] = []
    for (let de = 0; ; de += POR_PAGINA) {
      const { data, error } = await supabase
        .from('historico_horimetros')
        .select('id, equipamento_id, unidade, valor_novo, km_novo, data_referencia, atualizado_em, atualizado_por_nome, observacoes')
        .or(filtroData)
        .order('atualizado_em', { ascending: true })
        .order('id', { ascending: true })
        .range(de, de + POR_PAGINA - 1)
      if (error) throw new Error(error.message)
      const pagina = (data || []) as RowLeitura[]
      todas.push(...pagina)
      if (pagina.length < POR_PAGINA || todas.length >= 50000) return todas
    }
  }

  const [eqRes, rfRes, rows] = await Promise.all([
    supabase.from('equipamentos').select('id, placa, tipo, categoria, modulo').ilike('status', 'ativo').is('deleted_at', null).order('placa'),
    supabase.from('calendario_suzano').select('ano, mes, data_inicio, data_fim').lte('data_inicio', hoje).order('data_inicio', { ascending: false }).limit(36),
    buscarLeituras(),
  ])
  if (eqRes.error) throw new Error(eqRes.error.message)

  const equipamentos = (eqRes.data || []) as EquipamentoAtivo[]
  const rfs: PeriodoSuzano[] = ((rfRes.data || []) as { ano: number; mes: number; data_inicio: string; data_fim: string }[])
    .map(r => ({ ano: r.ano, mes: r.mes, inicio: String(r.data_inicio).slice(0, 10), fim: String(r.data_fim).slice(0, 10) }))
  const rfAtual = rfs.find(r => r.inicio <= hoje && r.fim >= hoje) ?? null

  const ativos = new Set(equipamentos.map(e => e.id))
  const leituras: LeituraBruta[] = rows
    .filter(r => r.valor_novo != null && ativos.has(r.equipamento_id))
    .map(r => ({
      id: r.id,
      equipamento_id: r.equipamento_id,
      unidade: r.unidade,
      valor_novo: Number(r.valor_novo),
      km_novo: r.km_novo != null ? Number(r.km_novo) : null,
      data: r.data_referencia ? String(r.data_referencia).slice(0, 10) : diaLocalSP(r.atualizado_em),
      ordem: r.atualizado_em,
      por: r.atualizado_por_nome,
      obs: r.observacoes,
    }))
    .filter(l => l.data >= desde && l.data <= fim)

  return { equipamentos, leituras, rfAtual, rfs }
}
