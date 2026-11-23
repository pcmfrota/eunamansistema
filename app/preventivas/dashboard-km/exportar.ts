import { fmtData, type LinhaPlaca, type Periodo } from '@/lib/horimetro-km-calc'

const arred = (v: number | null, casas = 1) => (v == null ? null : Math.round(v * 10 ** casas) / 10 ** casas)

/** Uma linha por placa, exatamente as placas/período do filtro aplicado. */
export function linhasExportacao(linhas: LinhaPlaca[]) {
  return linhas.map(l => {
    const p = l.principal
    return {
      Placa: l.equipamento.placa,
      Tipo: l.equipamento.tipo || '',
      Frota: l.frota === 'leve' ? 'Leve' : 'Pesado',
      Unidade: l.unidade,
      'Leitura inicial': arred(p.leituraInicial),
      'Data leitura inicial': fmtData(p.dataInicial),
      'Leitura final': arred(p.leituraFinal),
      'Uso no período': p.temLeituraNoPeriodo ? arred(p.uso) : null,
      'Média diária': arred(p.mediaDiaria, 2),
      'Média mensal': arred(p.mediaMensal),
      'Média anual': arred(p.mediaAnual),
      'Projeção anual': arred(p.projecaoAnual, 0),
      'KM inicial': arred(l.km?.leituraInicial ?? null),
      'KM final': arred(l.km?.leituraFinal ?? null),
      'KM rodado no período': l.km?.temLeituraNoPeriodo ? arred(l.km.uso) : null,
      'Última leitura': fmtData(l.ultimaLeitura),
      'Dias sem leitura': l.diasSemLeitura,
      Inconsistências: l.inconsistencias,
      Status: l.status,
    }
  })
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

export async function exportarDashboard(linhas: LinhaPlaca[], periodo: Periodo, formato: 'xlsx' | 'csv') {
  const rows = linhasExportacao(linhas)
  const nome = `km_horimetro_${periodo.inicio}_a_${periodo.fim}`
  if (formato === 'xlsx') {
    const XLSX = await import('xlsx')
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'KM e Horímetro')
    XLSX.writeFile(wb, `${nome}.xlsx`)
    return
  }
  // CSV no padrão do Excel pt-BR: ';' como separador, vírgula decimal e BOM pra acentuação.
  const cab = Object.keys(rows[0] || {})
  const cel = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cab.join(';'), ...rows.map(r => cab.map(c => cel(r[c as keyof typeof r])).join(';'))].join('\r\n')
  baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }), `${nome}.csv`)
}
