import { createClient } from '@/utils/supabase/server'
import ControleOSClient from './OSClient'

export default async function ControleOSPage() {
  const supabase = createClient()

  // Equipamentos com último horímetro - Otimizado para buscar apenas campos necessários
  const { data: equipamentos } = await supabase
    .from('equipamentos')
    .select('id, placa, modulo, area, tipo, categoria, status, horimetros(horimetro_final)')
    .order('placa')
    .or("status.is.null,status.neq.Inativo,status.neq.INATIVO")
 
  const eqTransformados = equipamentos?.map(eq => {
    let lastH = 0;
    if (eq.horimetros && eq.horimetros.length > 0) {
      // Otimização: evita spread operator em arrays muito grandes
      for (let i = 0; i < eq.horimetros.length; i++) {
        const val = (eq.horimetros[i] as any).horimetro_final;
        if (val > lastH) lastH = val;
      }
    }
    return {
      id: eq.id,
      placa: eq.placa,
      modulo: eq.modulo,
      area: eq.area,
      tipo: eq.tipo,
      categoria: eq.categoria,
      status: eq.status,
      ultimoHist: lastH > 0 ? lastH : undefined,
    };
  }) || [];

  // Ordens de serviço — lista mostra apenas OS com placa cadastrada.
  // Limite de 1000 para evitar travamento da página. Filtros mais profundos devem ser feitos no Dashboard.
  const { data: ordens } = await supabase
    .from('ordens_servico')
    .select(`
      id, numero_os, placa, modulo, status, data_abertura, data_fechamento, 
      horas_manutencao, descricao, horimetro, operacao_tipo, local, classe, 
      foi_enviado_reserva, motivo, sistema, sub_sistema, componente, 
      observacoes, horario_parada, equipamento_id, qual_reserva, horas_reserva_chegou,
      mecanicos, assinatura_mecanico, fotos,
      equipamento:equipamento_id (placa, modulo)
    `)
    .not('equipamento_id', 'is', null)
    .order('data_abertura', { ascending: false })
    .limit(1000);

  // Catálogo, Configurações, Backlogs e Colaboradores - Paralelizados com os demais
  const [catalogoRes, auxRes, calendarioRes, backlogRes, colaboradoresRes] = await Promise.all([
    supabase.from('catalogo_manutencao').select('*').order('sistema_codigo'),
    supabase.from('aux_config').select('*'),
    supabase.from('calendario_suzano').select('*').order('ano', { ascending: true }).order('mes', { ascending: true }),
    supabase.from('backlog').select('id, frota, status, descricao, data_evidencia, criticidade').order('created_at', { ascending: false }).limit(2000),
    supabase.from('colaboradores').select('id, nome').order('nome')
  ]);

  const ordensData = ordens || [];
  const auxConfigs = auxRes.data || [];

  // Motivos e Operações extraídos em um único loop
  const motivosSet = new Set<string>();
  const operacoesSet = new Set<string>();

  ordensData.forEach((o: any) => {
    if (o.motivo) motivosSet.add(o.motivo);
    if (o.operacao_tipo) operacoesSet.add(o.operacao_tipo);
  });

  auxConfigs.forEach((a: any) => {
    if (a.tipo === 'Motivo' && a.valor) motivosSet.add(a.valor);
  });

  const motivos = Array.from(motivosSet).sort();
  const operacoesTipo = Array.from(operacoesSet).sort();
  const calendario = calendarioRes.data || [];

  return (
    <ControleOSClient
      ordens={ordensData}
      equipamentos={eqTransformados}
      operacoesTipo={operacoesTipo}
      motivos={motivos}
      catalogo={catalogoRes.data || []}
      periodos={calendario}
      initialBacklogs={backlogRes.data || []}
      initialColaboradores={colaboradoresRes.data || []}
    />
  )
}
