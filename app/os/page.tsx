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

  // Catálogo Sistema → Sub-Sistema → Componente
  const { data: catalogo } = await supabase
    .from('catalogo_manutencao')
    .select('*')
    .order('sistema_codigo')

  // Motivos auxiliares
  const { data: auxConfigs } = await supabase
    .from('aux_config')
    .select('*')

  const motivos = Array.from(new Set([
    ...(ordens || []).map((o: any) => o.motivo).filter(Boolean),
    ...(auxConfigs || []).filter((a: any) => a.tipo === 'Motivo').map((a: any) => a.valor),
  ])).sort() as string[]

  const operacoesTipo = Array.from(new Set(
    (ordens || []).map((o: any) => o.operacao_tipo).filter(Boolean)
  )).sort() as string[]

  return (
    <ControleOSClient
      ordens={ordens || []}
      equipamentos={eqTransformados}
      operacoesTipo={operacoesTipo}
      motivos={motivos}
      catalogo={catalogo || []}
    />
  )
}
