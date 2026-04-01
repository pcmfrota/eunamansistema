'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function criarOrdemServico(formData: FormData) {
  const supabase = createClient()
  
  const equipamento_id = formData.get('equipamento_id') as string
  const placa = formData.get('placa') as string
  const modulo = formData.get('modulo') as string
  const status = formData.get('status') as string || 'Aberta'
  const data_abertura = formData.get('data_abertura') as string
  const data_fechamento = formData.get('data_fechamento') as string || null
  const horimetro = formData.get('horimetro') ? parseFloat(formData.get('horimetro') as string) : null
  const operacao_tipo = formData.get('operacao_tipo') as string
  const local = formData.get('local') as string
  const classe = formData.get('classe') as string || 'CORRETIVA'
  const foi_enviado_reserva = formData.get('foi_enviado_reserva') === 'on'
  const descricao = formData.get('descricao') as string
  const motivo = formData.get('motivo') as string
  const sistema = formData.get('sistema') as string
  const sub_sistema = formData.get('sub_sistema') as string
  const horas_manutencao = formData.get('horas_manutencao') ? parseFloat(formData.get('horas_manutencao') as string) : null
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || !status || !data_abertura) {
    return { error: 'Preencha os campos obrigatórios (Placa, Status, Data Inicial)' }
  }

  const numero_os = `OS-${Date.now()}`

  const { error } = await supabase.from('ordens_servico').insert({
    numero_os,
    equipamento_id,
    placa,
    modulo,
    status,
    data_abertura,
    data_fechamento,
    horimetro,
    operacao_tipo,
    local,
    classe,
    foi_enviado_reserva,
    descricao,
    motivo,
    sistema,
    sub_sistema,
    horas_manutencao,
    observacoes
  })
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}

export async function atualizarStatusOS(id: string, novoStatus: string) {
  const supabase = createClient()
  
  const atualizacao: any = { status: novoStatus }
  if (novoStatus === 'Fechada' || novoStatus === 'Concluída') {
    // Grava no formato ISO local sem ajuste manual de fuso
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    atualizacao.data_fechamento = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    atualizacao.status = 'Fechada' // Map Concluída to Fechada just in case
  }

  await supabase.from('ordens_servico').update(atualizacao).eq('id', id)
  revalidatePath('/os')
  revalidatePath('/')
}

export async function atualizarOrdemServico(id: string, formData: FormData) {
  const supabase = createClient()
  
  const equipamento_id = formData.get('equipamento_id') as string
  const placa = formData.get('placa') as string
  const modulo = formData.get('modulo') as string
  const status = formData.get('status') as string || 'Aberta'
  const data_abertura = formData.get('data_abertura') as string
  const data_fechamento = formData.get('data_fechamento') as string || null
  const horimetro = formData.get('horimetro') ? parseFloat(formData.get('horimetro') as string) : null
  const operacao_tipo = formData.get('operacao_tipo') as string
  const local = formData.get('local') as string
  const classe = formData.get('classe') as string || 'CORRETIVA'
  const foi_enviado_reserva = formData.get('foi_enviado_reserva') === 'on'
  const descricao = formData.get('descricao') as string
  const motivo = formData.get('motivo') as string
  const sistema = formData.get('sistema') as string
  const sub_sistema = formData.get('sub_sistema') as string
  const horas_manutencao = formData.get('horas_manutencao') ? parseFloat(formData.get('horas_manutencao') as string) : null
  const observacoes = formData.get('observacoes') as string

  if (!equipamento_id || !status || !data_abertura) {
    return { error: 'Preencha os campos obrigatórios (Placa, Status, Data Inicial)' }
  }

  const { error } = await supabase.from('ordens_servico').update({
    equipamento_id,
    placa,
    modulo,
    status,
    data_abertura,
    data_fechamento,
    horimetro,
    operacao_tipo,
    local,
    classe,
    foi_enviado_reserva,
    descricao,
    motivo,
    sistema,
    sub_sistema,
    horas_manutencao,
    observacoes
  }).eq('id', id)
  
  if (error) {
    return { error: error.message }
  }

  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}

export async function excluirOrdemServico(id: string) {
  const supabase = createClient()
  const { error } = await supabase.from('ordens_servico').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}

export async function excluirOrdensMassivo(ids: string[]) {
  const supabase = createClient()
  const { error } = await supabase.from('ordens_servico').delete().in('id', ids)
  if (error) return { error: error.message }
  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}

export async function importarOrdensServico(rows: any[]) {
  const supabase = createClient()

  const { data: equipamentos } = await supabase.from('equipamentos').select('id, placa, ultimoHist, modulo')
  const eqMap: Record<string, { id: string; modulo: string; ultimoHist: number | null }> = {}
  equipamentos?.forEach(e => { eqMap[e.placa.toUpperCase()] = { id: e.id, modulo: e.modulo || '', ultimoHist: e.ultimoHist } })

  const inserts = []
  const eqUpdates: Record<string, number> = {} // id -> new horimetro

  function parsePossibleDate(d?: any) {
    if (!d) return null;
    
    // Check if it's an Excel numeric date format (e.g. 45000)
    if (typeof d === 'number' && d > 20000 && d < 100000) {
      const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
      return jsDate.toISOString();
    }

    const str = String(d).trim();
    // Format: DD/MM/YYYY or DD/MM/YYYY HH:mm
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
    if (!isNaN(dt.getTime())) return dt.toISOString();
    return null;
  }

  function getVal(row: any, aliases: string[]) {
    for (const alias of aliases) {
      if (row[alias] !== undefined && row[alias] !== null && row[alias] !== '') return row[alias];
      // Case-insensitive
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
    let placaUpper = String(placaRaw).toUpperCase().trim()
    const eq = eqMap[placaUpper]

    const status = getVal(row, ['status', 'Situação', 'Estado']) || 'Aberta'
    const data_abertura = parsePossibleDate(getVal(row, ['data_abertura', 'Abertura', 'Data Início', 'Início'])) || new Date().toISOString();
    const data_fechamento = parsePossibleDate(getVal(row, ['data_fechamento', 'Fechamento', 'Data Fim', 'Conclusão']))
    const descricao = getVal(row, ['descricao', 'Descrição', 'Serviço', 'Atividade']) || 'Importação via Planilha'
    
    const horimetro = parseFloatSafe(getVal(row, ['horimetro', 'Horímetro', 'KM', 'Hori']))
    const horas_manutencao = parseFloatSafe(getVal(row, ['horas_manutencao', 'Horas', 'Tempo']))

    // Sincronizar Horímetro do Equipamento
    if (eq && horimetro && (!eq.ultimoHist || horimetro > eq.ultimoHist)) {
      if (!eqUpdates[eq.id] || horimetro > eqUpdates[eq.id]) {
        eqUpdates[eq.id] = horimetro
      }
    }

    inserts.push({
      numero_os: `OS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      equipamento_id: eq ? eq.id : null,
      placa: eq ? placaUpper : 'EQUIPAMENTO_NAO_ENCONTRADO',
      modulo: eq ? eq.modulo : (getVal(row, ['modulo', 'Módulo']) || null),
      status,
      data_abertura,
      data_fechamento,
      horimetro,
      operacao_tipo: getVal(row, ['operacao_tipo', 'Operação (Tipo)', 'Operação', 'Tipo']),
      local: getVal(row, ['local', 'Local', 'Frente']),
      classe: getVal(row, ['classe', 'Classe', 'Tipo Manutenção', 'Tipo de OS']) || 'CORRETIVA',
      foi_enviado_reserva: row.foi_enviado_reserva === true || String(row.foi_enviado_reserva).toUpperCase() === 'SIM',
      descricao,
      motivo: getVal(row, ['motivo', 'Motivo', 'Causa']),
      sistema: getVal(row, ['sistema', 'Sistema']),
      sub_sistema: getVal(row, ['sub_sistema', 'Sub-Sistema', 'Subsistema']),
      horas_manutencao,
      observacoes: getVal(row, ['observacoes', 'Observações', 'Notas'])
    })
  }

  // Executar inserções
  const { error: insError } = await supabase.from('ordens_servico').insert(inserts)
  if (insError) return { error: insError.message }

  // Executar atualizações de horímetro
  for (const [id, value] of Object.entries(eqUpdates)) {
    await supabase.from('equipamentos').update({ ultimoHist: value }).eq('id', id)
  }

  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}
