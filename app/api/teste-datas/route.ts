import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseService = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const placa = "SGJ7I82"; // Let's use a Munck plate SGJ7I82 which has 21 OSs
    const inicio = "2026-04-22T00:00:00";
    const fim = "2026-05-21T23:59:59";

    const { data: eqData } = await supabaseService
      .from('equipamentos')
      .select('id, placa')
      .ilike('placa', placa.trim())
      .maybeSingle();

    const eqId = eqData?.id;

    // Query 1: The current query in buscarOSporPlaca using chained .or()
    const queryChained = await supabaseService
      .from('ordens_servico')
      .select('*, equipamento:equipamento_id(placa)')
      .eq('equipamento_id', eqId)
      .or(`data_abertura.lte.${fim},horario_parada.lte.${fim}`)
      .or(`data_fechamento.is.null,data_fechamento.gte.${inicio}`)
      .order('data_abertura', { ascending: false });

    // Query 2: Let's fetch all OSs for this equipment and filter in memory to verify
    const queryAll = await supabaseService
      .from('ordens_servico')
      .select('*, equipamento:equipamento_id(placa)')
      .eq('equipamento_id', eqId)
      .order('data_abertura', { ascending: false });

    return NextResponse.json({
      success: true,
      eqId,
      chainedResultCount: queryChained.data?.length,
      chainedResult: queryChained.data?.map(o => ({ id: o.id, numero_os: o.numero_os, data_abertura: o.data_abertura, data_fechamento: o.data_fechamento })),
      allResultCount: queryAll.data?.length,
      allResult: queryAll.data?.map(o => ({ id: o.id, numero_os: o.numero_os, data_abertura: o.data_abertura, data_fechamento: o.data_fechamento }))
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message });
  }
}
