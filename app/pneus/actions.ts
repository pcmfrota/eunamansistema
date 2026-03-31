'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── Legacy: inspeção por eixo simples ───────────────────────────────────────
export async function registrarInspecaoPneu(formData: FormData) {
  const supabase = createClient()

  const equipamento_id = formData.get('equipamento_id') as string
  const eixo = formData.get('eixo') as string
  const sulco_mm = parseFloat(formData.get('sulco_mm') as string)

  if (!equipamento_id || !eixo || isNaN(sulco_mm)) {
    return { error: 'Preencha todos os campos corretamente.' }
  }

  let status = 'Bom';
  if (sulco_mm < 3) status = 'Trocar';
  else if (sulco_mm < 5) status = 'Crítico';
  else if (sulco_mm < 9) status = 'Regular';

  const { error } = await supabase.from('pneus').insert({
    equipamento_id, eixo, sulco_mm, status
  })

  if (error) return { error: error.message }
  revalidatePath('/pneus')
  revalidatePath('/')
  return { success: true }
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const POSICOES = ['de','dd','tei','tee','tdi','tde','tei1','tee1','tdi1','tde1','estepe'] as const

// Valores permitidos pelo check constraint do banco
const CONDICOES_VALIDAS = ['BOM', 'REGULAR', 'CRITICO', 'TROCAR'] as const
type Condicao = typeof CONDICOES_VALIDAS[number]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula condição pelo menor sulco registrado */
function calcCondicao(posicoes: Record<string, number | null>): Condicao {
  const vals = Object.values(posicoes).filter(v => v != null) as number[]
  if (!vals.length) return 'BOM'
  const min = Math.min(...vals)
  if (min < 3) return 'TROCAR'
  if (min < 5) return 'CRITICO'
  if (min < 9) return 'REGULAR'
  return 'BOM'
}

/**
 * Normaliza qualquer variação de condição para os 4 valores aceitos pelo banco.
 * Remove acentos, maiúsculas, e mapeia sinônimos.
 * Exemplos: "Crítico" → "CRITICO", "CRITICAL" → "CRITICO", "ok" → "BOM"
 */
function sanitizeCondicao(raw: string | null | undefined, fallback: Condicao): Condicao {
  if (!raw || !raw.trim()) return fallback

  // Remove acentos (NFD + strip combining chars) e normaliza
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()

  const map: Record<string, Condicao> = {
    // BOM
    BOM: 'BOM', BOA: 'BOM', GOOD: 'BOM', OK: 'BOM', OTIMO: 'BOM', EXCELENTE: 'BOM', NOVO: 'BOM',
    // REGULAR
    REGULAR: 'REGULAR', REG: 'REGULAR', ATENCAO: 'REGULAR', WATCH: 'REGULAR', MODERADO: 'REGULAR',
    // CRITICO
    CRITICO: 'CRITICO', CRITICA: 'CRITICO', CRITICAL: 'CRITICO', URGENTE: 'CRITICO', ALERTA: 'CRITICO',
    // TROCAR
    TROCAR: 'TROCAR', REPLACE: 'TROCAR', SUBSTITUIR: 'TROCAR', RUIM: 'TROCAR', MAU: 'TROCAR',
    DESGASTADO: 'TROCAR', SUCATA: 'TROCAR',
  }

  return map[clean] ?? fallback
}

// ─── Importação em massa ──────────────────────────────────────────────────────
export async function importarInspecoesPneus(
  rows: Array<{
    placa: string;
    data_inspecao: string;
    km_atual?: number | null;
    de?: number | null; dd?: number | null;
    tei?: number | null; tee?: number | null; tdi?: number | null; tde?: number | null;
    tei1?: number | null; tee1?: number | null; tdi1?: number | null; tde1?: number | null;
    estepe?: number | null;
    condicao?: string;
    observacoes?: string;
  }>
) {
  const supabase = createClient()

  // Buscar mapa placa → id
  const { data: eqs } = await supabase.from('equipamentos').select('id, placa')
  const placaMap: Record<string, string> = {}
  for (const eq of eqs || []) placaMap[eq.placa.toUpperCase()] = eq.id

  const inserts: any[] = []
  const erros: string[] = []

  for (const row of rows) {
    const eqId = placaMap[row.placa?.toUpperCase()]
    if (!eqId) { erros.push(`Placa não encontrada: ${row.placa}`); continue }
    if (!row.data_inspecao) { erros.push(`Data inválida para ${row.placa}`); continue }

    // Parsear posições de sulco
    const posicoes: Record<string, number | null> = {}
    for (const pos of POSICOES) {
      const v = (row as any)[pos]
      posicoes[pos] = v != null && v !== '' ? parseFloat(String(v)) : null
    }

    // Sanitizar condição — garante que só entra valor permitido pelo banco
    const condicaoFallback = calcCondicao(posicoes)
    const condicao = sanitizeCondicao(row.condicao, condicaoFallback)

    inserts.push({
      equipamento_id: eqId,
      data_inspecao: row.data_inspecao,
      km_atual: row.km_atual ?? null,
      observacoes: row.observacoes ?? null,
      condicao,
      ...posicoes,
    })
  }

  if (inserts.length === 0) {
    return { error: erros.join('\n') || 'Nenhuma linha válida para importar.' }
  }

  // Inserir em lotes de 50 para evitar timeout com muitas linhas
  const CHUNK = 50
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK)
    const { error } = await supabase.from('inspecoes_pneus').insert(chunk)
    if (error) return { error: `Erro no lote ${Math.floor(i / CHUNK) + 1}: ${error.message}` }
  }

  revalidatePath('/pneus')
  return { success: true, importados: inserts.length, erros }
}

// ─── Inspeção completa (formulário manual) ────────────────────────────────────
export async function registrarInspecaoCompleta(formData: FormData) {
  const supabase = createClient()

  const equipamento_id = formData.get('equipamento_id') as string
  const data_inspecao = formData.get('data_inspecao') as string
  const km_atual = formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || !data_inspecao) {
    return { error: 'Placa e data são obrigatórios.' }
  }

  const posicoes: Record<string, number | null> = {}
  for (const pos of POSICOES) {
    const v = formData.get(pos)
    posicoes[pos] = v && v !== '' ? parseFloat(v as string) : null
  }

  // Sanitizar condição do formulário também
  const rawCondicao = formData.get('condicao') as string
  const condicao = sanitizeCondicao(rawCondicao, calcCondicao(posicoes))

  const { error } = await supabase.from('inspecoes_pneus').insert({
    equipamento_id,
    data_inspecao,
    km_atual,
    observacoes,
    condicao,
    ...posicoes,
  })

  if (error) return { error: error.message }
  revalidatePath('/pneus')
  return { success: true }
}

// ─── Atualizar inspeção ───────────────────────────────────────────────────────
export async function atualizarInspecao(id: string, formData: FormData) {
  const supabase = createClient()

  const equipamento_id = formData.get('equipamento_id') as string
  const data_inspecao = formData.get('data_inspecao') as string
  const km_atual = formData.get('km_atual') ? parseFloat(formData.get('km_atual') as string) : null
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || !data_inspecao) {
    return { error: 'Placa e data são obrigatórios.' }
  }

  const posicoes: Record<string, number | null> = {}
  for (const pos of POSICOES) {
    const v = formData.get(pos)
    posicoes[pos] = v && v !== '' ? parseFloat(v as string) : null
  }

  const rawCondicao = formData.get('condicao') as string
  const condicao = sanitizeCondicao(rawCondicao, calcCondicao(posicoes))

  const { error } = await supabase.from('inspecoes_pneus').update({
    equipamento_id,
    data_inspecao,
    km_atual,
    observacoes,
    condicao,
    ...posicoes,
  }).eq('id', id)

  if (error) return { error: error.message }
  revalidatePath('/pneus')
  return { success: true }
}

// ─── Excluir única inspeção ───────────────────────────────────────────────────
export async function excluirInspecao(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('inspecoes_pneus').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/pneus')
  return { success: true }
}

// ─── Excluir múltiplas inspeções ──────────────────────────────────────────────
export async function excluirInspecoesMassivo(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('inspecoes_pneus').delete().in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/pneus')
  return { success: true }
}
