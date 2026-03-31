import { createClient } from '@/utils/supabase/server'
import ControleOSClient from './OSClient'

export default async function ControleOSPage() {
  const supabase = createClient()

  // Equipamentos com último horímetro
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('*, horimetros(horimetro_final)')
    .order('placa')

  const eqTransformados = equipamentos?.map(eq => {
    let lastH = 0;
    if (eq.horimetros && eq.horimetros.length > 0) {
      lastH = Math.max(...eq.horimetros.map((h: any) => h.horimetro_final));
    }
    return {
      id: eq.id,
      placa: eq.placa,
      modulo: eq.modulo,
      ultimoHist: lastH > 0 ? lastH : undefined,
    };
  }) || [];

  // Ordens de serviço
  const { data: ordens } = await supabase
    .from('ordens_servico')
    .select('*')
    .order('data_abertura', { ascending: false })

  // Busca valores únicos para os selects dinâmicos (a partir das OS já lançadas)
  const extrairUnicos = (campo: string): string[] => {
    const vals = (ordens || [])
      .map((o: any) => o[campo])
      .filter((v: any) => v && String(v).trim() !== '')
    return Array.from(new Set(vals)).sort() as string[]
  }

  const operacoesTipo  = extrairUnicos('operacao_tipo')
  const motivos        = extrairUnicos('motivo')
  const sistemas       = extrairUnicos('sistema')
  const subSistemas    = extrairUnicos('sub_sistema')

  return (
    <ControleOSClient
      ordens={ordens || []}
      equipamentos={eqTransformados}
      operacoesTipo={operacoesTipo}
      motivos={motivos}
      sistemas={sistemas}
      subSistemas={subSistemas}
    />
  )
}
