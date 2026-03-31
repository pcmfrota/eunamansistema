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

  const { data: equipamentos } = await supabase.from('equipamentos').select('id, placa, modulo')
  const eqMap: Record<string, { id: string; modulo: string }> = {}
  equipamentos?.forEach(e => { eqMap[e.placa.toUpperCase()] = { id: e.id, modulo: e.modulo || '' } })

  const inserts = []

  function parsePossibleDate(d?: any) {
    if (!d) return null;
    
    // Check if it's an Excel numeric date format (e.g. 45000)
    if (typeof d === 'number' && d > 20000 && d < 100000) {
      // Excel dates are days since 1899-12-30 (accounting for the 1900 leap year bug)
      const jsDate = new Date(Math.round((d - 25569) * 86400 * 1000));
      return jsDate.toISOString();
    }

    const str = String(d).trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
      const parts = str.split(' ');
      const dateParts = parts[0].split('/');
      let timePart = parts[1] || '00:00:00';
      if (timePart.split(':').length === 2) timePart += ':00'; // Append seconds
      return `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}T${timePart}`;
    }
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) return dt.toISOString();
    return null;
  }

  for (const row of rows) {
    let placaUpper = (row.placa || row.Placa || '').toUpperCase().trim()
    const eq = eqMap[placaUpper]

    let status = row.status || row.Status || 'Aberta'
    let data_abertura = parsePossibleDate(row.data_abertura || row.Abertura) || new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    let data_fechamento = parsePossibleDate(row.data_fechamento || row.Fechamento)
    let descricao = row.descricao || row.Descrição || 'Importação via Planilha'

    const parseFloatSafe = (val: any) => {
      if (val === null || val === undefined || val === '') return null;
      if (typeof val === 'number') return val;
      const strVal = String(val).trim();
      // Se tiver vírgula, tratamos como formato BR (ex: 1.234,56)
      if (strVal.includes(',')) {
        const parsed = parseFloat(strVal.replace(/\./g, '').replace(',', '.'));
        return isNaN(parsed) ? null : parsed;
      }
      // Se não tiver vírgula, pode ser formato americano ou sem milhares
      const parsed = parseFloat(strVal);
      return isNaN(parsed) ? null : parsed;
    }

    let horimetro = parseFloatSafe(row.horimetro || row.Horímetro)
    let horas_manutencao = parseFloatSafe(row.horas_manutencao || row.Horas)

    inserts.push({
      numero_os: `OS-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      equipamento_id: eq ? eq.id : null,
      placa: eq ? placaUpper : 'EQUIPAMENTO_NAO_ENCONTRADO',
      modulo: eq ? eq.modulo : null,
      status,
      data_abertura,
      data_fechamento,
      horimetro,
      operacao_tipo: row.operacao_tipo || row['Operação (Tipo)'] || null,
      local: row.local || row.Local || null,
      classe: row.classe || row.Classe || 'CORRETIVA',
      foi_enviado_reserva: row.foi_enviado_reserva === true || row.foi_enviado_reserva === 'SIM',
      descricao,
      motivo: row.motivo || row.Motivo || null,
      sistema: row.sistema || row.Sistema || null,
      sub_sistema: row.sub_sistema || row['Sub-Sistema'] || null,
      horas_manutencao,
      observacoes: row.observacoes || row.Observações || null
    })
  }

  // Se nao encontrou equipamento, ainda vai falhar a constraint de equipamento_id
  const { error } = await supabase.from('ordens_servico').insert(inserts)
  if (error) return { error: error.message }

  revalidatePath('/os')
  revalidatePath('/')
  return { success: true }
}
