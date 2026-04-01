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
export async function importarInspecoesPneus(rows: any[]) {
  const supabase = createClient()

  // Buscar mapa placa → id e ultimoHist
  const { data: eqs } = await supabase.from('equipamentos').select('id, placa, ultimoHist')
  const eqMap: Record<string, { id: string; ultimoHist: number | null }> = {}
  for (const e of eqs || []) eqMap[e.placa.toUpperCase()] = { id: e.id, ultimoHist: e.ultimoHist }

  const inserts: any[] = []
  const eqUpdates: Record<string, number> = {} // id -> new km/horimetro
  const erros: string[] = []

  function parsePossibleDate(d?: any) {
    if (!d) return null;
    if (typeof d === 'number' && d > 20000 && d < 100000) {
      const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
      return jsDate.toISOString();
    }
    const str = String(d).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(str)) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      const day = dateParts[0].padStart(2, '0');
      const month = dateParts[1].padStart(2, '0');
      let year = dateParts[2];
      if (year.length === 2) year = '20' + year;
      let timePart = parts[1] || '00:00:00';
      if (timePart.split(':').length === 2) timePart += ':00';
      return `${year}-${month}-${day}T${timePart}`;
    }
    const dt = new Date(str);
    return !isNaN(dt.getTime()) ? dt.toISOString() : null;
  }

  function getVal(row: any, aliases: string[]) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
      const key = Object.keys(row).find(k => k.toLowerCase() === alias.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
    }
    return null;
  }

  const parseFloatSafe = (val: any) => {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const strVal = String(val).trim();
    if (strVal.includes(',')) {
      const parsed = parseFloat(strVal.replace(/\./g, '').replace(',', '.'));
      return isNaN(parsed) ? null : parsed;
    }
    const parsed = parseFloat(strVal);
    return isNaN(parsed) ? null : parsed;
  }

  for (const row of rows) {
    const placaRaw = getVal(row, ['placa', 'Equipamento', 'Veículo', 'Máquina', 'Placa']) || ''
    const placaUpper = String(placaRaw).toUpperCase().trim()
    const eq = eqMap[placaUpper]

    if (!eq) { 
      erros.push(`Placa não encontrada: ${placaRaw}`); 
      continue; 
    }

    const data_inspecao = parsePossibleDate(getVal(row, ['data_inspecao', 'Data', 'Data Inspeção', 'Dia']))
    if (!data_inspecao) { 
      erros.push(`Data inválida para ${placaRaw}`); 
      continue; 
    }

    const km_atual = parseFloatSafe(getVal(row, ['km_atual', 'KM', 'Horímetro', 'KM Atual', 'Hori']))

    // Sincronizar KM/Horímetro
    if (km_atual && (!eq.ultimoHist || km_atual > eq.ultimoHist)) {
      if (!eqUpdates[eq.id] || km_atual > eqUpdates[eq.id]) {
        eqUpdates[eq.id] = km_atual
      }
    }

    // Parsear posições de sulco com aliases
    const posicoes: Record<string, number | null> = {}
    const posAliases: Record<string, string[]> = {
      de: ['de', 'DIANTEIRO ESQUERDO', 'DIANTEIRO ESQ', 'DE'],
      dd: ['dd', 'DIANTEIRO DIREITO', 'DIANTEIRO DIR', 'DD'],
      tei: ['tei', 'TRASEIRO ESQ INTERNO', 'TEI'],
      tee: ['tee', 'TRASEIRO ESQ EXTERNO', 'TEE'],
      tdi: ['tdi', 'TRASEIRO DIR INTERNO', 'TDI'],
      tde: ['tde', 'TRASEIRO DIR EXTERNO', 'TDE'],
      tei1: ['tei1', 'TRASEIRO ESQ INTERNO 2', 'TEI1'],
      tee1: ['tee1', 'TRASEIRO ESQ EXTERNO 2', 'TEE1'],
      tdi1: ['tdi1', 'TRASEIRO DIR INTERNO 2', 'TDI1'],
      tde1: ['tde1', 'TRASEIRO DIR EXTERNO 2', 'TDE1'],
      estepe: ['estepe', 'ESTEPE', 'RESERVA']
    }

    for (const [pos, aliases] of Object.entries(posAliases)) {
      posicoes[pos] = parseFloatSafe(getVal(row, aliases))
    }

    const condicaoFallback = calcCondicao(posicoes)
    const condicao = sanitizeCondicao(getVal(row, ['condicao', 'Condição', 'Status']), condicaoFallback)

    inserts.push({
      equipamento_id: eq.id,
      data_inspecao,
      km_atual,
      observacoes: getVal(row, ['observacoes', 'Observações', 'Notas']),
      condicao,
      ...posicoes,
    })
  }

  if (inserts.length === 0) {
    return { error: erros.join('\n') || 'Nenhuma linha válida para importar.' }
  }

  // Inserir lotes
  const CHUNK = 50
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK)
    const { error } = await supabase.from('inspecoes_pneus').insert(chunk)
    if (error) return { error: `Erro no lote ${Math.floor(i / CHUNK) + 1}: ${error.message}` }
  }

  // Atualizar equipamentos
  for (const [id, value] of Object.entries(eqUpdates)) {
    await supabase.from('equipamentos').update({ ultimoHist: value }).eq('id', id)
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
